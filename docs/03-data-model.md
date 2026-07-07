# 03 — DATA MODEL (Supabase / Postgres)

All tables RLS-enabled: `user_id = auth.uid()` for owner tables; templates/inspiration are
public-read, admin-write. Timestamps `created_at/updated_at` everywhere (omitted below).

## 1. Identity & plan

```sql
create table profiles (
  id uuid primary key references auth.users,
  display_name text, workspace_name text,          -- "PomSK" / "คลังแสง"
  plan text not null default 'free',               -- free | pro | business
  plan_renews_at timestamptz,
  streak_days int default 0, last_active_date date,
  active_brand_id uuid, preferred_model text default 'gemini-2.5-flash',
  role text default 'user'                         -- user | admin
);

create table user_api_keys (                        -- BYO keys, encrypted via vault
  id uuid pk, user_id uuid, provider text,          -- pexels | pixabay | gemini | elevenlabs
  secret_id uuid not null,                          -- supabase vault reference — NEVER plaintext
  status text default 'unverified',                 -- unverified | valid | invalid
  last_tested_at timestamptz,
  unique (user_id, provider)
);
```

## 2. Brand & Style

```sql
create table brands (
  id uuid pk, user_id uuid, name text,
  data jsonb not null,           -- BrandSchema (doc 02 §BV) incl. confidence map
  assets jsonb default '{}',     -- {logo, person, sign, banner: storage paths, colors: [hex]}
  is_active bool default false
);

create table styles (
  id uuid pk, user_id uuid, name text,
  profile jsonb not null,        -- StyleProfileSchema (doc 02 §SC)
  source_samples text[]          -- kept for re-analysis; never shown to other users
);
```

## 3. Generations (the universal asset table — App A)

```sql
create table generations (
  id uuid pk, user_id uuid,
  type text not null,            -- content_kit | image | viral_kit | brainstorm | brand_fill | style_clone
  tool text not null,            -- content_studio | image_studio | viral_studio | ...
  title text,                    -- topic_refined or user prompt excerpt
  input jsonb not null,          -- full form input incl. brand_id/style_id/template slug
  output jsonb,                  -- schema-validated result (latest version)
  prompt_id text not null,       -- e.g. "content.kit.v1" (P1 reproducibility)
  prompt_rendered text,          -- final prompt sent (for image gens: the English prompt)
  model text, credits_spent int default 0,
  asset_path text,               -- storage path for images/audio
  status text default 'done',    -- queued | running | done | failed
  error text,
  niche text, platform text[],   -- denormalized for /history filters
  scheduled_date date,           -- content calendar placement
  folder_id uuid references collections
);

create table generation_versions (   -- refine history → undo
  id uuid pk, generation_id uuid, output jsonb, instruction text, created_at timestamptz
);

create table collections ( id uuid pk, user_id uuid, name text, kind text default 'folder' );
```

## 4. Credits (ledger — BLUEPRINT P6)

```sql
create table credit_transactions (
  id uuid pk, user_id uuid,
  amount int not null,               -- +540 purchase, -1 image, -5 pro image, -2/min video
  kind text not null,                -- purchase | monthly_grant | spend | refund | gift
  bucket text not null default 'purchased',  -- purchased (permanent) | monthly (expires)
  ref_type text, ref_id uuid,        -- what it paid for (generation/job)
  note text                          -- "ใช้เจนรูป · Image Studio"
);
-- balance = sum(amount) per bucket; spend order: monthly first, then purchased.
-- Debit BEFORE provider call inside a transaction; refund row on failure.

create table model_costs (
  key text primary key,              -- image_standard | image_pro | video_minute | music_gen ...
  credits int not null, label_th text
);

create table daily_usage (           -- free-quota counting ("ใช้ 9/30 วันนี้")
  user_id uuid, day date, tool text, count int,
  primary key (user_id, day, tool)
);
```

## 5. Video studio (App B)

```sql
create table projects (
  id uuid pk, user_id uuid, name text default 'New Project',
  mode text default 'script',            -- script | upload
  script text,                           -- raw textarea content
  segments jsonb,                        -- [{idx,type:'hook'|'body',text,est_start,est_end}]
  elements jsonb,                        -- {broll_tier, voice:{provider,voice_id,name}, music:{mood,track_id}|null, avatar:'faceless'|{...}}
  upload_path text,                      -- own-clip mode source
  status text default 'draft'            -- draft | rendering | rendered | exporting | exported
);

create table render_jobs (
  id uuid pk, project_id uuid, user_id uuid,
  kind text not null,                    -- preview_render | export
  status text default 'queued',          -- queued | running | done | failed
  progress int default 0, step_label text,   -- "กำลังสร้างเสียงพากย์", "กำลังฝังซับ"
  minutes_charged numeric, credits_charged int,
  result_path text, error text,
  payload jsonb                          -- frozen inputs at enqueue time
);

create table captions (
  id uuid pk, project_id uuid,
  cards jsonb not null,                  -- [{idx,start_ms,end_ms,text,type:'hook'|'normal'}]
  chunk_mode text default 'sentence',    -- sentence | w4 | w3 | w2
  style jsonb not null                   -- full style state (doc 04 §6 CaptionStyle)
);

create table broll_plan (
  id uuid pk, project_id uuid,
  items jsonb not null                   -- [{seg_idx,keyword,alts,vibe,source:'pexels'|'pixabay',video_url,in_ms,out_ms}]
);

create table music_tracks (              -- house library (22 seeded)
  id uuid pk, title text, mood text,     -- mood = the 6 chips
  storage_path text, duration_s int, is_public bool default true
);

create table minute_usage (
  user_id uuid, month date, minutes_used numeric, primary key (user_id, month)
);
```

## 6. Templates & inspiration (public content)

```sql
create table templates (
  slug text pk, kind text,               -- visual | viral
  name_th text, category text, badges text[],
  usage_count int default 0,
  aspect text, uses_brand_kit bool, renders_thai_text bool,
  example_asset text, form jsonb, master_prompt text, output_blocks jsonb,
  output_schema jsonb,                   -- zod-json for viral kits
  is_published bool default false
);

create table inspiration_items (
  id uuid pk, generation_id uuid,        -- source (with owner consent flag)
  title text, author_name text, category text,
  asset_path text, prompt_public text,   -- the visible prompt
  meta jsonb,                            -- {model, credits, aspect, tier}
  featured_week date                     -- non-null = HERO OF THE WEEK candidate
);
```

## 7. MCP & tokens

```sql
create table mcp_tokens (
  id uuid pk, user_id uuid, name text, token_hash text, last_used_at timestamptz, revoked bool default false
);
create table notifications (
  id uuid pk, user_id uuid, app text, kind text, title_th text, link text, read bool default false
);
```

## 8. Key invariants (enforce in code/db)

1. `credit_transactions` is append-only (no UPDATE/DELETE grants).
2. A render job charges minutes at **enqueue** (`ceil(est_seconds/60)`), reconciles at
   completion to actual, refunds difference; failed job = full refund row.
3. `generations.output` must have passed zod validation for its `prompt_id` — store the
   schema version alongside.
4. Template `usage_count` incremented via RPC on successful generation only.
5. Renders auto-delete at plan retention (cron): storage object + `result_path=null`,
   keep the row for history.
6. Daily quota check + increment happen in one RPC (`try_consume_daily_use(tool)`) to avoid
   races; returns remaining count for the "เหลือ n ครั้งวันนี้" banner.
```
