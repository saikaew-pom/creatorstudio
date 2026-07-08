-- Creator Studio — initial schema (docs/03-data-model.md)
-- gen_random_uuid() is core Postgres (v13+) and present on Supabase (v15+),
-- so no pgcrypto extension is required.

-- 1. Identity & plan -----------------------------------------------------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  workspace_name text,
  plan text not null default 'free' check (plan in ('free','pro','business')),
  plan_renews_at timestamptz,
  streak_days int not null default 0,
  last_active_date date,
  active_brand_id uuid,
  preferred_model text not null default 'gemini-2.5-flash',
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('pexels','pixabay','gemini','elevenlabs')),
  secret_id uuid not null,
  status text not null default 'unverified' check (status in ('unverified','valid','invalid')),
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- 2. Brand & Style --------------------------------------------------------
create table brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  data jsonb not null,
  assets jsonb not null default '{}',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table styles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  profile jsonb not null,
  source_samples text[],
  created_at timestamptz not null default now()
);

-- 3. Generations ----------------------------------------------------------
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  kind text not null default 'folder',
  created_at timestamptz not null default now()
);

create table generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  tool text not null,
  title text,
  input jsonb not null,
  output jsonb,
  prompt_id text not null,
  prompt_rendered text,
  model text,
  credits_spent int not null default 0,
  asset_path text,
  status text not null default 'done' check (status in ('queued','running','done','failed')),
  error text,
  niche text,
  platform text[],
  scheduled_date date,
  folder_id uuid references collections(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on generations (user_id, created_at desc);
create index on generations (user_id, scheduled_date) where scheduled_date is not null;

create table generation_versions (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations(id) on delete cascade,
  output jsonb not null,
  instruction text,
  created_at timestamptz not null default now()
);

-- 4. Credits (append-only ledger) ------------------------------------------
create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  kind text not null check (kind in ('purchase','monthly_grant','spend','refund','gift')),
  bucket text not null default 'purchased' check (bucket in ('purchased','monthly')),
  ref_type text,
  ref_id uuid,
  note text,
  created_at timestamptz not null default now()
);
create index on credit_transactions (user_id, created_at desc);
revoke update, delete on credit_transactions from authenticated, anon;

create table model_costs (
  key text primary key,
  credits int not null,
  label_th text not null
);
insert into model_costs (key, credits, label_th) values
  ('image_standard', 1, 'เจนรูป Standard'),
  ('image_pro', 5, 'เจนรูป Pro (ข้อความไทย)'),
  ('video_minute', 2, 'วิดีโอ 1 นาที');

create table daily_usage (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  tool text not null,
  count int not null default 0,
  primary key (user_id, day, tool)
);

-- 5. Video studio -----------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null default 'New Project',
  mode text not null default 'script' check (mode in ('script','upload')),
  script text,
  segments jsonb,
  elements jsonb,
  upload_path text,
  status text not null default 'draft'
    check (status in ('draft','rendering','rendered','exporting','exported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table render_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('preview_render','export')),
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  progress int not null default 0,
  step_label text,
  minutes_charged numeric,
  credits_charged int,
  result_path text,
  error text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on render_jobs (status, created_at);

create table captions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  cards jsonb not null,
  chunk_mode text not null default 'sentence' check (chunk_mode in ('sentence','w4','w3','w2')),
  style jsonb not null,
  updated_at timestamptz not null default now()
);

create table broll_plan (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  items jsonb not null,
  updated_at timestamptz not null default now()
);

create table music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  mood text not null,
  storage_path text not null,
  duration_s int not null,
  is_public boolean not null default true,
  owner_id uuid references profiles(id) on delete cascade
);

create table minute_usage (
  user_id uuid not null references profiles(id) on delete cascade,
  month date not null,
  minutes_used numeric not null default 0,
  primary key (user_id, month)
);

-- 6. Templates & inspiration -------------------------------------------------
create table templates (
  slug text primary key,
  kind text not null check (kind in ('visual','viral')),
  name_th text not null,
  category text not null,
  badges text[] not null default '{}',
  usage_count int not null default 0,
  aspect text,
  uses_brand_kit boolean not null default false,
  renders_thai_text boolean not null default false,
  example_asset text,
  form jsonb not null,
  master_prompt text not null,
  output_blocks jsonb,
  output_schema jsonb,
  is_published boolean not null default false
);

create table inspiration_items (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid references generations(id) on delete set null,
  title text not null,
  author_name text,
  category text,
  asset_path text,
  prompt_public text,
  meta jsonb not null default '{}',
  featured_week date,
  created_at timestamptz not null default now()
);

