create table if not exists profile_phones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  phone text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_profile_phones_profile_id on profile_phones(profile_id);

alter table profile_phones enable row level security;

create policy profile_phones_select_self on profile_phones
  for select using (profile_id = auth.uid());

create policy profile_phones_write_self on profile_phones
  for insert with check (profile_id = auth.uid());

create policy profile_phones_update_self on profile_phones
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy profile_phones_delete_self on profile_phones
  for delete using (profile_id = auth.uid());
