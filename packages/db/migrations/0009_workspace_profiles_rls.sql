-- Creator Studio — teammate profile visibility (docs/07-work-crm.md, M9 app layer).
-- `profiles` RLS (0001_init.sql) is `id = auth.uid()` only: a user can read their OWN
-- profile row and nobody else's. That blocks every teammate-facing UI the Work/CRM
-- module needs — the workspace member list, the invite-management page, and (from
-- M10) the task assignee picker — since none of them can resolve a teammate's
-- display_name.
--
-- Fix: an additive SELECT policy that lets a user read another profile only if they
-- currently share an ACTIVE membership in some workspace. Uses a security-definer
-- helper (shares_workspace_with) for the same reason is_ws_member/ws_role are
-- definer in 0005 — reading workspace_members from inside a policy on a different
-- table needs to bypass workspace_members' OWN RLS, or callers with no membership
-- anywhere get an empty join, not a real check.
--
-- Apply by pasting into the Supabase SQL editor (PostgREST can't run raw DDL), then
-- VERIFY before shipping dependent code:
--   select shares_workspace_with(gen_random_uuid());   -- => false, no error

create or replace function shares_workspace_with(p_user uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members m1
    join workspace_members m2 on m1.workspace_id = m2.workspace_id
    where m1.user_id = auth.uid() and m1.status = 'active'
      and m2.user_id = p_user and m2.status = 'active'
  );
$$;

-- Postgres OR-combines multiple permissive policies for the same command, so this
-- only WIDENS select access — the existing `own_profile ... for all` policy still
-- governs insert/update/delete (self only).
create policy workspace_teammates_read_profiles on profiles for select
  using (shares_workspace_with(id));
