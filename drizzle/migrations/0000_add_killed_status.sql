ALTER TABLE public.content_items DROP CONSTRAINT content_items_status_check;
ALTER TABLE public.content_items ADD CONSTRAINT content_items_status_check
  CHECK (status = ANY (ARRAY['draft','in_review','approved','changes_requested','killed']));

CREATE OR REPLACE FUNCTION public.set_content_status(_item uuid, _status text, _comment text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE
  old_status text;
  b uuid;
  c text := NULLIF(btrim(COALESCE(_comment, '')), '');
BEGIN
  IF _status NOT IN ('draft', 'in_review', 'approved', 'changes_requested', 'killed') THEN
    RAISE EXCEPTION 'Unknown status';
  END IF;
  IF _status = 'changes_requested' AND c IS NULL THEN
    RAISE EXCEPTION 'Please say what needs to change';
  END IF;
  IF _status = 'killed' AND c IS NULL THEN
    RAISE EXCEPTION 'Please give a short reason why this cannot run';
  END IF;
  SELECT status, brand_id INTO old_status, b FROM public.content_items WHERE id = _item;
  IF b IS NULL THEN RAISE EXCEPTION 'We couldn''t find that piece'; END IF;
  UPDATE public.content_items SET status = _status WHERE id = _item;
  INSERT INTO public.activity_log (brand_id, content_item_id, actor, action, details)
  VALUES (b, _item, auth.uid(),
    CASE _status WHEN 'in_review' THEN 'submitted' WHEN 'approved' THEN 'approved'
      WHEN 'changes_requested' THEN 'changes_requested' WHEN 'killed' THEN 'killed' ELSE 'moved_to_draft' END,
    jsonb_build_object('from', old_status, 'to', _status, 'comment', left(c, 2000)));
END;
$function$;

CREATE OR REPLACE FUNCTION public.stamp_content_item()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'killed' THEN
    RAISE EXCEPTION 'This piece was killed and cannot run or be changed';
  END IF;
  NEW.updated_at := COALESCE(CASE WHEN current_setting('app.demo_seed', true) = 'on' THEN NEW.updated_at END, now());
  IF current_setting('app.demo_seed', true) = 'on' AND auth.uid() IS NULL
     AND current_user NOT IN ('authenticated', 'anon') AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'approved'
     AND NEW.fields IS DISTINCT FROM OLD.fields THEN
    NEW.status := 'draft';
  END IF;
  IF NEW.status IN ('approved', 'changes_requested', 'killed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Only a person can approve content';
    END IF;
    IF NOT public.can_approve_brand(NEW.brand_id) THEN
      RAISE EXCEPTION 'Only people with the approver role can approve, request changes or kill a piece';
    END IF;
  END IF;
  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.approved_by := auth.uid();
    NEW.approved_at := now();
  ELSIF NEW.status <> 'approved' THEN
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;