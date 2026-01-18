create or replace function public.current_profile()
returns table (id uuid, role role_enum, complex_id uuid, building_id uuid, unit_id uuid)
language sql stable as $$
  select id, role, complex_id, building_id, unit_id
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_super()
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'SUPER'
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('SUPER', 'MAIN', 'SUB')
  )
$$;

create or replace function public.can_access_complex(target_complex uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'SUPER' or p.complex_id = target_complex)
  )
$$;

create or replace function public.can_access_building(target_building uuid)
returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'SUPER'
        or p.role = 'MAIN'
        or (p.role = 'SUB' and p.building_id = target_building)
      )
  )
$$;

alter table complexes enable row level security;
alter table buildings enable row level security;
alter table units enable row level security;
alter table profiles enable row level security;
alter table settings enable row level security;
alter table invites enable row level security;
alter table vehicles enable row level security;
alter table qrs enable row level security;
alter table scans enable row level security;
alter table notifications enable row level security;
alter table meter_cycles enable row level security;
alter table meter_submissions enable row level security;
alter table notices enable row level security;

create policy complexes_select on complexes
  for select using (public.can_access_complex(id));

create policy buildings_select on buildings
  for select using (public.can_access_complex(complex_id));

create policy units_select on units
  for select using (
    exists (
      select 1
      from public.buildings b
      where b.id = units.building_id
        and public.can_access_complex(b.complex_id)
    )
  );

create policy profiles_select_self on profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on profiles
  for select using (public.is_admin() and public.can_access_complex(complex_id));

create policy profiles_update_self on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy settings_select on settings
  for select using (public.can_access_complex(complex_id));

create policy settings_admin_write on settings
  for insert with check (public.is_admin() and public.can_access_complex(complex_id));

create policy settings_admin_update on settings
  for update using (public.is_admin() and public.can_access_complex(complex_id))
  with check (public.is_admin() and public.can_access_complex(complex_id));

create policy invites_select on invites
  for select using (public.is_admin() and public.can_access_complex(complex_id));

create policy invites_write on invites
  for insert with check (public.is_admin() and public.can_access_complex(complex_id));

create policy invites_update on invites
  for update using (public.is_admin() and public.can_access_complex(complex_id))
  with check (public.is_admin() and public.can_access_complex(complex_id));

create policy vehicles_select on vehicles
  for select using (
    owner_profile_id = auth.uid()
    or public.is_admin()
  );

create policy vehicles_write on vehicles
  for insert with check (
    owner_profile_id = auth.uid()
    or public.is_admin()
  );

create policy vehicles_update on vehicles
  for update using (
    owner_profile_id = auth.uid()
    or public.is_admin()
  )
  with check (
    owner_profile_id = auth.uid()
    or public.is_admin()
  );

create policy qrs_select on qrs
  for select using (
    exists (
      select 1
      from public.vehicles v
      where v.id = qrs.vehicle_id
        and (v.owner_profile_id = auth.uid() or public.is_admin())
    )
  );

create policy qrs_write on qrs
  for insert with check (public.is_admin());

create policy qrs_update on qrs
  for update using (public.is_admin())
  with check (public.is_admin());

create policy scans_select on scans
  for select using (public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'GUARD' and p.complex_id = scans.complex_id
  ));

create policy scans_insert on scans
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'GUARD' and p.complex_id = scans.complex_id
    )
  );

create policy notifications_select on notifications
  for select using (profile_id = auth.uid());

create policy notifications_insert on notifications
  for insert with check (public.is_admin() or profile_id = auth.uid());

create policy meter_cycles_select on meter_cycles
  for select using (public.can_access_complex(complex_id));

create policy meter_cycles_write on meter_cycles
  for insert with check (public.is_admin() and public.can_access_complex(complex_id));

create policy meter_cycles_update on meter_cycles
  for update using (public.is_admin() and public.can_access_complex(complex_id))
  with check (public.is_admin() and public.can_access_complex(complex_id));

create policy meter_submissions_select on meter_submissions
  for select using (
    profile_id = auth.uid()
    or public.is_admin()
  );

create policy meter_submissions_write on meter_submissions
  for insert with check (
    profile_id = auth.uid()
    or public.is_admin()
  );

create policy notices_select on notices
  for select using (public.can_access_complex(complex_id));

create policy notices_write on notices
  for insert with check (public.is_admin() and public.can_access_complex(complex_id));

create policy notices_update on notices
  for update using (public.is_admin() and public.can_access_complex(complex_id))
  with check (public.is_admin() and public.can_access_complex(complex_id));
