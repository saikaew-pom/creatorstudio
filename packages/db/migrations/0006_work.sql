-- Creator Studio — Work module: boards + tasks + comments + audited activity.
-- docs/07-work-crm.md §2. Apply AFTER 0005 (needs is_ws_member / ws_has_feature).
--
-- Every table here is workspace-scoped AND behind the work_crm entitlement: the
-- RLS predicate is `is_ws_member(workspace_id) and ws_has_feature(workspace_id,
-- 'work_crm')`, so a workspace without the granted feature is deny-by-default at
-- the DB (defense in depth under the server-side requireFeature guard).
--
-- Paste into the Supabase SQL editor, then VERIFY:
--   select reorder_task(gen_random_uuid(),'todo',null,null);  -- => 'task not found', no crash
--   \d tasks

-- 1. Tables -----------------------------------------------------------------
create table boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  default_view text not null default 'board' check (default_view in ('list','board','calendar','gantt')),
  position numeric not null default 1000,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, workspace_id)            -- composite-FK target for tasks (workspace consistency)
);
create index on boards (workspace_id) where archived = false;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null,
  parent_task_id uuid,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assignee_id uuid references profiles(id) on delete set null,   -- must be an active member (trigger)
  start_date date,
  due_date date,
  estimate_hours numeric,
  position numeric not null default 1000,
  links jsonb not null default '{}',    -- {deal_id, generation_id, project_id} — bridge to CRM/studio
  created_by uuid not null default auth.uid() references profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  -- a task's workspace MUST equal its board's / parent's workspace — enforced by
  -- composite FKs, not app trust (docs/07 §3 "bridge integrity" discipline).
  foreign key (board_id, workspace_id) references boards(id, workspace_id) on delete cascade,
  foreign key (parent_task_id, workspace_id) references tasks(id, workspace_id) on delete cascade
);
create index on tasks (workspace_id, board_id, status);
create index on tasks (workspace_id, assignee_id) where status <> 'done';
create index on tasks (workspace_id, due_date) where due_date is not null;

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null,
  author_id uuid not null default auth.uid() references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  foreign key (task_id, workspace_id) references tasks(id, workspace_id) on delete cascade
);
create index on task_comments (task_id, created_at);

create table task_activity (            -- append-only audit trail (written by trigger only)
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  workspace_id uuid not null,
  actor_id uuid references profiles(id) on delete set null,
  kind text not null,                   -- created | status | assignee | comment | ai_draft_applied
  detail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (task_id, workspace_id) references tasks(id, workspace_id) on delete cascade
);
create index on task_activity (task_id, created_at);

-- 2. Assignee must be an active member (BEFORE trigger) ----------------------
create or replace function enforce_task_assignee_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from workspace_members m
    where m.workspace_id = new.workspace_id and m.user_id = new.assignee_id and m.status = 'active'
  ) then
    raise exception 'assignee must be an active workspace member';
  end if;
  return new;
end $$;

create trigger trg_task_assignee before insert or update on tasks
  for each row execute function enforce_task_assignee_member();

-- 3. Audit trail (AFTER trigger; task_activity is otherwise client-read-only) --
create or replace function log_task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into task_activity (task_id, workspace_id, actor_id, kind, detail)
    values (new.id, new.workspace_id, auth.uid(), 'created', '{}');
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into task_activity (task_id, workspace_id, actor_id, kind, detail)
      values (new.id, new.workspace_id, auth.uid(), 'status',
              jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      insert into task_activity (task_id, workspace_id, actor_id, kind, detail)
      values (new.id, new.workspace_id, auth.uid(), 'assignee',
              jsonb_build_object('to', new.assignee_id));
    end if;
  end if;
  return null;
end $$;

create trigger trg_task_activity after insert or update on tasks
  for each row execute function log_task_activity();

-- 4. Reorder RPC — fractional position under a per-board advisory lock --------
-- Places the task at the midpoint of its new neighbors so two simultaneous
-- drags can't collide (docs/07 §8 invariant 4). Re-checks authorization because
-- SECURITY DEFINER bypasses the table's RLS.
create or replace function reorder_task(p_task uuid, p_status text, p_prev uuid, p_next uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_board uuid; v_prev numeric; v_next numeric; v_pos numeric;
begin
  select workspace_id, board_id into v_ws, v_board from tasks where id = p_task;
  if v_ws is null then raise exception 'task not found'; end if;
  if not (is_ws_member(v_ws) and ws_has_feature(v_ws, 'work_crm')) then
    raise exception 'not authorized';
  end if;
  if p_status not in ('todo','in_progress','blocked','done') then
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

-- 5. RLS ---------------------------------------------------------------------
alter table boards enable row level security;
alter table tasks enable row level security;
alter table task_comments enable row level security;
alter table task_activity enable row level security;

-- Members of a feature-enabled workspace get full CRUD on boards/tasks.
create policy boards_all on boards for all
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
create policy tasks_all on tasks for all
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));

-- Comments: read as a member; write only as yourself; delete only your own.
create policy comments_read on task_comments for select
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
create policy comments_insert on task_comments for insert
  with check (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm') and author_id = auth.uid());
create policy comments_delete on task_comments for delete using (author_id = auth.uid());

-- Activity is append-only from the trigger; clients read only.
create policy activity_read on task_activity for select
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
revoke insert, update, delete on task_activity from authenticated, anon;
