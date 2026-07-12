-- Creator Studio — CRM module: brand deals & sponsorships (docs/07-work-crm.md §3).
-- Apply AFTER 0006_work.sql (needs is_ws_member/ws_has_feature from 0005, and
-- `tasks` from 0006 for deliverables.task_id).
--
-- Every hardening lesson from the M9/M10 adversarial reviews (0011-0014) is
-- applied here FROM THE START rather than left for a follow-up pass:
--   - Every `for all using(...)` policy with no WITH CHECK reuses USING as the
--     write-check, which only constrains WHICH row you touch, never what values
--     land in it — so `workspace_id` is locked at the COLUMN-PRIVILEGE level on
--     every table below (revoke table-wide UPDATE, re-grant only the ordinary
--     columns), the same "revoke is a no-op unless you also drop the table-wide
--     grant" pattern 0011/0012 document.
--   - `deal_activities` is append-only from the audit trigger for stage/amount
--     changes, exactly like `task_activity` — but ALSO accepts client INSERTs
--     for manual note/call/email/meeting log entries (a relationship-management
--     timeline, not pure audit trail), scoped by a WITH CHECK that only allows
--     those four kinds and forces actor_id = auth.uid().
--   - `reorder_deal`'s stage validation is a positive existence+match check
--     (not a bare `not in`), so a NULL p_stage can't slip past a NULL-unsafe
--     guard the way invariant 9 warns about.
--   - amount_thb/probability/date-range-style CHECK constraints are added
--     immediately (0014 had to retrofit this for tasks.estimate_hours after
--     the fact).
--
-- Apply by pasting into the Supabase SQL editor, then VERIFY (must ERROR):
--   -- as a member of workspace A who's also a member of workspace B:
--   update deals set workspace_id = '<ws-B>' where id = '<a deal in ws-A>';
--   update deal_activities set body = 'x' where id = '<any row>';
-- and this must still SUCCEED (ordinary edit, unaffected):
--   update deals set title = 'x' where id = '<a deal you can see>';
--   select seed_default_stages('<your workspace id>');  -- idempotent, safe to re-run

-- 1. Tables -----------------------------------------------------------------
create table crm_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  website text,
  industry text,
  logo_path text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on crm_companies (workspace_id);

create table crm_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete set null,
  name text not null,
  role_title text,
  email text,
  phone text,
  line_id text,        -- LINE is the primary channel in TH
  notes text,
  created_at timestamptz not null default now()
);
create index on crm_contacts (workspace_id, company_id);

-- Configurable pipeline stages, seeded with a creator-deal default set via the
-- seed_default_stages RPC below. `unique(id, workspace_id)` is the composite-FK
-- target deals.stage_id uses to guarantee a deal's stage is always in its own
-- workspace (same discipline as boards/tasks in 0006).
create table deal_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name_th text not null,
  key text not null,
  position numeric not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  unique (workspace_id, key),
  unique (id, workspace_id)
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,
  company_id uuid references crm_companies(id) on delete set null,
  primary_contact_id uuid references crm_contacts(id) on delete set null,
  stage_id uuid not null,
  owner_id uuid references profiles(id) on delete set null,   -- must be an active member (trigger)
  amount_thb numeric check (amount_thb is null or amount_thb >= 0),
  probability int check (probability is null or probability between 0 and 100),
  expected_close date,
  source text,                 -- inbound | outreach | referral | agency
  brand_id uuid,                -- optional link to a studio `brands` row (voice for outreach)
  notes text,
  position numeric not null default 1000,   -- order within a stage column (kanban drag)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  foreign key (stage_id, workspace_id) references deal_stages(id, workspace_id)
);
create index on deals (workspace_id, stage_id);

create table deal_activities (      -- timeline: calls, emails, meetings, notes, stage/amount moves
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null,
  workspace_id uuid not null,
  actor_id uuid references profiles(id) on delete set null,
  kind text not null check (kind in ('note','call','email','meeting','stage_change','amount_change','ai_draft')),
  body text,
  detail jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  foreign key (deal_id, workspace_id) references deals(id, workspace_id) on delete cascade
);
create index on deal_activities (deal_id, occurred_at);

-- THE bridge: a deliverable is a piece of studio output owed on a deal.
-- generation_id/project_id point at PERSONAL tables (still user_id-scoped) —
-- deliberately NOT foreign keys, since the two ownership models don't line up;
-- see §3's "bridge integrity" note. Linking is validated in the app (only to an
-- asset the linking member owns), and rendering goes through a server route
-- with the service-role client after confirming is_ws_member — never a direct
-- client RLS read across the boundary.
create table deliverables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  deal_id uuid not null,
  kind text not null check (kind in ('content_kit','image','video','post','other')),
  title text not null,
  status text not null default 'todo'
    check (status in ('todo','in_production','in_review','approved','published')),
  due_date date,
  generation_id uuid,
  project_id uuid,
  task_id uuid references tasks(id) on delete set null,
  owner_user_id uuid references profiles(id) on delete set null,  -- who owns the linked studio asset
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (deal_id, workspace_id) references deals(id, workspace_id) on delete cascade
);
create index on deliverables (workspace_id, deal_id);

-- 2. Owner-must-be-member (BEFORE trigger, mirrors 0006's assignee trigger) ----
create or replace function enforce_deal_owner_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from workspace_members m
    where m.workspace_id = new.workspace_id and m.user_id = new.owner_id and m.status = 'active'
  ) then
    raise exception 'owner must be an active workspace member';
  end if;
  return new;
end $$;

create trigger trg_deal_owner before insert or update on deals
  for each row execute function enforce_deal_owner_member();

