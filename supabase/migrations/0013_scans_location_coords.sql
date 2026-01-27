alter table scans
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision;
