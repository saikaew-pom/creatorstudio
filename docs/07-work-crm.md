# 07 — WORK + CRM MODULE (blueprint)

> **What this adds.** An access-gated "Work" function (Antbase-style tasks: list / board /
> calendar / Gantt + workload + an AI assistant) **and** a brand-deals CRM (sponsors, deal
> pipeline, deliverables that link straight to the content/video you produce in the studio),
> bolted onto the existing Creator Studio stack. It is the concrete version of the
> `team workspaces` item parked in the doc-06 M8 backlog.
>
> **Decisions locked (2026-07-09, with the owner):**
> 1. **Team workspaces** — multi-user, membership-based RLS. Not solo.
> 2. **CRM = brand deals / sponsorships** — creator-economy pipeline, deliverables tie to studio output.
> 3. **Access = admin entitlement flag** — an admin grants the `work_crm` feature per workspace
>    (beta allow-list), independent of plan tier.
>
> **Reads before this doc:** `docs/03-data-model.md` (schema + RLS idiom), `docs/02-prompt-engine.md`
> (prompt module conventions — the AI parts here follow it verbatim), `docs/06-build-plan.md`
> (milestone/acceptance format). This doc continues the build plan as **M9–M13**.

---

## 0. Where it fits (system map delta)

| Layer | Today | After this module |
|---|---|---|
| Apps | `apps/content` (3100), `apps/studio` (3200) | **+ `apps/work` (3300)** — new Next.js app, same shell/tokens from `packages/ui` |
| DB | all tables RLS `user_id = auth.uid()` (personal) | **+ workspace-scoped tables** using a membership helper; existing personal tables untouched |
| AI | `packages/ai` Gemini router (timeouts, JSON repair) | reused as-is; **+ new prompt modules** in `packages/prompts` (`work.*`, `crm.*`) |
| Worker | `apps/worker` polls `render_jobs` | **+ polls `automation_jobs`** (reminders, digests, recurring tasks) — same poll loop |
| Credits | ledger + `debit_credits` + `try_consume_daily_use` | reused: CRUD is free, **AI assists cost credits / count against daily quota** |
| Access | `plan` + `role` on `profiles` | **+ `workspace_entitlements`** — admin grants `work_crm` |

**Why a new app and not routes inside `apps/content`.** It mirrors the existing content/studio
split, keeps the Work bundle out of the creator-facing content app, and lets you deploy/scale/
feature-flag it independently. The trade-off is one more Vercel project + shared-nav wiring. If
you'd rather not run a third app, everything here works just as well as a `/work` route group
inside `apps/content` — the data model, RLS, and prompts do not change. **Recommended: new app.**

**The one architectural shift.** The whole app is single-tenant today (`user_id = auth.uid()`).
Work + CRM are inherently shared, so they need a **workspace** as the unit of ownership and
**membership-based RLS**. We do **not** rewrite the existing personal tables — `brands`,
`generations`, `projects` stay `user_id`-scoped. The new tables are `workspace_id`-scoped, and
the studio ↔ CRM bridge (`deliverables`) *references* a personal `generation`/`project` by id
rather than moving it into a workspace. This keeps the risky RLS surface small and additive.
(If you later want fully shared brand kits, §9 notes the migration path.)

---

## 1. Foundation — workspaces, membership, entitlement

```sql
-- migration 0005_workspaces.sql

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete restrict,
  plan text not null default 'free' check (plan in ('free','pro','business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','guest')),
  status text not null default 'active' check (status in ('active','invited','removed')),
  invited_by uuid references profiles(id) on delete set null,
  invited_email text,                       -- for pending invites before signup
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on workspace_members (user_id) where status = 'active';

-- Admin-granted feature entitlement (the "granted access right").
create table workspace_entitlements (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  feature text not null,                    -- 'work_crm' (extensible: 'work', 'crm', ...)
  granted_by uuid references profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,                   -- null = permanent
  primary key (workspace_id, feature)
);
```

### 1.1 RLS helpers (the security spine — get these right first)

Every workspace-scoped policy routes through **one** `security definer` predicate so there is a
single place cross-tenant leaks can hide. Mirror the doc-01 §M0 acceptance test: *a member of
workspace A must never read a row in workspace B.*

