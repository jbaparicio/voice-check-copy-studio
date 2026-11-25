create table public.demo_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index demo_ai_usage_created_idx on public.demo_ai_usage (created_at);
alter table public.demo_ai_usage enable row level security;
grant all on public.demo_ai_usage to service_role;

create or replace function public.claim_demo_ai_action()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then return 'signed_out'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false then
    return 'ok';
  end if;
  perform pg_advisory_xact_lock(hashtext('demo_ai_usage'));
  if exists (select 1 from demo_ai_usage where user_id = _uid) then
    return 'guest_used';
  end if;
  if (select count(*) from demo_ai_usage where created_at >= date_trunc('day', now())) >= 5 then
    return 'daily_full';
  end if;
  insert into demo_ai_usage (user_id) values (_uid);
  return 'ok';
end $$;
revoke all on function public.claim_demo_ai_action() from public, anon;
grant execute on function public.claim_demo_ai_action() to authenticated;