-- 3. Audit trail — stage/amount changes only (AAFTER trigger; manual note/call/
-- email/meeting entries come from the client via activity_insert below) --------
create or replace function log_deal_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.stage_id is distinct from old.stage_id then
      insert into deal_activities (deal_id, workspace_id, actor_id, kind, detail)
      values (new.id, new.workspace_id, auth.uid(), 'stage_change',
              jsonb_build_object('from', old.stage_id, 'to', new.stage_id));
    end if;
    if new.amount_thb is distinct from old.amount_thb then
      insert into deal_activities (deal_id, workspace_id, actor_id, kind, detail)
      values (new.id, new.workspace_id, auth.uid(), 'amount_change',
              jsonb_build_object('from', old.amount_thb, 'to', new.amount_thb));
    end if;
  end if;
  return null;
end $$;

create trigger trg_deal_activity after update on deals
  for each row execute function log_deal_activity();

-- 4. Reorder RPC — fractional position under a per-workspace advisory lock ----
-- Mirrors reorder_task (0006 §4); stage validity is a positive existence+match
-- check (not a bare `not in`), so p_stage = NULL raises cleanly instead of
-- silently passing (invariant 9's bug class).
create or replace function reorder_deal(p_deal uuid, p_stage uuid, p_prev uuid, p_next uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_stage_ws uuid; v_prev numeric; v_next numeric; v_pos numeric;
begin
  select workspace_id into v_ws from deals where id = p_deal;
  if v_ws is null then raise exception 'deal not found'; end if;
  if not (is_ws_member(v_ws) and ws_has_feature(v_ws, 'work_crm')) then
    raise exception 'not authorized';
  end if;

  select workspace_id into v_stage_ws from deal_stages where id = p_stage;
  if v_stage_ws is null or v_stage_ws <> v_ws then
    raise exception 'invalid stage';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_ws::text, 1));
  select position into v_prev from deals where id = p_prev and workspace_id = v_ws;
  select position into v_next from deals where id = p_next and workspace_id = v_ws;
  v_pos := case
    when v_prev is null and v_next is null then 1000
    when v_prev is null then v_next - 1000
    when v_next is null then v_prev + 1000
    else (v_prev + v_next) / 2
  end;

  update deals set stage_id = p_stage, position = v_pos, updated_at = now() where id = p_deal;
  return v_pos;
end $$;

-- 5. Seed default stages — called once per workspace on first CRM open; safe to
-- call again (ON CONFLICT DO NOTHING on the (workspace_id, key) unique key).
create or replace function seed_default_stages(p_ws uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (is_ws_member(p_ws) and ws_has_feature(p_ws, 'work_crm')) then
    raise exception 'not authorized';
  end if;
  insert into deal_stages (workspace_id, name_th, key, position, is_won, is_lost)
  values
    (p_ws, 'ว่าที่ลูกค้า', 'prospect', 1000, false, false),
    (p_ws, 'ทาบทาม', 'outreach', 2000, false, false),
    (p_ws, 'กำลังต่อรอง', 'negotiating', 3000, false, false),
    (p_ws, 'ปิดดีล', 'signed', 4000, false, false),
    (p_ws, 'กำลังผลิต', 'in_production', 5000, false, false),
    (p_ws, 'ส่งงาน', 'delivered', 6000, false, false),
    (p_ws, 'รับเงินแล้ว', 'paid', 7000, true, false),
    (p_ws, 'หลุดดีล', 'lost', 8000, false, true)
  on conflict (workspace_id, key) do nothing;
end $$;

-- 6. RLS -----------------------------------------------------------------------
alter table crm_companies enable row level security;
alter table crm_contacts enable row level security;
alter table deal_stages enable row level security;
alter table deals enable row level security;
alter table deal_activities enable row level security;
alter table deliverables enable row level security;

create policy companies_all on crm_companies for all
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
create policy contacts_all on crm_contacts for all
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
create policy stages_all on deal_stages for all
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
create policy deals_all on deals for all
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
create policy deliverables_all on deliverables for all
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));

-- Activity: read as member; INSERT only your own manual log entries (note/call/
-- email/meeting) — stage_change/amount_change/ai_draft rows are never client-
-- inserted (trigger-only / a future M12 server route), and nothing can update
-- or delete an activity row once written.
create policy activity_read on deal_activities for select
  using (is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm'));
create policy activity_insert on deal_activities for insert
  with check (
    is_ws_member(workspace_id) and ws_has_feature(workspace_id, 'work_crm')
    and actor_id = auth.uid() and kind in ('note', 'call', 'email', 'meeting')
  );
revoke update, delete on deal_activities from authenticated, anon;

-- Column-privilege hardening (see 0011/0012 header comments for why a bare
-- `revoke update on tbl from role` alone is a no-op once that role already
-- holds table-wide UPDATE via Supabase's default-privileges grant) — workspace_id
-- must never be client-writable on any table below.
revoke update on crm_companies from authenticated, anon;
grant update (name, website, industry, logo_path, notes, updated_at) on crm_companies to authenticated;

revoke update on crm_contacts from authenticated, anon;
grant update (company_id, name, role_title, email, phone, line_id, notes) on crm_contacts to authenticated;

revoke update on deal_stages from authenticated, anon;
grant update (name_th, position) on deal_stages to authenticated;

revoke update on deals from authenticated, anon;
grant update (
  title, company_id, primary_contact_id, stage_id, owner_id, amount_thb,
  probability, expected_close, source, brand_id, notes, position, updated_at
) on deals to authenticated;

revoke update on deliverables from authenticated, anon;
grant update (
  deal_id, kind, title, status, due_date, generation_id, project_id, task_id,
  owner_user_id, updated_at
) on deliverables to authenticated;