```sql
-- Is the caller an active member of this workspace?
create or replace function is_ws_member(p_ws uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = p_ws and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

-- Caller's role in the workspace (null if not a member). For write/role gates.
create or replace function ws_role(p_ws uuid)
returns text language sql security definer stable as $$
  select role from workspace_members
  where workspace_id = p_ws and user_id = auth.uid() and status = 'active';
$$;

-- Does the workspace hold a live entitlement? The server guard also checks this,
-- but enforcing in RLS means a missing entitlement is deny-by-default at the DB.
create or replace function ws_has_feature(p_ws uuid, p_feature text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from workspace_entitlements e
    where e.workspace_id = p_ws and e.feature = p_feature
      and (e.expires_at is null or e.expires_at > now())
  );
$$;
```

```sql
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_entitlements enable row level security;

create policy ws_read on workspaces for select using (is_ws_member(id));
create policy ws_write on workspaces for update using (ws_role(id) in ('owner','admin'));
create policy members_read on workspace_members for select using (is_ws_member(workspace_id));
-- Membership writes go through security-definer RPCs (invite/accept/remove), not direct DML.
create policy ent_read on workspace_entitlements for select using (is_ws_member(workspace_id));
-- Entitlement grants: platform admins only, done with the service-role key server-side
-- (profiles.role='admin'); no authenticated policy for insert/update/delete.
```

### 1.2 Personal workspace bootstrap

Extend the existing `0002_profile_bootstrap.sql` signup trigger so every new user gets a personal
workspace they own — Work/CRM then has a home even before anyone forms a team.

```sql
-- inside handle_new_user() (0002): add `declare v_ws uuid;` and, after the profile insert:
insert into workspaces (name, owner_id) values (coalesce(new.raw_user_meta_data->>'name','My Workspace'), new.id)
  returning id into v_ws;
insert into workspace_members (workspace_id, user_id, role) values (v_ws, new.id, 'owner');
-- (does NOT auto-grant work_crm — that stays an explicit admin action, §1.3)
```

### 1.3 Entitlement enforcement (defense in depth)

Three layers, all required — a UI toggle alone is not access control:

1. **RLS**: every Work/CRM policy `and`s `ws_has_feature(workspace_id, 'work_crm')`. DB denies by default.
2. **Server guard**: `packages/db` helper `requireFeature(db, wsId, 'work_crm')` called at the top of
   every Work/CRM route handler (throws 403 before any query). Reuses the existing service pattern.
3. **UI**: the Work nav item + `apps/work` route group hide when the active workspace lacks the feature.

Admin grant path (platform admin, `profiles.role='admin'`, service-role client):
`grantFeature(adminDb, wsId, 'work_crm', { expiresAt })` → inserts the entitlement row. Expose it
in a tiny admin page (extends the existing admin surface from M4).

---

## 2. Work module — tasks, boards, workload

```sql
-- migration 0006_work.sql

create table boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  default_view text not null default 'board' check (default_view in ('list','board','calendar','gantt')),
  position numeric not null default 1000,        -- fractional ordering (see §8 invariant)
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  board_id uuid not null references boards(id) on delete cascade,
  parent_task_id uuid references tasks(id) on delete cascade,   -- subtasks
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assignee_id uuid references profiles(id) on delete set null,  -- must be a member (checked in app + trigger)
  start_date date,
  due_date date,
  estimate_hours numeric,                        -- feeds workload
  position numeric not null default 1000,        -- order within status column
  links jsonb not null default '{}',             -- {deal_id, generation_id, project_id} — bridge to CRM/studio
  created_by uuid not null references profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on tasks (workspace_id, board_id, status);
create index on tasks (workspace_id, assignee_id) where status <> 'done';
create index on tasks (workspace_id, due_date) where due_date is not null;

create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,  -- denormalized for RLS
  author_id uuid not null references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table task_activity (            -- audit trail: status changes, reassigns, AI edits
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  kind text not null,                   -- created | status | assignee | due | comment | ai_draft_applied
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

RLS for all four: `for all using (is_ws_member(workspace_id) and ws_has_feature(workspace_id,'work_crm'))`.
(Denormalizing `workspace_id` onto `task_comments`/`task_activity` avoids an EXISTS-join in the hot
policy — matches the doc-03 pattern of keeping RLS predicates flat.)

**Views (all read the same `tasks` table, differ only in the client):**
- **List** — grouped by status/assignee/due; inline edit.
- **Board (kanban)** — columns = `status`; drag sets `status` + `position` via a reorder RPC.
- **Calendar** — placed by `due_date`; drag-to-date updates `due_date` (reuse the existing
  content-calendar drag component from `apps/content`).
- **Gantt** — bars from `start_date`→`due_date`; dependency arrows are a v2 (`task_deps` table noted
  in §9 backlog; ship the 4 views first, dependencies later — Antbase leads with the views).
- **Workload** — `sum(estimate_hours)` per `assignee_id` over a date window vs. a per-member weekly
  capacity (stored on `workspace_members.capacity_hours`, default 40); highlights over-allocation.
  This is a pure query/aggregate — no new write path.

---

## 3. CRM module — brand deals & sponsorships

```sql
-- migration 0007_crm.sql

