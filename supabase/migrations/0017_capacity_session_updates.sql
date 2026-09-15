-- =============================================================================
-- Migration 0017: atomic capacity session / quantity updates
--
-- Lets a customer change the guest count on their own capacity booking
-- (2 -> 3, 3 -> 2) or move to another departure with a new quantity,
-- without double-counting their current reservation and without
-- overselling the session.
--
-- The `update_booking_session` RPC runs as a single transaction:
--   1. locks the booking row (FOR UPDATE),
--   2. locks the target session row (FOR UPDATE),
--   3. sums OTHER active bookings on the target session (this booking
--      excluded, so its seats are never double-counted),
--   4. rejects over-capacity / invalid requests with stable codes,
--   5. updates session_id, quantity and times atomically.
--
-- Lock order is always booking-then-session, matching create_booking's
-- session-lock discipline, so concurrent guests can never oversell.
-- Only 'confirmed' and 'rescheduled' statuses block capacity — the same
-- list as BLOCKING_BOOKING_STATUSES in src/lib/server/database.ts.
-- =============================================================================

create or replace function public.update_booking_session(
  p_booking_id uuid,
  p_session_id uuid,
  p_quantity   integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking      public.bookings;
  v_session      public.booking_sessions;
  v_others       integer;
  v_same_session boolean;
begin
  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  -- Lock the booking first (consistent global lock order).
  select * into v_booking
    from public.bookings
   where id = p_booking_id
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'BOOKING_INVALID');
  end if;

  if v_booking.status not in ('confirmed', 'rescheduled') then
    return jsonb_build_object('ok', false, 'code', 'BOOKING_INVALID');
  end if;

  if v_booking.session_id is null then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  -- Lock the target session; it must be active.
  select * into v_session
    from public.booking_sessions s
   where s.id = p_session_id
     and s.active = true
     for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'SESSION_NOT_FOUND');
  end if;

  -- Never move a booking across businesses or services inside this RPC.
  if v_session.business_id <> v_booking.business_id then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  if v_session.service_id <> v_booking.service_id then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  if p_quantity > v_session.capacity then
    return jsonb_build_object('ok', false, 'code', 'VALIDATION');
  end if;

  -- Other active bookings on the target session, excluding THIS booking,
  -- so the customer's currently held seats are never double-counted.
  -- Effective capacity for this customer = capacity - others (their own
  -- seats are implicitly included in that remainder).
  select coalesce(sum(b.quantity), 0) into v_others
    from public.bookings b
   where b.session_id = p_session_id
     and b.status in ('confirmed', 'rescheduled')
     and b.id <> p_booking_id;

  if v_others + p_quantity > v_session.capacity then
    return jsonb_build_object('ok', false, 'code', 'CAPACITY_FULL');
  end if;

  v_same_session := (v_booking.session_id = p_session_id);

  update public.bookings
     set previous_start_time = case when v_same_session then previous_start_time else start_time end,
         session_id          = p_session_id,
         quantity            = p_quantity,
         start_time          = v_session.start_time,
         end_time            = coalesce(v_session.end_time, v_session.start_time),
         status              = 'rescheduled',
         updated_at          = now()
   where id = p_booking_id
  returning * into v_booking;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end;
$$;
