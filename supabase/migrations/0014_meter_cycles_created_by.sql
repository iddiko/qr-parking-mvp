alter table meter_cycles
  add column if not exists created_by uuid references profiles(id);

create index if not exists idx_meter_cycles_created_by
  on meter_cycles (created_by);
