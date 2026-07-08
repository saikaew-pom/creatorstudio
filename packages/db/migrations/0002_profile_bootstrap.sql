-- Auto-provision a profile + initial monthly credit grant when a user signs up.
-- Fires on auth.users insert (Supabase's signup path). SECURITY DEFINER so it can
-- write to profiles/credit_transactions regardless of the (not-yet-authenticated) caller.

-- Monthly free-tier image-credit grant (doc 01 §9: free = 20/mo).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Monthly grant top-up (idempotent per user per month) — call from a scheduled job.
-- Grants the plan's monthly image credits and expires unused monthly credits from
-- prior months by zeroing them out via an offsetting row.
create or replace function grant_monthly_credits(p_user uuid, p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare v_amount int; v_this_month date := date_trunc('month', now())::date;
begin
  v_amount := case p_plan when 'business' then 150 when 'pro' then 50 else 20 end;
  -- skip if already granted this month
  if exists (
    select 1 from credit_transactions
    where user_id = p_user and kind = 'monthly_grant' and bucket = 'monthly'
      and created_at >= v_this_month
  ) then
    return;
  end if;
  -- expire leftover monthly credits (offset current monthly balance to zero)
  insert into credit_transactions (user_id, amount, kind, bucket, note)
  select p_user, -coalesce(sum(amount), 0), 'spend', 'monthly', 'หมดอายุสิ้นเดือน'
  from credit_transactions
  where user_id = p_user and bucket = 'monthly'
  having coalesce(sum(amount), 0) > 0;
  -- grant this month
  insert into credit_transactions (user_id, amount, kind, bucket, note)
  values (p_user, v_amount, 'monthly_grant', 'monthly', 'เครดิตรายเดือน');
end $$;
