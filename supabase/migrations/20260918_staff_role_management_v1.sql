-- Staff / Role Management V1
-- Canonical authorization remains public.profile_roles; this migration adds only staff metadata,
-- protected audit/invitation records, and a worker-controlled avatar bucket.

alter table public.profiles
  add column if not exists job_title text,
  add column if not exists staff_active boolean,
  add column if not exists employment_start_date date;

create table if not exists public.staff_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists staff_audit_log_target_idx on public.staff_audit_log(target_user_id, created_at desc);
create index if not exists staff_audit_log_actor_idx on public.staff_audit_log(actor_user_id, created_at desc);
alter table public.staff_audit_log enable row level security;

create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid references auth.users(id) on delete cascade,
  invited_email text not null,
  role_id uuid not null references public.roles(id),
  invited_by_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'sent' check (status in ('sent','accepted','revoked','expired')),
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);
create index if not exists staff_invitations_email_idx on public.staff_invitations(lower(invited_email), sent_at desc);
create index if not exists staff_invitations_target_idx on public.staff_invitations(target_user_id, sent_at desc);
alter table public.staff_invitations enable row level security;

insert into storage.buckets(id, name, public)
values ('staff-avatars', 'staff-avatars', true)
on conflict (id) do update set public = true;
