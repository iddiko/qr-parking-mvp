create or replace function public.current_profile()
returns table (id uuid, role role_enum, complex_id uuid, building_id uuid, unit_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select id, role, complex_id, building_id, unit_id
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_super()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'SUPER'
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('SUPER', 'MAIN', 'SUB')
  )
$$;

create or replace function public.can_access_complex(target_complex uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.role = 'SUPER' or p.complex_id = target_complex)
  )
$$;

create or replace function public.can_access_building(target_building uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
