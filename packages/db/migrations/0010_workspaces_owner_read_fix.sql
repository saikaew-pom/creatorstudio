-- Creator Studio — fix: owner can't read their own just-created workspace (docs/07,
-- M9 app layer). Found live while wiring the "create a team workspace" UI.
--
-- `ws_read` (0005) is `using (is_ws_member(id))`. Membership is added by an AFTER
-- ROW trigger (on_workspace_created), which fires after the row is produced for the
-- INSERT's RETURNING clause — so a plain client-side `insert(...).select().single()`
-- (return=representation) evaluates the SELECT policy against the row BEFORE the
-- trigger's membership insert is visible, denies it (42501), and rolls back the
-- WHOLE transaction — the workspace never gets created at all. Only signup's
-- security-definer bootstrap avoided this (it bypasses RLS entirely), so it went
-- unnoticed until "create additional team workspace" — the first authenticated
-- client-side insert into this table.
--
-- Fix: an owner can always read a workspace they own, unconditionally — that's
-- exactly the same predicate as `ws_insert`'s WITH CHECK, so this is a safe
-- widening, not a new capability. Since owner_id is part of the row from the
-- moment it's inserted (no trigger dependency), this makes RETURNING work
-- immediately, not just later reads.
--
-- Apply by pasting into the Supabase SQL editor, then VERIFY:
--   select policyname, qual from pg_policies where tablename = 'workspaces' and policyname = 'ws_read';

drop policy if exists ws_read on workspaces;
create policy ws_read on workspaces for select using (is_ws_member(id) or owner_id = auth.uid());
