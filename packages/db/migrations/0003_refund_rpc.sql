-- Fixes a real bug found via live testing (2026-07-09): credit_transactions has
-- an RLS SELECT policy for owners but no INSERT policy, so the app's refund path
-- (a plain `.insert()` under the session-scoped client) was silently rejected by
-- RLS — a failed generation debited credits and never refunded them. debit_credits
-- already avoids this via SECURITY DEFINER; refund needs the same treatment.
create or replace function refund_credits(p_amount int, p_note text, p_ref_type text, p_ref_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_total int;
begin
  insert into credit_transactions (user_id, amount, kind, bucket, ref_type, ref_id, note)
  values (auth.uid(), p_amount, 'refund', 'purchased', p_ref_type, p_ref_id, p_note);

  select coalesce(sum(amount), 0) into v_total
  from credit_transactions where user_id = auth.uid();
  return v_total;
end $$;
