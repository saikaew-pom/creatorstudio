-- M15b — Campaign Mode (docs/08-content-redesign.md): one topic → a 7-day content
-- calendar, saved so it can be replayed into the studio flow one day at a time.
-- Personal table (user_id-scoped), same RLS idiom as generations/projects — additive,
-- doesn't touch any existing table.

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  topic text not null,
  niche text,
  days jsonb not null, -- DayPlan[7]: { day, goal_th, template, topic_line, hook }
  credits_spent int not null default 0,
  created_at timestamptz not null default now()
);
create index on campaigns (user_id, created_at desc);

alter table campaigns enable row level security;
create policy own_rows_campaigns on campaigns for all using (user_id = auth.uid());
