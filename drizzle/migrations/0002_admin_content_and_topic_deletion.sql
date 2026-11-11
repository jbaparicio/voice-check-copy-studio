CREATE OR REPLACE FUNCTION public.can_delete_brand(_brand uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.brands b JOIN public.workspaces w ON w.id = b.workspace_id WHERE b.id = _brand AND (w.created_by = auth.uid() OR public.has_workspace_role(w.id, 'admin'::public.app_role))) $$;
REVOKE ALL ON FUNCTION public.can_delete_brand(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_delete_brand(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.guard_content_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_delete_brand(OLD.brand_id) THEN
  RAISE EXCEPTION 'Only a team admin or owner can delete content';
 END IF;
 RETURN OLD;
END; $$;
ALTER TABLE public.content_items DROP CONSTRAINT content_items_variant_of_fkey;
ALTER TABLE public.content_items ADD CONSTRAINT content_items_variant_of_fkey FOREIGN KEY (variant_of) REFERENCES public.content_items(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.stamp_content_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 -- A foreign-key deletion detaches an alternative; it never changes its copy or verdict.
 IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 AND OLD.variant_of IS NOT NULL AND NEW.variant_of IS NULL
    AND (to_jsonb(NEW) - 'variant_of') = (to_jsonb(OLD) - 'variant_of') THEN
  RETURN NEW;
 END IF;
 IF TG_OP = 'UPDATE' AND OLD.status = 'killed' THEN
  RAISE EXCEPTION 'This piece was killed and cannot run or be changed';
 END IF;
 NEW.updated_at := COALESCE(CASE WHEN current_setting('app.demo_seed', true) = 'on' THEN NEW.updated_at END, now());
 IF current_setting('app.demo_seed', true) = 'on' AND auth.uid() IS NULL
    AND current_user NOT IN ('authenticated', 'anon') AND TG_OP = 'INSERT' THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'approved'
    AND NEW.fields IS DISTINCT FROM OLD.fields THEN NEW.status := 'draft'; END IF;
 IF NEW.status IN ('approved', 'changes_requested', 'killed')
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Only a person can approve content'; END IF;
  IF NOT public.can_approve_brand(NEW.brand_id) THEN
   RAISE EXCEPTION 'Only people with the approver role can approve, request changes or kill a piece';
  END IF;
 END IF;
 IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
  NEW.approved_by := auth.uid(); NEW.approved_at := now();
 ELSIF NEW.status <> 'approved' THEN NEW.approved_by := NULL; NEW.approved_at := NULL; END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.delete_library_content(_brand uuid, _item uuid DEFAULT NULL, _request uuid DEFAULT NULL, _expected_count integer DEFAULT 1)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[]; removed integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_delete_brand(_brand) THEN RAISE EXCEPTION 'Only a team admin or owner can delete content'; END IF;
 IF (_item IS NULL) = (_request IS NULL) THEN RAISE EXCEPTION 'Choose one piece or one topic'; END IF;
 PERFORM 1 FROM public.content_requests WHERE id = _request AND brand_id = _brand FOR UPDATE;
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.content_items WHERE brand_id = _brand AND ((_item IS NOT NULL AND id = _item) OR (_request IS NOT NULL AND request_id = _request)) FOR UPDATE) locked;
 IF COALESCE(cardinality(ids),0) <> _expected_count OR _expected_count < 1 THEN RAISE EXCEPTION 'This topic changed. Refresh and confirm its current piece count.'; END IF;
 DELETE FROM public.content_items WHERE brand_id = _brand AND id = ANY(ids);
 GET DIAGNOSTICS removed = ROW_COUNT;
 IF _request IS NOT NULL THEN DELETE FROM public.content_requests WHERE id = _request AND brand_id = _brand; END IF;
 RETURN removed;
END; $$;
REVOKE ALL ON FUNCTION public.delete_library_content(uuid,uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_library_content(uuid,uuid,uuid,integer) TO authenticated;