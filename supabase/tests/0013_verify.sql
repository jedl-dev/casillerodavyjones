-- Auto-check de la migración 0013.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'question_reports' and column_name = 'resolved_at'
  ) then
    raise exception 'Falta question_reports.resolved_at';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'question_reports'
      and cmd = 'UPDATE' and 'authenticated' = any (roles)
  ) then
    raise exception 'Falta la política de actualización del admin en question_reports';
  end if;

  raise notice 'verify: ok';
end $$;
