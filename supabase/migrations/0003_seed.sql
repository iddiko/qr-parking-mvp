insert into complexes (id, name)
values ('10000000-0000-0000-0000-000000000001', 'Sample Complex')
on conflict (id) do nothing;

insert into buildings (id, complex_id, code, name)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'A', 'Building A')
on conflict (id) do nothing;

insert into units (id, building_id, code)
values ('30000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001', '101')
on conflict (id) do nothing;

insert into settings (complex_id, menu_toggles, updated_at)
values (
  '10000000-0000-0000-0000-000000000001',
  '{
    "guard": { "scan": true, "history": true, "notices": true, "mypage": true, "notifications": false },
    "resident": { "myQr": true, "alerts": true, "meter": true, "notices": true, "mypage": true, "notifications": true },
    "sub": { "approvals": true, "parking": true, "meter": true, "notices": true, "settings": false }
  }'::jsonb,
  now()
)
on conflict (complex_id) do update
set menu_toggles = excluded.menu_toggles,
    updated_at = now();

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  (
    '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
    'main@demo.local', crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
    'sub@demo.local', crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
    'guard@demo.local', crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
    'resident@demo.local', crypt('Password123!', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
  )
on conflict (id) do nothing;

insert into profiles (id, role, complex_id, building_id, unit_id, email)
select
  u.id,
  'SUPER',
  '10000000-0000-0000-0000-000000000001',
  null,
  null,
  u.email
from auth.users u
where u.email = 'superadmin@alpro.com'
on conflict (id) do update
set role = excluded.role,
    complex_id = excluded.complex_id,
    building_id = excluded.building_id,
    unit_id = excluded.unit_id,
    email = excluded.email;

insert into profiles (id, role, complex_id, building_id, unit_id, email)
values
  (
    '00000000-0000-0000-0000-000000000002', 'MAIN',
    '10000000-0000-0000-0000-000000000001', null, null, 'main@demo.local'
  ),
  (
    '00000000-0000-0000-0000-000000000003', 'SUB',
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', null, 'sub@demo.local'
  ),
  (
    '00000000-0000-0000-0000-000000000004', 'GUARD',
    '10000000-0000-0000-0000-000000000001', null, null, 'guard@demo.local'
  ),
  (
    '00000000-0000-0000-0000-000000000005', 'RESIDENT',
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000101', 'resident@demo.local'
  )
on conflict (id) do update
set role = excluded.role,
    complex_id = excluded.complex_id,
    building_id = excluded.building_id,
    unit_id = excluded.unit_id,
    email = excluded.email;
