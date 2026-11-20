-- Migración 0013: marcar reportes como revisados desde el panel.
-- Ejecutar después de 0012_username_accents.sql.

alter table public.question_reports
  add column if not exists resolved_at timestamptz;

drop policy if exists question_reports_admin_update on public.question_reports;
create policy question_reports_admin_update on public.question_reports
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant update on public.question_reports to authenticated;
