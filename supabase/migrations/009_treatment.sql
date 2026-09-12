-- =========================================================
--  Лечение: препараты с расписанием и вехи курса
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

create table if not exists public.meds (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  emoji         text not null default '💊',
  color         text not null default 'teal',
  dose          text,                       -- «1 таблетка», «тонким слоем»
  note          text,
  schedule_type text not null default 'daily'
                check (schedule_type in ('daily', 'times_per_week', 'weekdays', 'every_n_days', 'monthly')),
  target_per_week int  not null default 7 check (target_per_week between 1 and 7),
  weekdays      int[]  not null default '{1,2,3,4,5,6,7}',
  every_n_days  int    not null default 2 check (every_n_days between 2 and 60),
  day_of_month  int    check (day_of_month is null or day_of_month between 1 and 31),
  times         time[] not null default '{09:00}',   -- приёмы в течение дня
  start_date    date   not null default current_date,
  end_date      date,                       -- null = до отмены
  reminder      boolean not null default true,
  status        text   not null default 'active' check (status in ('active', 'done', 'paused')),
  position      int    not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists meds_owner_idx on public.meds (owner_id, status, position);

-- отметка конкретного приёма: один препарат может быть несколько раз в день
create table if not exists public.med_takes (
  med_id   uuid not null references public.meds(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  day      date not null,
  slot     time not null,
  taken_at timestamptz not null default now(),
  primary key (med_id, user_id, day, slot)
);

create index if not exists med_takes_day_idx on public.med_takes (user_id, day);

-- вехи курса: анализы, повторная консультация, закупка, «написать врачу»
create table if not exists public.med_events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  emoji       text not null default '🧪',
  kind        text not null default 'other'
              check (kind in ('analysis', 'consult', 'purchase', 'message', 'other')),
  date        date not null,
  note        text,
  done        boolean not null default false,
  done_at     timestamptz,
  remind_days_before int not null default 1 check (remind_days_before between 0 and 30),
  created_at  timestamptz not null default now()
);

create index if not exists med_events_date_idx on public.med_events (owner_id, done, date);

alter table public.meds       enable row level security;
alter table public.med_takes  enable row level security;
alter table public.med_events enable row level security;

-- видят оба (как личные привычки), отмечает и правит только владелец
drop policy if exists "meds read"   on public.meds;
drop policy if exists "meds write"  on public.meds;
create policy "meds read"  on public.meds for select to authenticated using (true);
create policy "meds write" on public.meds for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "med_takes read"  on public.med_takes;
drop policy if exists "med_takes write" on public.med_takes;
create policy "med_takes read"  on public.med_takes for select to authenticated using (true);
create policy "med_takes write" on public.med_takes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "med_events read"  on public.med_events;
drop policy if exists "med_events write" on public.med_events;
create policy "med_events read"  on public.med_events for select to authenticated using (true);
create policy "med_events write" on public.med_events for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- напоминания о приёмах и вехах
alter table public.notification_prefs
  add column if not exists med_reminders boolean not null default true;

do $$
begin
  begin alter publication supabase_realtime add table public.meds;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.med_takes;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.med_events; exception when duplicate_object then null; end;
end $$;
