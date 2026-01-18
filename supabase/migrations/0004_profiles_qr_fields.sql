alter table profiles
  add column if not exists name text,
  add column if not exists phone text;

alter table qrs
  add column if not exists expires_at timestamptz;
