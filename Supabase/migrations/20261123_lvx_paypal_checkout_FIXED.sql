-- LVX PayPal Sandbox checkout for the existing all five correctional courses.
-- Does not alter existing courses, enrollments, or administrator grant functions.

create table if not exists public.lvx_payment_orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  course_code text not null,
  access_days integer not null check (access_days in (30, 60, 90)),
  amount_cents integer not null check (
    (access_days = 30 and amount_cents = 5900) or
    (access_days = 60 and amount_cents = 7900) or
    (access_days = 90 and amount_cents = 9900)
  ),
  currency text not null default 'USD' check (currency = 'USD'),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Reapply the allowlist safely whether this is a fresh install or an update
-- from the earlier ENTRY-only draft of this migration.
alter table public.lvx_payment_orders
  drop constraint if exists lvx_payment_orders_course_code_check;
alter table public.lvx_payment_orders
  drop constraint if exists lvx_payment_orders_course_code_allowlist;
alter table public.lvx_payment_orders
  add constraint lvx_payment_orders_course_code_allowlist
  check (course_code in ('ENTRY', 'SERGEANT', 'LIEUTENANT', 'CAPTAIN', 'CHIEF'));

create index if not exists lvx_payment_orders_student_created_idx
  on public.lvx_payment_orders(student_id, created_at desc);

alter table public.lvx_payment_orders enable row level security;
revoke all on table public.lvx_payment_orders from anon, authenticated;
grant all on table public.lvx_payment_orders to service_role;

create or replace function public.lvx_fulfill_paypal_order(
  p_payment_order_id uuid,
  p_paypal_capture_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.lvx_payment_orders%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_now timestamptz := now();
  v_base timestamptz;
  v_start timestamptz;
  v_expiration timestamptz;
begin
  if p_paypal_capture_id is null or length(trim(p_paypal_capture_id)) = 0 then
    raise exception 'A verified PayPal capture ID is required';
  end if;

  select *
    into v_order
    from public.lvx_payment_orders
   where id = p_payment_order_id
   for update;

  if not found then
    raise exception 'Payment order not found';
  end if;

  if v_order.status = 'completed' then
    select *
      into v_enrollment
      from public.enrollments
     where student_id = v_order.student_id
       and course_id = v_order.course_id;

    return jsonb_build_object(
      'status', 'already_fulfilled',
      'course_code', v_order.course_code,
      'expiration_date', v_enrollment.expiration_date
    );
  end if;

  if v_order.status <> 'pending' then
    raise exception 'Payment order is not pending';
  end if;

  if exists (
    select 1 from public.lvx_payment_orders
     where paypal_capture_id = p_paypal_capture_id
       and id <> p_payment_order_id
  ) then
    raise exception 'PayPal capture has already been used';
  end if;

  select *
    into v_enrollment
    from public.enrollments
   where student_id = v_order.student_id
     and course_id = v_order.course_id
   for update;

  if found and v_enrollment.status = 'active'
     and v_enrollment.expiration_date > v_now then
    v_base := v_enrollment.expiration_date;
    v_start := v_enrollment.start_date;
  else
    v_base := v_now;
    v_start := v_now;
  end if;

  v_expiration := v_base + (v_order.access_days * interval '1 day');

  insert into public.enrollments (
    student_id, course_id, start_date, expiration_date, status
  )
  values (
    v_order.student_id, v_order.course_id, v_start, v_expiration, 'active'
  )
  on conflict (student_id, course_id)
  do update set
    start_date = excluded.start_date,
    expiration_date = excluded.expiration_date,
    status = 'active';

  update public.lvx_payment_orders
     set status = 'completed',
         paypal_capture_id = p_paypal_capture_id,
         completed_at = v_now
   where id = p_payment_order_id;

  return jsonb_build_object(
    'status', 'completed',
    'course_code', v_order.course_code,
    'access_days_added', v_order.access_days,
    'expiration_date', v_expiration
  );
end;
$function$;

revoke all on function public.lvx_fulfill_paypal_order(uuid, text) from public, anon, authenticated;
grant execute on function public.lvx_fulfill_paypal_order(uuid, text) to service_role;
