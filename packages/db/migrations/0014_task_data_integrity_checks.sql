-- Creator Studio — task data-integrity CHECK constraints (docs/07-work-crm.md, M10
-- follow-up review). Depends on 0006_work.sql.
--
-- The M10 adversarial review (see docs/07-work-crm.md's M10 entry) flagged
-- "estimate_hours and start_date ≤ due_date had no validation anywhere
-- (migration-level, API-level, or client-level)" and the fix that shipped only
-- closed the API-level gap: apps/work/app/api/boards/[id]/tasks/route.ts and
-- apps/work/app/api/tasks/[id]/route.ts both validate estimate_hours >= 0 and
-- start_date <= due_date before writing. Migration-level (the third thing the
-- finding itself named) was never actually added — proven live against a real
-- Postgres (PGlite) as the `authenticated` role, the same way every other gate
-- test in this project works:
--   insert into tasks (workspace_id, board_id, title, estimate_hours)
--     values ('<ws>','<board>','t', -50);                        -- SUCCEEDED, -50 stored
--   insert into tasks (workspace_id, board_id, title, start_date, due_date)
--     values ('<ws>','<board>','t','2026-08-15','2026-08-01');   -- SUCCEEDED, inverted range stored
--
-- Any authenticated client that talks to the Supabase REST/RPC API directly
-- (not through the Next.js app — the same trust boundary 0011/0012 harden
-- against for privilege escalation) can persist a negative estimate or an
-- inverted date range, corrupting Workload's allocated-hours sum and the
-- Gantt view's bar geometry. Column-privilege grants (0012) make both columns
-- client-writable by design (ordinary task edits need them) — only a CHECK
-- constraint closes the gap without taking that away.
--
-- NULL is allowed for both columns (neither is NOT NULL in 0006) — a bare
-- `estimate_hours >= 0` or `start_date <= due_date` CHECK would itself reject
-- NULL under a naive read, but Postgres CHECK constraints already treat NULL
-- as "not violated" (three-valued logic: a NULL comparison is UNKNOWN, and
-- CHECK only rejects a definite FALSE) — so `estimate_hours >= 0` alone is
-- already NULL-safe. The `is null or` guards below are kept anyway to make
-- that intent explicit and self-documenting, matching this file's own header
-- style elsewhere in the migration set (e.g. 0013's coalesce()).
--
-- Apply by pasting into the Supabase SQL editor, then VERIFY (both must ERROR):
--   insert into tasks (workspace_id, board_id, title, estimate_hours)
--     values ('<any ws you're a member of>', '<a board in it>', 'x', -1);
--   insert into tasks (workspace_id, board_id, title, start_date, due_date)
--     values ('<same ws>', '<same board>', 'x', '2026-08-15', '2026-08-01');
-- and this must still SUCCEED (ordinary task, unaffected):
--   insert into tasks (workspace_id, board_id, title, estimate_hours, start_date, due_date)
--     values ('<same ws>', '<same board>', 'x', 2.5, '2026-08-01', '2026-08-15');

alter table tasks
  add constraint tasks_estimate_hours_nonneg check (estimate_hours is null or estimate_hours >= 0);

alter table tasks
  add constraint tasks_date_range_valid
    check (start_date is null or due_date is null or start_date <= due_date);
