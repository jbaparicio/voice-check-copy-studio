CREATE TABLE public.slack_links (
  slack_team_id text NOT NULL,
  slack_user_id text NOT NULL,
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slack_team_id, slack_user_id)
);
CREATE INDEX slack_links_user_idx ON public.slack_links (user_id);

CREATE TABLE public.slack_link_nonces (
  nonce text PRIMARY KEY,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.slack_messages (
  content_item_id uuid PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  slack_team_id text NOT NULL,
  channel_id text NOT NULL,
  message_ts text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.slack_links FROM anon, authenticated;
REVOKE ALL ON public.slack_link_nonces FROM anon, authenticated;
REVOKE ALL ON public.slack_messages FROM anon, authenticated;
GRANT SELECT, DELETE ON public.slack_links TO authenticated;
GRANT ALL ON public.slack_links TO service_role;
GRANT ALL ON public.slack_link_nonces TO service_role;
GRANT ALL ON public.slack_messages TO service_role;

ALTER TABLE public.slack_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_link_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members see their own Slack link" ON public.slack_links
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members remove their own Slack link" ON public.slack_links
  FOR DELETE TO authenticated USING (user_id = auth.uid());