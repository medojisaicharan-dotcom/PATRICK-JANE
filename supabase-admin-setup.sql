-- Run this in Supabase SQL Editor after the admin account has signed up.
-- Re-running the final INSERT is safe if the account is added later.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_name text not null,
  patient_email text not null,
  patient_phone text not null,
  doctor_id text not null,
  doctor_name text not null,
  doctor_specialty text not null,
  appointment_date date not null,
  appointment_time text not null,
  consultation_type text not null,
  reason text not null,
  status text not null default 'Pending'
    check (status in ('Pending', 'Confirmed', 'Cancelled', 'Completed')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.appointments enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;
drop policy if exists "Users can check admin membership" on public.admin_users;
create policy "Users can check admin membership"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Patients and admins can read appointments" on public.appointments;
create policy "Patients and admins can read appointments"
  on public.appointments for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Patients can create their own appointments" on public.appointments;
create policy "Patients can create their own appointments"
  on public.appointments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and patient_email = (select auth.jwt() ->> 'email')
    and status = 'Pending'
  );

drop policy if exists "Patients cancel own and admins manage status" on public.appointments;
create policy "Patients cancel own and admins manage status"
  on public.appointments for update to authenticated
  using (
    (select public.is_admin())
    or (user_id = (select auth.uid()) and status in ('Pending', 'Confirmed'))
  )
  with check (
    (select public.is_admin())
    or (user_id = (select auth.uid()) and status = 'Cancelled')
  );

revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;
grant insert (
  booking_code,
  user_id,
  patient_name,
  patient_email,
  patient_phone,
  doctor_id,
  doctor_name,
  doctor_specialty,
  appointment_date,
  appointment_time,
  consultation_type,
  reason,
  status
) on public.appointments to authenticated;
grant update (status) on public.appointments to authenticated;

-- Create this user through the site's signup form first, then run this statement.
insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = lower('medojisaicharan@gmail.com')
on conflict (user_id) do nothing;