create table crm_companies (        -- the sponsor / brand you're dealing with
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  website text, industry text, logo_path text,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table crm_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  company_id uuid references crm_companies(id) on delete set null,
  name text not null, role_title text,
  email text, phone text, line_id text,        -- LINE is the primary channel in TH
  notes text,
  created_at timestamptz not null default now()
);
create index on crm_contacts (workspace_id, company_id);

-- Configurable pipeline stages, seeded with a creator-deal default set.
create table deal_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name_th text not null, key text not null,
  position numeric not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  unique (workspace_id, key)
);
-- seeded per workspace on first CRM open (RPC seed_default_stages):
--   prospect(ว่าที่ลูกค้า) · outreach(ทาบทาม) · negotiating(กำลังต่อรอง) ·
--   signed(ปิดดีล) · in_production(กำลังผลิต) · delivered(ส่งงาน) · paid(รับเงินแล้ว/won) · lost(หลุดดีล)

create table deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title text not null,                          -- "รีวิวครีมกันแดด x BrandX — ก.ค."
  company_id uuid references crm_companies(id) on delete set null,
  primary_contact_id uuid references crm_contacts(id) on delete set null,
  stage_id uuid not null references deal_stages(id),
  owner_id uuid references profiles(id) on delete set null,   -- member responsible
  amount_thb numeric,                           -- deal value (฿)
  probability int check (probability between 0 and 100),
  expected_close date,
  source text,                                  -- inbound | outreach | referral | agency
  brand_id uuid,                                -- optional link to a studio `brands` row (voice for outreach)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on deals (workspace_id, stage_id);

create table deal_activities (      -- timeline: calls, emails, meetings, notes, stage moves
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  kind text not null check (kind in ('note','call','email','meeting','stage_change','ai_draft')),
  body text, detail jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);

