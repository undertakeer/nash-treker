-- =========================================================
--  Наш трекер 2.0 — схема базы для Supabase
--  SQL Editor → New query → вставить целиком → Run
--  ВНИМАНИЕ: пересоздаёт таблицы, старые данные удаляются.
-- =========================================================

drop table if exists public.tasks            cascade;
drop table if exists public.purchases        cascade;
drop table if exists public.wishes           cascade;
drop table if exists public.goals            cascade;
drop table if exists public.freezes          cascade;
drop table if exists public.reactions        cascade;
drop table if exists public.events           cascade;
drop table if exists public.achievements     cascade;
drop table if exists public.notification_log cascade;
drop table if exists public.notification_prefs cascade;
drop table if exists public.push_subscriptions cascade;
drop table if exists public.checkins         cascade;
drop table if exists public.habits           cascade;
drop table if exists public.profiles         cascade;
drop table if exists public.settings         cascade;

-- ---------------------------------------------------------
-- Профили: по одному на аккаунт
-- ---------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url  text,
  emoji       text not null default '🙂',
  accent      text not null default 'mint',
  mood        text,
  mood_text   text,
  mood_at     timestamptz,
  timezone    text not null default 'Asia/Tashkent',
  created_at  timestamptz not null default now()
);

-- Профиль заводится сам при создании аккаунта
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  insert into public.notification_prefs (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- Привычки
-- ---------------------------------------------------------
create table public.habits (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  icon          text not null default '💧',
  color         text not null default 'mint',
  kind          text not null default 'shared' check (kind in ('shared','personal')),
  owner_id      uuid references public.profiles(id) on delete cascade,
  schedule_type text not null default 'daily'
                check (schedule_type in ('daily','times_per_week','weekdays')),
  target_per_week int not null default 7 check (target_per_week between 1 and 7),
  weekdays      int[] not null default '{1,2,3,4,5,6,7}',
  reminder_enabled boolean not null default false,
  reminder_time time not null default '09:00',
  goal_days     int,
  status        text not null default 'active' check (status in ('active','completed','archived')),
  pinned        boolean not null default false,
  position      int not null default 0,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  archived_at   timestamptz,
  constraint personal_needs_owner check (kind <> 'personal' or owner_id is not null)
);

create index habits_status_idx on public.habits (status, position);

-- ---------------------------------------------------------
-- Отметки: строка есть = сделано
-- ---------------------------------------------------------
create table public.checkins (
  habit_id   uuid not null references public.habits(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  note       text,
  created_at timestamptz not null default now(),
  primary key (habit_id, user_id, day)
);

create index checkins_day_idx  on public.checkins (day);
create index checkins_user_idx on public.checkins (user_id, day);

-- ---------------------------------------------------------
-- Лента событий и реакции
-- ---------------------------------------------------------
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  type       text not null check (type in ('checkin','completed','achievement','nudge','joined')),
  actor_id   uuid references public.profiles(id) on delete cascade,
  target_id  uuid references public.profiles(id) on delete cascade,
  habit_id   uuid references public.habits(id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_created_idx on public.events (created_at desc);

create table public.reactions (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, emoji)
);

-- ---------------------------------------------------------
-- Достижения
-- ---------------------------------------------------------
create table public.achievements (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  habit_id  uuid references public.habits(id) on delete cascade,
  code      text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, habit_id, code)
);

-- ---------------------------------------------------------
-- Уведомления
-- ---------------------------------------------------------
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.notification_prefs (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  reminders        boolean not null default true,
  partner_checkins boolean not null default true,
  streak_risk      boolean not null default true,
  streak_risk_time time    not null default '21:00',
  weekly_summary   boolean not null default true,
  nudges           boolean not null default true,
  quiet_from       time    not null default '23:00',
  quiet_to         time    not null default '08:00'
);

-- Защита от повторной отправки одного и того же напоминания
create table public.notification_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null,
  key     text not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, key)
);

-- =========================================================
--  Права доступа
--  Пространство общее на двоих: оба видят всё,
--  но менять могут только своё.
-- =========================================================

alter table public.profiles           enable row level security;
alter table public.habits             enable row level security;
alter table public.checkins           enable row level security;
alter table public.events             enable row level security;
alter table public.reactions          enable row level security;
alter table public.achievements       enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.notification_log   enable row level security;

-- профили: видят оба, правит каждый только свой
create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- привычки: видят оба (личные партнёра — только на просмотр)
create policy "habits read" on public.habits for select to authenticated using (true);
create policy "habits insert" on public.habits for insert to authenticated
  with check (kind = 'shared' or owner_id = auth.uid());
create policy "habits update" on public.habits for update to authenticated
  using (kind = 'shared' or owner_id = auth.uid())
  with check (kind = 'shared' or owner_id = auth.uid());
create policy "habits delete" on public.habits for delete to authenticated
  using (kind = 'shared' or owner_id = auth.uid());

-- отметки: видят оба, ставит каждый только за себя и только там, где имеет право
create policy "checkins read" on public.checkins for select to authenticated using (true);
create policy "checkins insert" on public.checkins for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.habits h
      where h.id = habit_id and (h.kind = 'shared' or h.owner_id = auth.uid())
    )
  );
create policy "checkins update" on public.checkins for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "checkins delete" on public.checkins for delete to authenticated
  using (user_id = auth.uid());

-- лента
create policy "events read"   on public.events for select to authenticated using (true);
create policy "events insert" on public.events for insert to authenticated
  with check (actor_id = auth.uid());
create policy "events delete" on public.events for delete to authenticated
  using (actor_id = auth.uid());

create policy "reactions read"   on public.reactions for select to authenticated using (true);
create policy "reactions insert" on public.reactions for insert to authenticated
  with check (user_id = auth.uid());
