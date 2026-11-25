-- Slack gate: link Slack users to studio members, make link tokens single-use,
-- and remember which Slack message shows which content item.
-- Clients may only read and remove their own link; every write goes through the server
-- after it has checked a signed, single-use token and the member's own session.
-- user_id is not a foreign key to auth.users (project convention); the server checks the
-- user exists before acting, and a deleted user's link simply stops resolving.

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

-- Grants first, then row level security.
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
