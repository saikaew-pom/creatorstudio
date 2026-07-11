-- Creator Studio — Work + CRM foundation: team workspaces, membership, entitlement.
-- docs/07-work-crm.md §1. Apply AFTER 0001–0004 (references profiles).
--
-- This is the security spine for the whole Work/CRM module. The three helper
-- functions below are SECURITY DEFINER on purpose: workspace_members' own RLS
-- policy calls is_ws_member(), so the helper MUST bypass RLS (run as owner) or
-- the policy recurses infinitely. This is the standard Supabase pattern.
--
-- Apply by pasting into the Supabase SQL editor (PostgREST can't run raw DDL),
-- then VERIFY before shipping dependent code:
--   select is_ws_member(gen_random_uuid());   -- => false, no error
--   \d workspace_members

-- 1. Tables -----------------------------------------------------------------
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete restrict,
  plan text not null default 'free' check (plan in ('free','pro','business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on workspaces (owner_id);

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member','guest')),
  status text not null default 'active' check (status in ('active','removed')),
  capacity_hours numeric not null default 40,     -- weekly capacity, feeds Workload (M10)
  invited_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on workspace_members (user_id) where status = 'active';

-- Pending invites for people who may not have signed up yet. Kept separate from
-- workspace_members so that table only ever holds real (workspace_id,user_id) rows
-- — cleaner than a nullable user_id under the composite PK (refines doc §1's
-- inline invited_email sketch).
create table workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member','guest')),
  token uuid not null default gen_random_uuid(),
  invited_by uuid references profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

-- The "granted access right": an admin turns the Work/CRM module on per workspace.
create table workspace_entitlements (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  feature text not null,                          -- 'work_crm' (extensible)
  granted_by uuid references profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,                         -- null = permanent
  primary key (workspace_id, feature)
);

-- 2. RLS helpers (security definer → bypass RLS → no policy recursion) --------
create or replace function is_ws_member(p_ws uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = p_ws and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function ws_role(p_ws uuid)
returns text language sql security definer stable set search_path = public as $$
  select role from workspace_members
  where workspace_id = p_ws and user_id = auth.uid() and status = 'active';
$$;

create or replace function ws_has_feature(p_ws uuid, p_feature text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_entitlements e
    where e.workspace_id = p_ws and e.feature = p_feature
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- 3. Auto-add the owner as a member on workspace creation --------------------
-- Runs for both the signup bootstrap and app-created team workspaces, so the
-- insert policy on workspaces never has a chicken-and-egg with membership.
create or replace function add_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_workspace_created on workspaces;
create trigger on_workspace_created
  after insert on workspaces
  for each row execute function add_owner_membership();

-- 4. Personal-workspace bootstrap — patch the 0002 signup trigger ------------
-- Full replacement of handle_new_user(): profile + monthly grant (unchanged)
-- PLUS a personal workspace. Membership is added by the trigger above, so we
-- only insert the workspace here. Does NOT grant work_crm — that stays an
-- explicit admin action (§1.3).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid;
begin
  insert into public.profiles (id, display_name, plan)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'free'
  )
  on conflict (id) do nothing;

  insert into public.credit_transactions (user_id, amount, kind, bucket, note)
  values (new.id, 20, 'monthly_grant', 'monthly', 'เครดิตเริ่มต้น (สมัครใหม่)');

  insert into public.workspaces (name, owner_id)
  values (coalesce(new.raw_user_meta_data->>'name', 'พื้นที่ของฉัน'), new.id)
  returning id into v_ws;

  return new;
end $$;

-- 5. Membership RPCs (the only write path into workspace_members) -------------
-- workspace_members has no authenticated write policy, so all mutation goes
-- through these definer functions, which enforce the caller's role.

create or replace function add_member(p_ws uuid, p_user uuid, p_role text default 'member')
returns void language plpgsql security definer set search_path = public as $$
begin
  -- coalesce is load-bearing: ws_role() is NULL for a non-member, and
  -- `null not in (...)` is NULL (not true), so a bare check would let an
  -- outsider through this definer function. Caught by the M9 gate test.
  if coalesce(ws_role(p_ws), '') not in ('owner','admin') then
    raise exception 'not authorized';
  end if;
  if p_role not in ('admin','member','guest') then
    raise exception 'invalid role';
  end if;
  insert into workspace_members (workspace_id, user_id, role, status, invited_by)
  values (p_ws, p_user, p_role, 'active', auth.uid())
  on conflict (workspace_id, user_id)
    do update set status = 'active', role = excluded.role;
end $$;

create or replace function set_member_role(p_ws uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(ws_role(p_ws), '') not in ('owner','admin') then
    raise exception 'not authorized';
  end if;
  if p_user = (select owner_id from workspaces where id = p_ws) then
    raise exception 'cannot change the owner role';
  end if;
  if p_role not in ('admin','member','guest') then
    raise exception 'invalid role';
  end if;
  update workspace_members set role = p_role where workspace_id = p_ws and user_id = p_user;
end $$;

create or replace function remove_member(p_ws uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(ws_role(p_ws), '') not in ('owner','admin') then
    raise exception 'not authorized';
  end if;
  if p_user = (select owner_id from workspaces where id = p_ws) then
    raise exception 'cannot remove the owner';
  end if;
  -- soft-remove so is_ws_member() flips off immediately; FKs on tasks/deals use
  -- on delete set null and are swept separately (docs/07 §8 invariant 8).
  update workspace_members set status = 'removed' where workspace_id = p_ws and user_id = p_user;
end $$;

create or replace function leave_workspace(p_ws uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = (select owner_id from workspaces where id = p_ws) then
    raise exception 'owner must transfer ownership before leaving';
  end if;
  update workspace_members set status = 'removed'
  where workspace_id = p_ws and user_id = auth.uid();
end $$;

-- 6. Invite RPCs -------------------------------------------------------------
create or replace function create_invite(p_ws uuid, p_email text, p_role text default 'member')
returns uuid language plpgsql security definer set search_path = public as $$
declare v_token uuid;
begin
  if coalesce(ws_role(p_ws), '') not in ('owner','admin') then
    raise exception 'not authorized';
  end if;
  insert into workspace_invites (workspace_id, email, role, invited_by)
  values (p_ws, lower(p_email), p_role, auth.uid())
  on conflict (workspace_id, email)
    do update set role = excluded.role, accepted_at = null, token = gen_random_uuid()
  returning token into v_token;
  return v_token;   -- server emails "<app>/work/invite?token=..."
end $$;

create or replace function accept_invite(p_token uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv workspace_invites; v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  select * into v_inv from workspace_invites where token = p_token and accepted_at is null;
  if v_inv.workspace_id is null then
    raise exception 'invite not found or already used';
  end if;
  if lower(v_email) <> v_inv.email then
    raise exception 'invite is for a different email';
  end if;
  insert into workspace_members (workspace_id, user_id, role, status, invited_by)
  values (v_inv.workspace_id, auth.uid(), v_inv.role, 'active', v_inv.invited_by)
  on conflict (workspace_id, user_id) do update set status = 'active', role = excluded.role;
  update workspace_invites set accepted_at = now() where id = v_inv.id;
  return v_inv.workspace_id;
end $$;

-- 7. Entitlement RPCs (platform admins only: profiles.role = 'admin') --------
create or replace function grant_feature(p_ws uuid, p_feature text, p_expires timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select role from profiles where id = auth.uid()), '') <> 'admin' then
    raise exception 'platform admin only';
  end if;
  insert into workspace_entitlements (workspace_id, feature, granted_by, expires_at)
  values (p_ws, p_feature, auth.uid(), p_expires)
  on conflict (workspace_id, feature)
    do update set granted_by = auth.uid(), granted_at = now(), expires_at = p_expires;
end $$;

create or replace function revoke_feature(p_ws uuid, p_feature text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select role from profiles where id = auth.uid()), '') <> 'admin' then
    raise exception 'platform admin only';
  end if;
  delete from workspace_entitlements where workspace_id = p_ws and feature = p_feature;
end $$;

-- 8. RLS ---------------------------------------------------------------------
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_invites enable row level security;
alter table workspace_entitlements enable row level security;

-- workspaces: members read; create your own; owner/admin update; owner delete.
create policy ws_read on workspaces for select using (is_ws_member(id));
create policy ws_insert on workspaces for insert with check (owner_id = auth.uid());
create policy ws_update on workspaces for update using (ws_role(id) in ('owner','admin'));
create policy ws_delete on workspaces for delete using (ws_role(id) = 'owner');

-- members/invites/entitlements: members READ only; all writes via definer RPCs above.
create policy members_read on workspace_members for select using (is_ws_member(workspace_id));
create policy invites_read on workspace_invites for select using (is_ws_member(workspace_id));
create policy ent_read on workspace_entitlements for select using (is_ws_member(workspace_id));

-- Belt-and-suspenders: no authenticated write grants on the RPC-only tables.
revoke insert, update, delete on workspace_members from authenticated, anon;
revoke insert, update, delete on workspace_invites from authenticated, anon;
revoke insert, update, delete on workspace_entitlements from authenticated, anon;
