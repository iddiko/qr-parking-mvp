alter table qrs
  alter column expires_at set default (now() + interval '365 days');

update qrs
set expires_at = created_at + interval '365 days'
where expires_at is null;
