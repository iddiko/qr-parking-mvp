create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_enum') then
    create type role_enum as enum ('SUPER', 'MAIN', 'SUB', 'GUARD', 'RESIDENT');
  end if;
  if not exists (select 1 from pg_type where typname = 'invite_status_enum') then
    create type invite_status_enum as enum ('PENDING', 'SENT', 'ACCEPTED', 'EXPIRED');
  end if;
  if not exists (select 1 from pg_type where typname = 'qr_status_enum') then
    create type qr_status_enum as enum ('INACTIVE', 'ACTIVE');
  end if;
  if not exists (select 1 from pg_type where typname = 'vehicle_type_enum') then
    create type vehicle_type_enum as enum ('EV', 'ICE');
  end if;
  if not exists (select 1 from pg_type where typname = 'scan_result_enum') then
    create type scan_result_enum as enum ('RESIDENT', 'ENFORCEMENT');
  end if;
end$$;

create table if not exists complexes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (complex_id, code)
);

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  unique (building_id, code)
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role role_enum not null,
  complex_id uuid references complexes(id) on delete set null,
  building_id uuid references buildings(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  menu_toggles jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (complex_id)
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null default gen_random_uuid(),
  email text not null,
  role role_enum not null,
  complex_id uuid not null references complexes(id) on delete cascade,
  building_id uuid references buildings(id) on delete set null,
  unit_id uuid references units(id) on delete set null,
  status invite_status_enum not null default 'PENDING',
  sent_at timestamptz,
  accepted_at timestamptz,
  has_vehicle boolean not null default false,
  plate text,
  vehicle_type vehicle_type_enum,
  batch_id uuid,
  location_label_default text,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references profiles(id) on delete cascade,
  plate text not null,
  vehicle_type vehicle_type_enum not null,
  created_at timestamptz not null default now()
);

create table if not exists qrs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  status qr_status_enum not null default 'INACTIVE',
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  qr_id uuid references qrs(id) on delete set null,
  guard_profile_id uuid references profiles(id) on delete set null,
  complex_id uuid references complexes(id) on delete set null,
  location_label text not null,
  result scan_result_enum not null,
  vehicle_plate text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists meter_cycles (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  title text not null,
  start_date date,
  end_date date,
  status text not null default 'OPEN',
  created_at timestamptz not null default now()
);

create table if not exists meter_submissions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references meter_cycles(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  reading_value numeric not null,
  submitted_at timestamptz not null default now()
);

create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references complexes(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);

create index if not exists idx_profiles_complex_id on profiles(complex_id);
create index if not exists idx_buildings_complex_id on buildings(complex_id);
create index if not exists idx_units_building_id on units(building_id);
create index if not exists idx_invites_complex_id on invites(complex_id);
create index if not exists idx_invites_email on invites(email);
create index if not exists idx_vehicles_owner_profile_id on vehicles(owner_profile_id);
create index if not exists idx_qrs_vehicle_id on qrs(vehicle_id);
create index if not exists idx_scans_complex_id on scans(complex_id);
create index if not exists idx_notifications_profile_id on notifications(profile_id);
create index if not exists idx_meter_cycles_complex_id on meter_cycles(complex_id);
create index if not exists idx_meter_submissions_cycle_id on meter_submissions(cycle_id);
create index if not exists idx_notices_complex_id on notices(complex_id);