-- THE bridge: a deliverable is a piece of studio output owed on a deal.
create table deliverables (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  kind text not null check (kind in ('content_kit','image','video','post','other')),
  title text not null,
  status text not null default 'todo'
    check (status in ('todo','in_production','in_review','approved','published')),
  due_date date,
  generation_id uuid,     -- link to a personal generations row (content kit / image)
  project_id uuid,        -- link to a personal video projects row
  task_id uuid references tasks(id) on delete set null,   -- the work item that produces it
  owner_user_id uuid references profiles(id) on delete set null,  -- who owns the linked studio asset
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on deliverables (workspace_id, deal_id);
```

RLS: same pattern — `for all using (is_ws_member(workspace_id) and ws_has_feature(workspace_id,'work_crm'))`.

**Bridge integrity (the subtle bit).** `deliverables.generation_id` / `project_id` point at
*personal* tables that are still `user_id`-scoped, so a plain FK + RLS join won't line up across the
two ownership models. Rules:
- Store `owner_user_id` (whoever created/owns the linked asset) on the deliverable.
- The **link action** is validated in the app: only a workspace member may link, and only to an
  asset they own; you may relax to "any member's asset" once brand kits are shared (§9).
- Rendering a deliverable's thumbnail/preview goes through a **server route** that loads the linked
  asset with the service-role client *after* confirming `is_ws_member` — never a direct client RLS
  read across the boundary. This keeps the two tenancy models decoupled and auditable.

**Pipeline UX:** kanban of `deals` by `deal_stages` (drag = stage move → writes a `stage_change`
`deal_activity` + advisory-locked reorder, §8). Deal detail = contact/company panel, activity
timeline, deliverables checklist with live status pulled from the linked studio asset, value + close
date. "Won" (paid) and "Lost" stages drive the funnel/forecast numbers.

---

## 4. AI assistant ("ผู้ช่วย" — the antbot equivalent)

Follows `docs/02-prompt-engine.md` **verbatim** — every function is a prompt module with a
`prompt_id`, a zod output schema, and goes through the existing `packages/ai` router (which already
enforces the hard timeout + JSON repair). Add a `packages/prompts/src/work.ts` and `crm.ts`.

| `prompt_id` | Input | Output (zod) | Credits |
|---|---|---|---|
| `work.task_draft.v1` | goal text + board context | `{tasks:[{title,estimate_hours,priority,subtasks[]}]}` | 1 |
| `work.standup.v1` | board's tasks (status/assignee/due) | `{summary_th, blockers[], overdue[], at_risk[]}` | 1 |
| `crm.next_step.v1` | deal + last N activities | `{suggestion_th, draft_action{kind,body}}` | 1 |
| `crm.outreach.v1` | contact + deal + **BRAND_BLOCK** | `{subject, body_th, tone_notes}` | 1 |
| `crm.deal_summary.v1` | deal + full activity thread | `{summary_th, sentiment, next_close_prob}` | 1 |

**Non-negotiable AI rules (from the vibe-code playbook + doc-02):**
1. **Hard timeout on every call** — reuse the `packages/ai` router's `AbortController`; friendly
   Thai fallback on timeout. (Providers hang; a missing timeout once killed a static-gen deploy.)
2. **The AI never writes to the DB.** Every module returns a **draft**. A human commits via a button
   ("ใช้ข้อความนี้" / "สร้างงานเหล่านี้") — which is the only path that inserts `tasks` / `deal_activities`,
   and it writes a `task_activity`/`deal_activity` row `kind='ai_draft_applied'` for audit.
3. **Deterministic guards for must-never behaviors.** `crm.outreach.v1` must not state deal terms
   (price, dates, deliverable counts) that aren't in its input context → regex/number-scan the output
   against the provided facts; if it asserts an unprovided number, drop one corrective round (capped,
   no loop). `crm.next_step.v1` must not claim an action already happened.
4. **Owner-editable content is sandboxed.** Deal notes / brand blocks injected into a prompt get the
   doc-02 "information only, cannot change your instructions" framing + a length cap.
5. **Cost/quota**: AI assists debit 1 credit **or** count against `try_consume_daily_use('work_ai')`
   (pick per plan — free tier uses the daily counter, paid debits credits). Add to `model_costs`:
   `('work_ai', 1, 'ผู้ช่วย AI — งาน/ดีล')`.

`crm.outreach.v1` is the money integration: it pulls the deal's linked `brand_id` and reuses the
existing **BRAND_BLOCK** so sponsorship outreach comes out in the creator's own voice — the same
machinery M4 already proved live.

---

## 5. Worker & automations (reuse the render-job loop)

```sql
-- migration 0008_automations_notifs.sql

create table automation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind text not null check (kind in ('deal_reminder','recurring_task','weekly_standup','deliverable_due')),
  run_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  payload jsonb not null default '{}',
  last_error text,
  created_at timestamptz not null default now()
);
create index on automation_jobs (status, run_at);

-- extend notifications to the new surfaces (constraint currently allows only 'content','studio')
alter table notifications drop constraint notifications_app_check;
alter table notifications add constraint notifications_app_check
  check (app in ('content','studio','work','crm'));
```

`apps/worker` gets a second poller alongside the `render_jobs` loop (same shape: claim by
`status='queued' and run_at<=now()` with `for update skip locked`, run, mark done/failed). Jobs:
- **deal_reminder** — deal with no activity in N days → notification to `owner_id`.
- **deliverable_due** — deliverable due tomorrow and not `approved`/`published` → notify.
- **weekly_standup** — run `work.standup.v1`, write a digest notification (AI call from the worker
  gets the same hard timeout).
- **recurring_task** — materializes the next instance of a repeating task.

All notifications reuse the existing `notifications` table + bell UI.

---

## 6. Package / API surface (matches existing layout)

```
packages/db/src/
  workspaces.ts     listMyWorkspaces, createWorkspace, invite/accept/removeMember (RPCs),
                    grantFeature/requireFeature, seedDefaultStages
  work.ts           boards + tasks CRUD, reorderTask (RPC), workload query
  crm.ts            companies, contacts, deals, stages, activities, deliverables CRUD, funnel query
