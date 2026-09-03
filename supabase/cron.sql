-- =========================================================
--  Расписание для плановых уведомлений
--  Запускать в SQL Editor ПОСЛЕ того, как выложена функция
--  cron-reminders и задан секрет CRON_SECRET.
--
--  Замените ВАШ_CRON_SECRET на то же значение, что задано
--  в секретах Edge Functions.
-- =========================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- если расписание уже было — снимаем старое
select cron.unschedule('nash-treker-reminders')
where exists (select 1 from cron.job where jobname = 'nash-treker-reminders');

select cron.schedule(
  'nash-treker-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://fprakrtvlyrbojiojsdo.supabase.co/functions/v1/cron-reminders',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-cron-secret', 'ВАШ_CRON_SECRET'
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- Раз в сутки подчищаем журнал отправленных уведомлений
select cron.unschedule('nash-treker-cleanup')
where exists (select 1 from cron.job where jobname = 'nash-treker-cleanup');

select cron.schedule(
  'nash-treker-cleanup',
  '17 3 * * *',
  $$ delete from public.notification_log where sent_at < now() - interval '30 days' $$
);

-- Посмотреть расписание:        select * from cron.job;
-- Посмотреть последние запуски: select * from cron.job_run_details order by start_time desc limit 20;
