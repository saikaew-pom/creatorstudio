-- M17 (docs/08-content-redesign.md): two independent additions, bundled because both
-- are needed for the content-app MCP server + Settings page.
--
-- 1. MCP-safe credit RPCs. debit_credits/refund_credits (0001/0003) resolve the ledger
--    owner via auth.uid() — correct for session-scoped calls, but the MCP route
--    authenticates via a bearer token and calls out through the ADMIN (service-role)
--    client, which has no session/JWT, so auth.uid() would read NULL there. Rather than
--    silently writing user_id=NULL (or worse, whichever session happens to be live),
--    these explicit-user-id variants exist ONLY for trusted server code and are locked
--    to service_role — an authenticated client can never call them (would let a session
--    debit an arbitrary other user's balance by passing any p_user_id).
--
-- 2. BYO API keys via Supabase Vault. user_api_keys (0001_init.sql) already has the
--    shape for this (secret_id uuid, not a plaintext column) but no RPCs existed yet to
--    actually read/write through Vault. save/delete/status are auth.uid()-scoped and
--    authenticated-callable; the plaintext read is service_role-only (the worker/API
--    routes use it server-side to call Pexels/Pixabay on the user's behalf — it must
--    never reach the browser).

-- ---- MCP-safe credit RPCs ----
create or replace function debit_credits_for_user(p_user_id uuid, p_amount int, p_note text, p_ref_type text, p_ref_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_monthly int; v_purchased int; v_from_monthly int;
begin
  select coalesce(sum(amount) filter (where bucket='monthly'),0),
         coalesce(sum(amount) filter (where bucket='purchased'),0)
    into v_monthly, v_purchased
    from credit_transactions where user_id = p_user_id;
  if v_monthly + v_purchased < p_amount then return -1; end if;
  v_from_monthly := least(v_monthly, p_amount);
  if v_from_monthly > 0 then
    insert into credit_transactions (user_id, amount, kind, bucket, ref_type, ref_id, note)
    values (p_user_id, -v_from_monthly, 'spend', 'monthly', p_ref_type, p_ref_id, p_note);
  end if;
  if p_amount - v_from_monthly > 0 then
    insert into credit_transactions (user_id, amount, kind, bucket, ref_type, ref_id, note)
    values (p_user_id, -(p_amount - v_from_monthly), 'spend', 'purchased', p_ref_type, p_ref_id, p_note);
  end if;
  return v_monthly + v_purchased - p_amount;
end $$;
revoke execute on function debit_credits_for_user(uuid, int, text, text, uuid) from public, anon, authenticated;
grant execute on function debit_credits_for_user(uuid, int, text, text, uuid) to service_role;

create or replace function refund_credits_for_user(p_user_id uuid, p_amount int, p_note text, p_ref_type text, p_ref_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  insert into credit_transactions (user_id, amount, kind, bucket, ref_type, ref_id, note)
  values (p_user_id, p_amount, 'refund', 'purchased', p_ref_type, p_ref_id, p_note);
  select coalesce(sum(amount), 0) into v_total from credit_transactions where user_id = p_user_id;
  return v_total;
end $$;
revoke execute on function refund_credits_for_user(uuid, int, text, text, uuid) from public, anon, authenticated;
grant execute on function refund_credits_for_user(uuid, int, text, text, uuid) to service_role;

-- Same auth.uid() gap for the daily free-quota RPC (0001) — the content-app MCP tool
-- generate_content_kit calls a real Gemini request, and the daily quota is the ONLY
-- cost control on that path (unlike video creation, which studio's MCP already gates
-- via a direct minutes-table read rather than an RPC), so this one needs closing too.
create or replace function try_consume_daily_use_for_user(p_user_id uuid, p_tool text, p_limit int)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  insert into daily_usage (user_id, day, tool, count)
  values (p_user_id, current_date, p_tool, 1)
  on conflict (user_id, day, tool)
  do update set count = daily_usage.count + 1
  where daily_usage.count < p_limit
  returning count into v_count;
  if v_count is null then
    return -1;
  end if;
  return p_limit - v_count;
end $$;
revoke execute on function try_consume_daily_use_for_user(uuid, text, int) from public, anon, authenticated;
grant execute on function try_consume_daily_use_for_user(uuid, text, int) to service_role;

-- ---- BYO API keys (Vault-backed; user_api_keys table already exists, 0001_init.sql) ----

create or replace function save_api_key(p_provider text, p_secret text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_existing uuid; v_new_secret_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select secret_id into v_existing from user_api_keys where user_id = auth.uid() and provider = p_provider;
  if v_existing is not null then
    perform vault.update_secret(v_existing, p_secret);
    update user_api_keys set status = 'unverified', last_tested_at = null
      where user_id = auth.uid() and provider = p_provider;
  else
    v_new_secret_id := vault.create_secret(p_secret, 'user_api_key:' || auth.uid()::text || ':' || p_provider);
    insert into user_api_keys (user_id, provider, secret_id, status)
      values (auth.uid(), p_provider, v_new_secret_id, 'unverified');
  end if;
end $$;
revoke execute on function save_api_key(text, text) from public, anon;
grant execute on function save_api_key(text, text) to authenticated;

create or replace function delete_api_key(p_provider text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_secret_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select secret_id into v_secret_id from user_api_keys where user_id = auth.uid() and provider = p_provider;
  if v_secret_id is not null then
    delete from user_api_keys where user_id = auth.uid() and provider = p_provider;
    delete from vault.secrets where id = v_secret_id;
  end if;
end $$;
revoke execute on function delete_api_key(text) from public, anon;
grant execute on function delete_api_key(text) to authenticated;

create or replace function get_api_key_status()
returns table(provider text, last4 text, status text, last_tested_at timestamptz)
language plpgsql security definer set search_path = public, vault as $$
begin
  return query
    select k.provider, right(vs.decrypted_secret, 4) as last4, k.status, k.last_tested_at
    from user_api_keys k
    join vault.decrypted_secrets vs on vs.id = k.secret_id
    where k.user_id = auth.uid();
end $$;
revoke execute on function get_api_key_status() from public, anon;
grant execute on function get_api_key_status() to authenticated;

-- Service-role only: the actual plaintext key, for the worker/API routes to use when
-- calling a third-party provider on the user's behalf. NEVER granted to authenticated —
-- this is the one function in this file that returns a real secret value.
create or replace function get_decrypted_api_key_for_user(p_user_id uuid, p_provider text)
returns text language plpgsql security definer set search_path = public, vault as $$
declare v_secret text;
begin
  select vs.decrypted_secret into v_secret
  from user_api_keys k join vault.decrypted_secrets vs on vs.id = k.secret_id
  where k.user_id = p_user_id and k.provider = p_provider;
  return v_secret;
end $$;
revoke execute on function get_decrypted_api_key_for_user(uuid, text) from public, anon, authenticated;
grant execute on function get_decrypted_api_key_for_user(uuid, text) to service_role;