create policy "reactions delete" on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- достижения
create policy "achievements read"   on public.achievements for select to authenticated using (true);
create policy "achievements insert" on public.achievements for insert to authenticated
  with check (user_id = auth.uid());

-- подписки на пуши и настройки — строго свои
create policy "push own" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "prefs own" on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "log read own" on public.notification_log for select to authenticated
  using (user_id = auth.uid());

-- =========================================================
--  Хранилище аватарок
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "avatars read"   on storage.objects;
drop policy if exists "avatars write"  on storage.objects;
drop policy if exists "avatars update" on storage.objects;
drop policy if exists "avatars delete" on storage.objects;

create policy "avatars read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
--  Realtime: изменения прилетают второму мгновенно
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','habits','checkins','events','reactions','achievements'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Профили для уже созданных аккаунтов (если регистрировались до этого скрипта)
insert into public.profiles (id, display_name)
select u.id, coalesce(split_part(u.email, '@', 1), '')
from auth.users u
on conflict (id) do nothing;

insert into public.notification_prefs (user_id)
select id from public.profiles
on conflict (user_id) do nothing;


-- =========================================================
--  Фотоотчёты, баллы и желания, заморозки, совместные цели
-- =========================================================
-- ---------------------------------------------------------
-- Фото и заметка к отметке
-- ---------------------------------------------------------
alter table public.checkins add column if not exists photo_url text;
alter table public.checkins add column if not exists thumb_url text;
alter table public.checkins add column if not exists note      text;

-- ---------------------------------------------------------
-- Заморозка стрика: день не считается пропуском
-- ---------------------------------------------------------
create table if not exists public.freezes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  habit_id   uuid not null references public.habits(id) on delete cascade,
  day        date not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (user_id, habit_id, day)
);

create index if not exists freezes_user_idx on public.freezes (user_id, day);

-- ---------------------------------------------------------
-- Магазин желаний: копите баллы за отметки, покупаете награду,
-- партнёр её исполняет.
-- ---------------------------------------------------------
create table if not exists public.wishes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  emoji      text not null default '🎁',
  price      int  not null default 100 check (price between 10 and 100000),
  active     boolean not null default true,
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id         uuid primary key default gen_random_uuid(),
  wish_id    uuid references public.wishes(id) on delete set null,
  buyer_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  emoji      text not null default '🎁',
  price      int  not null,
  status     text not null default 'pending' check (status in ('pending','done','cancelled')),
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  done_by    uuid references public.profiles(id) on delete set null
);

create index if not exists purchases_buyer_idx on public.purchases (buyer_id, created_at desc);

-- ---------------------------------------------------------
-- Совместные цели с наградой
-- ---------------------------------------------------------
create table if not exists public.goals (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  emoji        text not null default '🎯',
  reward       text,
  habit_id     uuid references public.habits(id) on delete cascade,
  target       int  not null default 30 check (target between 1 and 1000),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- ---------------------------------------------------------
-- Права доступа
-- ---------------------------------------------------------
alter table public.freezes   enable row level security;
alter table public.wishes    enable row level security;
alter table public.purchases enable row level security;
alter table public.goals     enable row level security;

drop policy if exists "freezes read"   on public.freezes;
drop policy if exists "freezes own"    on public.freezes;
create policy "freezes read" on public.freezes for select to authenticated using (true);
create policy "freezes own"  on public.freezes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "wishes read" on public.wishes;
drop policy if exists "wishes own"  on public.wishes;
create policy "wishes read" on public.wishes for select to authenticated using (true);
create policy "wishes own"  on public.wishes for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- покупает только владелец желания, отметить исполненным может любой из двоих
drop policy if exists "purchases read"   on public.purchases;
drop policy if exists "purchases insert" on public.purchases;
drop policy if exists "purchases update" on public.purchases;
create policy "purchases read"   on public.purchases for select to authenticated using (true);
create policy "purchases insert" on public.purchases for insert to authenticated
  with check (buyer_id = auth.uid());
create policy "purchases update" on public.purchases for update to authenticated
  using (true) with check (true);

drop policy if exists "goals read" on public.goals;
drop policy if exists "goals all"  on public.goals;
create policy "goals read" on public.goals for select to authenticated using (true);
create policy "goals all"  on public.goals for all to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------
-- Хранилище фотоотчётов
-- ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('moments', 'moments', true)
on conflict (id) do update set public = true;

drop policy if exists "moments read"   on storage.objects;
drop policy if exists "moments write"  on storage.objects;
drop policy if exists "moments delete" on storage.objects;

create policy "moments read" on storage.objects for select
  using (bucket_id = 'moments');
create policy "moments write" on storage.objects for insert to authenticated
  with check (bucket_id = 'moments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "moments delete" on storage.objects for delete to authenticated
  using (bucket_id = 'moments' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------
-- Умное напоминание: настройка
-- ---------------------------------------------------------
alter table public.notification_prefs
  add column if not exists smart_nudge boolean not null default true;

-- ---------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['freezes','wishes','purchases','goals'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------
-- Сколько занято в хранилище. Читает служебную таблицу storage.objects,
-- поэтому security definer — обычному пользователю она недоступна.
create or replace function public.storage_usage()
returns table (bucket text, bytes bigint, files bigint)
language sql
security definer
set search_path = storage, public
as $$
  select
    o.bucket_id::text,
    coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint,
    count(*)::bigint
  from storage.objects o
  where o.bucket_id in ('avatars', 'moments')
  group by o.bucket_id
$$;

revoke all on function public.storage_usage() from public;
grant execute on function public.storage_usage() to authenticated;

-- ---------------------------------------------------------
--  Задачи
-- ---------------------------------------------------------
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