-- 7. MCP & notifications -------------------------------------------------------
create table mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  token_hash text not null,
  last_used_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  app text not null check (app in ('content','studio')),
  kind text not null,
  title_th text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS ------------------------------------------------------------------------
alter table profiles enable row level security;
alter table user_api_keys enable row level security;
alter table brands enable row level security;
alter table styles enable row level security;
alter table collections enable row level security;
alter table generations enable row level security;
alter table generation_versions enable row level security;
alter table credit_transactions enable row level security;
alter table daily_usage enable row level security;
alter table projects enable row level security;
alter table render_jobs enable row level security;
alter table captions enable row level security;
alter table broll_plan enable row level security;
alter table minute_usage enable row level security;
alter table mcp_tokens enable row level security;
alter table notifications enable row level security;
alter table templates enable row level security;
alter table inspiration_items enable row level security;
alter table music_tracks enable row level security;
alter table model_costs enable row level security;

create policy own_profile on profiles for all using (id = auth.uid());
create policy own_rows_keys on user_api_keys for all using (user_id = auth.uid());
create policy own_rows_brands on brands for all using (user_id = auth.uid());
create policy own_rows_styles on styles for all using (user_id = auth.uid());
create policy own_rows_collections on collections for all using (user_id = auth.uid());
create policy own_rows_generations on generations for all using (user_id = auth.uid());
create policy own_rows_genver on generation_versions for all
  using (exists (select 1 from generations g where g.id = generation_id and g.user_id = auth.uid()));
create policy own_read_credits on credit_transactions for select using (user_id = auth.uid());
create policy own_rows_daily on daily_usage for select using (user_id = auth.uid());
create policy own_rows_projects on projects for all using (user_id = auth.uid());
create policy own_rows_jobs on render_jobs for select using (user_id = auth.uid());
create policy own_rows_captions on captions for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
create policy own_rows_broll on broll_plan for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));
create policy own_rows_minutes on minute_usage for select using (user_id = auth.uid());
create policy own_rows_tokens on mcp_tokens for all using (user_id = auth.uid());
create policy own_rows_notifs on notifications for all using (user_id = auth.uid());
create policy public_read_templates on templates for select using (is_published = true);
create policy public_read_inspiration on inspiration_items for select using (true);
create policy public_read_music on music_tracks for select using (is_public = true);
create policy public_read_costs on model_costs for select using (true);

-- RPCs ------------------------------------------------------------------------
-- Daily free-quota consume (doc 03 invariant 6)
create or replace function try_consume_daily_use(p_tool text, p_limit int)
returns int language plpgsql security definer as $$
declare v_count int;
begin
  insert into daily_usage (user_id, day, tool, count)
  values (auth.uid(), current_date, p_tool, 1)
  on conflict (user_id, day, tool)
  do update set count = daily_usage.count + 1
  where daily_usage.count < p_limit
  returning count into v_count;
  if v_count is null then
    return -1; -- limit reached
  end if;
  return p_limit - v_count; -- remaining
end $$;

-- Atomic credit debit (monthly bucket first, then purchased)
create or replace function debit_credits(p_amount int, p_note text, p_ref_type text, p_ref_id uuid)
returns int language plpgsql security definer as $$
declare v_monthly int; v_purchased int; v_from_monthly int;
begin
  select coalesce(sum(amount) filter (where bucket='monthly'),0),
         coalesce(sum(amount) filter (where bucket='purchased'),0)
    into v_monthly, v_purchased
    from credit_transactions where user_id = auth.uid();
  if v_monthly + v_purchased < p_amount then return -1; end if;
  v_from_monthly := least(v_monthly, p_amount);
  if v_from_monthly > 0 then
    insert into credit_transactions (user_id, amount, kind, bucket, ref_type, ref_id, note)
    values (auth.uid(), -v_from_monthly, 'spend', 'monthly', p_ref_type, p_ref_id, p_note);
  end if;
  if p_amount - v_from_monthly > 0 then
    insert into credit_transactions (user_id, amount, kind, bucket, ref_type, ref_id, note)
    values (auth.uid(), -(p_amount - v_from_monthly), 'spend', 'purchased', p_ref_type, p_ref_id, p_note);
  end if;
  return v_monthly + v_purchased - p_amount;
end $$;

create or replace function increment_template_usage(p_slug text)
returns void language sql security definer as $$
  update templates set usage_count = usage_count + 1 where slug = p_slug;
$$;