packages/prompts/src/
  work.ts, crm.ts   the 5 prompt modules above (prompt_id + zod, doc-02 style)
apps/work/app/
  layout.tsx + middleware.ts   (copy the apps/studio session-refresh middleware verbatim)
  api/work/*  api/crm/*  api/assist/*   (each handler: requireFeature() first, then RLS-scoped queries)
  (board|list|calendar|gantt|workload)/…   crm/(pipeline|contacts|companies|deals/[id])/…
```

Types: extend `packages/db/src/types.ts` with the new row interfaces (hand-written, same as today;
swap for `supabase gen types` when the CLI is wired). Add exports to `packages/db/src/index.ts`.

---

## 7. Migrations & rollout (hand-paste convention)

New numbered files, applied through the **Supabase SQL editor** exactly like 0001–0004 (PostgREST
can't run raw DDL). Order matters — 0005 before 0006/0007 (helpers referenced by later policies):

```
0005_workspaces.sql          workspaces, members, entitlements, RLS helpers, bootstrap trigger patch
0006_work.sql                boards, tasks, comments, activity, reorder RPC
0007_crm.sql                 companies, contacts, stages, deals, activities, deliverables, seed RPC
0008_automations_notifs.sql  automation_jobs, notifications constraint bump, model_costs insert
```

Then regenerate the combined file: `cat packages/db/migrations/000*.sql > packages/db/migrations/_apply_all.generated.sql`.
**Per the project rule: paste each block into the SQL editor yourself, then verify the change exists
(e.g. `select is_ws_member(gen_random_uuid());` returns false without error; `\d deals`) before
pushing any app code that depends on it.** Do not push code first.

---

## 8. Invariants & risks (enforce in db/code)

1. **Cross-tenant isolation is the #1 risk.** Every workspace table's policy goes through
   `is_ws_member` **and** `ws_has_feature`. The M9 gate is a script that creates two workspaces with
   two users and asserts user B cannot read/patch **any** of user A's Work/CRM rows via the REST API
   (mirrors doc-01 M0). No milestone closes until this passes.
2. **Entitlement is checked server-side on every route** (`requireFeature`), not only hidden in nav.
   RLS is the backstop; the guard gives a clean 403 + Thai upsell instead of empty lists.
3. **Assignee/owner must be a member.** Trigger (or app-layer check) rejects `tasks.assignee_id` /
   `deals.owner_id` that isn't an active `workspace_member` — prevents leaking rows to ex-members.
4. **Ordering under concurrent drags** — `position` is `numeric` fractional (place = midpoint of
   neighbors); a `reorder_task(...)`/`reorder_deal(...)` RPC takes a per-column advisory lock so two
   simultaneous drags can't collide (same discipline as the credits/quota RPCs).
5. **Stage & value changes are audited** — every `deals.stage_id` / `amount_thb` change writes a
   `deal_activities` row. The pipeline's history is the source of truth for the funnel, not the
   current row.
6. **AI never writes; drafts → human commit; guards for fabricated facts** (§4). Same defense-in-depth
   the playbook mandates: prompt rule **and** deterministic output guard.
7. **The studio↔CRM bridge never crosses RLS boundaries directly** (§3) — server route + service
   role after `is_ws_member`, never a client cross-tenant read.
8. **Member removal** cascades membership but must reassign or null their `assignee_id`/`owner_id`
   (the FK `on delete set null` handles the row; a sweep re-surfaces now-unassigned work).
9. **Never role-check with a bare `not in` inside a `security definer` RPC.** `ws_role()` is `NULL`
   for a non-member, and `null not in ('owner','admin')` is `NULL`, which `IF` treats as false — so
   a bare check lets an outsider through a function that bypasses RLS (privilege escalation). Always
   `coalesce(ws_role(p_ws),'') not in (...)` / `coalesce((select role...),'') <> 'admin'`. This bug
   shipped in the first draft of `0005` and was caught only by the M9 gate test running **as the
   `authenticated` role** — running RPCs as the owner would have hidden it.

---

## 9. Build plan — M9–M13 (continues doc 06 format)

Rules of engagement unchanged (BLUEPRINT §5; one milestone per branch; end with acceptance tests
pasted). Estimates assume the existing stack is live.

### M9 — Workspaces, membership, entitlement, RLS (2 days) ⭐ foundation
**DB layer done** — `packages/db/migrations/0005_workspaces.sql` (tables, RLS helpers, membership +
invite + entitlement RPCs, bootstrap trigger patch) and its gate test
`packages/db/test/workspace-rls.test.ts` (`pnpm --filter @cs/db test:workspace-rls`, **26/26 green**
against real Postgres) already exist. Remaining: `apps/work` skeleton + session middleware +
workspace switcher; `requireFeature` server helper + admin grant page; wire the invite email.
**Accept**: the cross-tenant test (invariant 1) passes — user B reads **zero** of user A's
workspace rows [DONE]; a workspace without `work_crm` gets 403 from every `/api/work|crm` route and no
nav entry; admin grant flips it on live.

### M10 — Work: tasks + the four views + workload (2.5 days)
Boards/tasks 0006; List, Board (drag→status via reorder RPC), Calendar (reuse content-calendar drag),
Gantt (bars, no deps yet); Workload aggregate; comments + activity timeline; assignee = member picker.
**Accept**: create a board, add tasks, drag across kanban columns (status + order persist and survive
reload), place one on the calendar by drag, see a Gantt bar span start→due, and see an over-allocated
member flagged in Workload; activity log shows each status change.

### M11 — CRM: pipeline, contacts, deals, deliverables (3 days) ⭐
Tables 0007 + seed stages; companies/contacts CRUD; deal pipeline kanban (drag = stage move +
audited); deal detail with activity timeline; deliverables checklist linking to a real `generation`
or `project` via the server bridge route.
**Accept**: create a sponsor + contact + deal; drag it prospect→negotiating (a `stage_change`
activity appears); attach a deliverable pointing at a content kit you generated in `apps/content` and
see its live status/thumbnail render through the bridge (no cross-tenant RLS read); funnel totals
update.

### M12 — AI assistant + automations (2 days)
`work.*`/`crm.*` prompt modules through `packages/ai` (timeouts); draft→commit buttons writing
audit rows; guards for `crm.outreach.v1` (no unprovided deal terms) and `crm.next_step.v1`;
`automation_jobs` + worker poller (deal_reminder, deliverable_due, weekly_standup) + notifications.
**Accept**: `work.task_draft.v1` turns a goal into ≥3 committed subtasks (with a `ai_draft_applied`
activity row); `crm.outreach.v1` drafts outreach in the deal's linked **brand voice** and the guard
demonstrably strips/blocks a fabricated price; a due-tomorrow deliverable fires a worker notification;
every AI call has a verified hard timeout (kill-provider test → Thai fallback, no hang).

### M13 — Polish, roles, launch gating (1.5 days)
Role permissions (guest read-only; member no billing; owner/admin manage members + entitlement);
mobile pass on board + pipeline; empty/error states (doc 05 §5); notification bell in `apps/work`;
analytics events (task_created, deal_stage_moved, deliverable_linked, ai_assist_used); plan/entitlement
upsell page for non-entitled workspaces.
**Accept**: a guest can view but not edit; removing a member nulls their assignments and revokes
access instantly; Lighthouse ≥85 on board + pipeline; full journey (create workspace → invite →
board → deal → link deliverable from studio → AI outreach → won) recorded as a GIF with no dead-ends.

### Backlog (post-M13, do not build now)
Gantt task dependencies (`task_deps`) · shared workspace brand kits (migrate `brands` to optional
`workspace_id`) · CRM email/LINE inbound sync · contract e-sign on deals · per-deal P&L vs.
`amount_thb` · MCP tools for Work/CRM (extend the doc-07-of-old MCP server) · time tracking on tasks.

---

## 10. Handover notes for the executing model

- **Do M9 first and do not proceed until the cross-tenant test is green.** Everything else assumes
  membership RLS is airtight. This is the same "RLS verified" gate that M0 imposed on the personal app.
- **Reuse, don't reinvent**: the session middleware (`apps/studio/middleware.ts`), the credit/quota
  RPCs, the calendar drag component, the `packages/ai` router with its timeout, the notifications
  table + bell. New parallel helpers are a smell.
- **Prompts are source of truth** (memory: doc-02 rule). Write the `work.*`/`crm.*` modules with
  explicit `prompt_id` + zod schemas; the executing model must not improvise prompt text.
- **Migrations are hand-pasted then verified** before dependent code ships (§7). Never push first.
- **Every AI call: hard timeout + friendly Thai fallback + draft-not-write + deterministic guard.**
```
