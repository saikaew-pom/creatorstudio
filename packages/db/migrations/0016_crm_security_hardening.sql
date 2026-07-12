-- Creator Studio — CRM hardening pass (docs/07-work-crm.md, M11 review).
-- Depends on 0015_crm.sql. Found by an adversarial multi-lens review immediately
-- after 0015 shipped — 0015's own header claimed every identity-defining column
-- was locked down "from the start," but that claim was wrong for the columns
-- below. None of these are reachable through any UI/route that existed before
-- this migration, but all are directly exploitable by any authenticated client
-- hitting the Supabase REST API — the same trust boundary every RLS policy in
-- this project is written for.
--
-- 1. CRITICAL — the studio<->CRM bridge's write side was never locked down.
-- deliverables.generation_id/project_id are deliberately NOT foreign keys (the
-- two tenancy models don't line up — docs/07 §3), so nothing at the DB level
-- stopped them from being set to ANY uuid. The app enforces "only link an asset
-- you own" in apps/work/app/api/deals/[id]/deliverables/route.ts and
-- apps/work/app/api/deliverables/[id]/route.ts — but 0015 granted client UPDATE
-- on generation_id/project_id/owner_user_id (same "table-wide grant means the
-- app-layer check is advisory only" issue 0011/0012 already fixed for
-- workspace_id elsewhere), so a direct PostgREST call bypasses that check
-- entirely, and the SANCTIONED preview route (deliverables/[id]/preview) would
-- then dutifully fetch and return whatever it points at — turning the one
-- intentionally-privileged read path in this whole module into a confused
-- deputy for reading ANY other user's generation/project metadata + image URL.
--
-- The fix mirrors this file's own deal-owner trigger: a BEFORE trigger that
-- requires owner_user_id = auth.uid() whenever a link is set, AND verifies
-- auth.uid() actually owns the referenced generations/project row (bypassing
-- RLS via security definer to do the lookup, same pattern as
-- enforce_deal_owner_member/enforce_task_assignee_member).
--
-- Apply by pasting into the Supabase SQL editor, then VERIFY (must ERROR):
--   -- as a member of workspace A, with <other-users-generation-id> a real
--   -- generation belonging to a DIFFERENT user:
--   update deliverables set generation_id = '<other-users-generation-id>', owner_user_id = auth.uid()
--     where id = '<a deliverable in A>';
--   update deliverables set owner_user_id = '<some-other-profile-id>' where id = '<a deliverable in A>';
-- and this must still SUCCEED (linking your OWN generation, unaffected):
--   update deliverables set generation_id = '<a generation YOU own>', owner_user_id = auth.uid()
--     where id = '<a deliverable in A>';

create or replace function enforce_deliverable_asset_ownership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.generation_id is not null then
    if new.owner_user_id is distinct from auth.uid() then
      raise exception 'generation_id can only be linked by its owner';
    end if;
    if not exists (select 1 from generations g where g.id = new.generation_id and g.user_id = auth.uid()) then
      raise exception 'generation not found or not owned by caller';
    end if;
  end if;
  if new.project_id is not null then
    if new.owner_user_id is distinct from auth.uid() then
      raise exception 'project_id can only be linked by its owner';
    end if;
    if not exists (select 1 from projects p where p.id = new.project_id and p.user_id = auth.uid()) then
      raise exception 'project not found or not owned by caller';
    end if;
  end if;
  if new.owner_user_id is not null and new.generation_id is null and new.project_id is null then
    raise exception 'owner_user_id may only be set alongside a linked asset';
  end if;
  return new;
end $$;

create trigger trg_deliverable_asset_ownership before insert or update on deliverables
  for each row execute function enforce_deliverable_asset_ownership();

-- 2. Cross-workspace identity smuggling via a NON-workspace_id column. deals.
-- stage_id already got the composite-FK treatment (0015), but deals.company_id/
-- primary_contact_id, crm_contacts.company_id, and deliverables.task_id did
-- not — a member of two workspaces could re-point a row in workspace A to
-- reference a company/contact/task that actually lives in workspace B (the
-- row's own workspace_id stays correct, only the cross-reference dangles into
-- another tenant). RLS on the REFERENCED table still hides its actual content
-- from anyone who isn't a member of that other workspace, so this isn't a
-- direct data leak — but it's the same "bare uuid FK with no workspace pinning"
-- class of bug, and the fix is the same composite-FK pattern already used for
-- stage_id, requiring `unique(id, workspace_id)` on the two tables that didn't
-- have it yet. `on delete set null (<col>)` (PG15+) nulls only the dangling
-- reference on delete, never the row's own workspace_id.
alter table crm_companies add constraint crm_companies_id_workspace_key unique (id, workspace_id);
alter table crm_contacts add constraint crm_contacts_id_workspace_key unique (id, workspace_id);

alter table crm_contacts drop constraint crm_contacts_company_id_fkey;
alter table crm_contacts add constraint crm_contacts_company_id_fkey
  foreign key (company_id, workspace_id) references crm_companies(id, workspace_id) on delete set null (company_id);

alter table deals drop constraint deals_company_id_fkey;
alter table deals add constraint deals_company_id_fkey
  foreign key (company_id, workspace_id) references crm_companies(id, workspace_id) on delete set null (company_id);

alter table deals drop constraint deals_primary_contact_id_fkey;
alter table deals add constraint deals_primary_contact_id_fkey
  foreign key (primary_contact_id, workspace_id) references crm_contacts(id, workspace_id) on delete set null (primary_contact_id);

alter table deliverables drop constraint deliverables_task_id_fkey;
alter table deliverables add constraint deliverables_task_id_fkey
  foreign key (task_id, workspace_id) references tasks(id, workspace_id) on delete set null (task_id);
