alter table profiles
  add column if not exists has_vehicle boolean not null default true;

update profiles
set has_vehicle = true
where has_vehicle is null;
