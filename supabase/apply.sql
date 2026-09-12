-- =========================================================
--  ВСЁ НОВОЕ ОДНИМ ФАЙЛОМ: задачи + карта + вишлист + лечение
--  SQL Editor → New query → вставить целиком → Run.
--  Ничего не удаляет, повторный запуск безопасен.
-- =========================================================

-- =========================================================
--  Задачи: общий список дел на двоих
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  emoji       text not null default '📌',
  color       text not null default 'sky',
  note        text,
  done        boolean not null default false,
  done_at     timestamptz,
  done_by     uuid references public.profiles(id) on delete set null,
  due_date    date,
  due_time    time,
  assignee_id uuid references public.profiles(id) on delete set null,  -- null = общая
  priority    int  not null default 0 check (priority in (0, 1)),
  position    int  not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists tasks_open_idx on public.tasks (done, due_date, position);

alter table public.tasks enable row level security;

-- список общий: видят и правят оба
drop policy if exists "tasks read"   on public.tasks;
drop policy if exists "tasks insert" on public.tasks;
drop policy if exists "tasks write"  on public.tasks;
create policy "tasks read"   on public.tasks for select to authenticated using (true);
create policy "tasks insert" on public.tasks for insert to authenticated
  with check (created_by = auth.uid());
create policy "tasks write"  on public.tasks for all to authenticated
  using (true) with check (true);

-- напоминания о задачах
alter table public.notification_prefs
  add column if not exists task_reminders boolean not null default true;

do $$
begin
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
end $$;

-- =========================================================
--  Карта: места на двоих
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  emoji       text not null default '📍',
  color       text not null default 'sky',
  category    text not null default 'other',
  note        text,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  photo_url   text,
  thumb_url   text,
  status      text not null default 'want' check (status in ('want', 'visited')),
  visited_at  date,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists places_status_idx on public.places (status, created_at desc);

alter table public.places enable row level security;

-- карта общая: видят и правят оба
drop policy if exists "places read"   on public.places;
drop policy if exists "places insert" on public.places;
drop policy if exists "places write"  on public.places;
create policy "places read"   on public.places for select to authenticated using (true);
create policy "places insert" on public.places for insert to authenticated
  with check (created_by = auth.uid());
create policy "places write"  on public.places for all to authenticated
  using (true) with check (true);

-- уведомления о новых местах
alter table public.notification_prefs
  add column if not exists places boolean not null default true;

do $$
begin
  begin
    alter publication supabase_realtime add table public.places;
  exception when duplicate_object then null;
  end;
end $$;

-- =========================================================
--  Вишлист: что хочется получить в подарок
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

create table if not exists public.wishlist (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,  -- чья хотелка
  title       text not null,
  emoji       text not null default '🎁',
  color       text not null default 'violet',
  note        text,
  price       numeric(12, 2) check (price is null or price >= 0),
  currency    text not null default 'сум',
  url         text,
  photo_url   text,
  thumb_url   text,
  priority    int  not null default 0 check (priority in (0, 1)),
  status      text not null default 'want' check (status in ('want', 'got')),
  got_at      date,
  got_by      uuid references public.profiles(id) on delete set null,
  position    int  not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists wishlist_owner_idx on public.wishlist (owner_id, status, position);

alter table public.wishlist enable row level security;

-- список видят оба: в этом весь смысл — партнёр смотрит, что подарить
drop policy if exists "wishlist read"   on public.wishlist;
drop policy if exists "wishlist insert" on public.wishlist;
drop policy if exists "wishlist write"  on public.wishlist;
create policy "wishlist read"   on public.wishlist for select to authenticated using (true);
create policy "wishlist insert" on public.wishlist for insert to authenticated
  with check (created_by = auth.uid());
create policy "wishlist write"  on public.wishlist for all to authenticated
  using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.wishlist;
  exception when duplicate_object then null;
  end;
end $$;

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
