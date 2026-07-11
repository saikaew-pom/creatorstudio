-- Creator Studio — RLS hardening pass, part 1 of 2 (docs/07-work-crm.md, M9 review).
-- Depends only on 0001+0005. See 0012_work_security_hardening.sql for the matching
-- fixes in the 0006 (boards/tasks) tables.
--
-- Found by an adversarial multi-lens review while finishing the M9 app layer. None
-- of these were reachable through any UI/route that existed before this migration,
-- but all are directly exploitable by any authenticated client hitting the Supabase
-- REST API — the same trust boundary every RLS policy in this project is written for.
--
-- IMPORTANT Postgres gotcha that shaped this migration: `revoke update (col) on
-- tbl from role` is a NO-OP when that role already holds the table-wide UPDATE
-- privilege (which `alter default privileges ... grant all on tables` gives
-- `authenticated` for every table in this project) — table-level and column-level
-- grants aren't subtractive; having either is sufficient to pass the check. The
-- only way to actually carve out an exception is to revoke the table-wide grant
-- and re-grant UPDATE on just the columns that should remain client-writable.
--
-- Apply by pasting into the Supabase SQL editor, then VERIFY (must ERROR):
--   -- as a non-admin user:
--   update profiles set role = 'admin' where id = auth.uid();
--   update workspaces set owner_id = auth.uid() where id = '<not-yours>';
-- and this must still SUCCEED (own display_name edit, unaffected):
--   update profiles set display_name = 'x' where id = auth.uid();

-- 1. CRITICAL — profiles.role self-escalation. `own_profile` (0001_init.sql) is a
-- `for all using (id = auth.uid())` policy with no WITH CHECK, so Postgres reuses
-- USING as the write-check: it constrains WHICH row you can touch, never what
-- values you write. Any signed-up user can run
-- `update profiles set role = 'admin' where id = auth.uid()` and pass — profiles.role
-- is the ENTIRE trust anchor for grant_feature/revoke_feature (0005 §7) and the
-- apps/work platform-admin pages. Only `display_name` is ever updated by any
-- client code in this repo (apps/content and apps/studio Settings tabs) — lock
-- everything else at the column-privilege level.
revoke update on profiles from authenticated, anon;
grant update (display_name) on profiles to authenticated;

-- 2. CRITICAL — workspaces ownership hijack. `ws_update` (0005 §8) is
-- `for update using (ws_role(id) in ('owner','admin'))`, also with no WITH CHECK —
-- same bug, different table. A workspace member with role 'admin' (NOT owner) can
-- `update workspaces set owner_id = <themselves> where id = <ws>` directly, then
-- call remove_member() on the real owner (whose "cannot remove the owner" guard
-- now checks the STOLEN owner_id and no longer protects them). No RPC in 0005
-- ever intended owner_id or plan to be client-writable at all — transferring
-- ownership isn't implemented yet (see leave_workspace's error message) and plan
-- changes are a billing concern, not a workspace-admin one. `name` is the only
-- column a legitimate "rename workspace" feature would ever need.
revoke update on workspaces from authenticated, anon;
grant update (name) on workspaces to authenticated;

-- 3. workspace_invites over-broad read. `invites_read` (0005 §8) let ANY active
-- member — including 'guest' — read every pending invite for the workspace,
-- including the raw acceptance `token`, even though only owner/admin can create
-- invites (create_invite RPC). accept_invite() still checks the token's email
-- against the caller's own auth email, so a leaked token can't be used to accept
-- on someone else's behalf — but the row (invited email + role + token) shouldn't
-- be visible to non-managers at all. Narrow read access to match write access.
drop policy if exists invites_read on workspace_invites;
create policy invites_read on workspace_invites for select
  using (coalesce(ws_role(workspace_id), '') in ('owner', 'admin'));
