-- Creator Studio — reorder_task hardening (docs/07-work-crm.md, M10 review).
-- `if p_status not in ('todo','in_progress','blocked','done') then raise
-- exception 'invalid status'` (0006_work.sql) is a bare NULL-unsafe check —
-- `null not in (...)` evaluates to NULL, which an `if` treats as false, so a
-- caller passing p_status = NULL would skip the guard and reach
-- `update tasks set status = p_status ...`. tasks.status has NOT NULL (0006),
-- so that UPDATE would still fail — just with an opaque Postgres constraint
-- error instead of this function's clean 'invalid status' message. Same bug
-- CLASS already fixed twice elsewhere in this codebase (0005's add_member/
-- set_member_role/create_invite, all now coalesce()'d); closing it here too
-- for consistency even though the NOT NULL column is a real backstop.
--
-- Apply by pasting into the Supabase SQL editor, then VERIFY:
--   select reorder_task(gen_random_uuid(), null, null, null);
--   -- must raise 'invalid status', not 'task not found' or a raw constraint error

create or replace function reorder_task(p_task uuid, p_status text, p_prev uuid, p_next uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_board uuid; v_prev numeric; v_next numeric; v_pos numeric;
begin
  select workspace_id, board_id into v_ws, v_board from tasks where id = p_task;
  if v_ws is null then raise exception 'task not found'; end if;
  if not (is_ws_member(v_ws) and ws_has_feature(v_ws, 'work_crm')) then
    raise exception 'not authorized';
  end if;
  if coalesce(p_status, '') not in ('todo','in_progress','blocked','done') then
    raise exception 'invalid status';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_board::text, 0));
  select position into v_prev from tasks where id = p_prev and board_id = v_board;
  select position into v_next from tasks where id = p_next and board_id = v_board;
  v_pos := case
    when v_prev is null and v_next is null then 1000
    when v_prev is null then v_next - 1000
    when v_next is null then v_prev + 1000
    else (v_prev + v_next) / 2
  end;

  update tasks set
    status = p_status,
    position = v_pos,
    completed_at = case when p_status = 'done' then now() else null end,
    updated_at = now()
  where id = p_task;
  return v_pos;
end $$;
