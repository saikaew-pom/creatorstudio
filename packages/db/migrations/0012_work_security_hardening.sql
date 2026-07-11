-- Creator Studio — RLS hardening pass, part 2 of 2 (docs/07-work-crm.md, M9 review).
-- Depends on 0006_work.sql. See 0011_security_hardening.sql for the matching fixes
-- in the 0005 (workspaces) tables — same review pass, split so each migration only
-- needs its own prerequisite tables (matches this project's per-migration gate-test
-- convention: workspace-rls.test.ts stops at 0005-level tables, work-rls.test.ts
-- is the one that also has boards/tasks).
--
-- Same "revoke table-wide, re-grant the safe columns" pattern as 0011 — see that
-- file's header comment for why a bare `revoke update (col) ... from role` alone
-- is a no-op once the role already holds table-wide UPDATE.
--
-- Apply by pasting into the Supabase SQL editor, then VERIFY (must ERROR):
--   -- as a member of workspace A who also belongs to workspace B:
--   update tasks set workspace_id = '<ws-B>' where id = '<a task in ws-A>';
-- and this must still SUCCEED (ordinary task edit, unaffected):
--   update tasks set status = 'in_progress' where id = '<a task you can see>';

-- 1. Cross-workspace task/board smuggling. `boards_all`/`tasks_all` (0006 §5) are
-- `for all using (is_ws_member(workspace_id) and ws_has_feature(...))` with no
-- WITH CHECK, so the same USING is reused for UPDATE and evaluated against the
-- NEW row: a member of workspace A who's ALSO a member of workspace B could
-- `update tasks set workspace_id = B where id = <task in A>` and pass (both old
-- and new workspace_id satisfy the reused check), smuggling a task's contents
-- into a workspace it didn't belong to. workspace_id should never change after
-- creation — lock it at the column-privilege level.
revoke update on boards from authenticated, anon;
grant update (name, default_view, position, archived) on boards to authenticated;

revoke update on tasks from authenticated, anon;
grant update (
  board_id, parent_task_id, title, description, status, priority, assignee_id,
  start_date, due_date, estimate_hours, position, links, completed_at, updated_at
) on tasks to authenticated;

-- 2. task_comments delete gap. Every sibling policy on this table (comments_read,
-- comments_insert, boards_all, tasks_all, activity_read) checks BOTH
-- is_ws_member(workspace_id) AND ws_has_feature(workspace_id,'work_crm') —
-- comments_delete (0006 §5) checked only `author_id = auth.uid()`. A user removed
-- from the workspace, or a workspace that's had work_crm revoked, still let the
-- original author delete their own old comment rows in it.
drop policy if exists comments_delete on task_comments;
create policy comments_delete on task_comments for delete
  using (author_id = auth.uid() and is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
