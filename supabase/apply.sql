-- =========================================================
--  ВСЁ ОДНИМ ФАЙЛОМ: задачи, карта, вишлист, лечение, деньги
--  Нужен только при установке с нуля. Если прошлые миграции уже
--  прогнаны — достаточно последнего файла из supabase/migrations.
-- =========================================================

-- =========================================================
--  Настроение в профиле
--  SQL Editor → New query → вставить → Run
-- =========================================================

alter table public.profiles add column if not exists mood      text;
alter table public.profiles add column if not exists mood_text text;
alter table public.profiles add column if not exists mood_at   timestamptz;

-- =========================================================
--  Фотоотчёты, баллы и желания, заморозки, совместные цели
--  SQL Editor → New query → вставить целиком → Run
--  Существующие данные не трогает.
-- =========================================================

-- ---------------------------------------------------------
-- Фото и заметка к отметке
-- ---------------------------------------------------------
alter table public.checkins add column if not exists photo_url text;
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

-- =========================================================
--  Экономия места: превью к фото и счётчик занятого объёма
--  SQL Editor → New query → вставить → Run
-- =========================================================

-- Миниатюра для сетки галереи: полный снимок грузится только при открытии
alter table public.checkins add column if not exists thumb_url text;

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

-- =========================================================
--  Восстановление профилей
--  Если после входа имя показывается как «Без имени», а аватарка
--  не сохраняется — значит строки профиля нет. Этот скрипт её создаёт
--  и заново вешает триггер, который заводит профиль новым аккаунтам.
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- 1. Триггер: профиль и настройки уведомлений на каждый новый аккаунт
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;

  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Профили для всех, кто уже заведён
insert into public.profiles (id, display_name)
select u.id, coalesce(split_part(u.email, '@', 1), '')
from auth.users u
on conflict (id) do nothing;

insert into public.notification_prefs (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

-- 3. Пустым именам подставляем логин
update public.profiles p
set display_name = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id and coalesce(p.display_name, '') = '';

-- Проверка: должно вернуть по строке на каждый аккаунт
select p.id, p.display_name, p.avatar_url, u.email
from public.profiles p
join auth.users u on u.id = p.id
order by p.created_at;

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
--  Лечение: препараты с расписанием и события курса
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

-- события курса: анализы, повторная консультация, закупка, «написать врачу»
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

-- напоминания о приёмах и событийах
alter table public.notification_prefs
  add column if not exists med_reminders boolean not null default true;

do $$
begin
  begin alter publication supabase_realtime add table public.meds;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.med_takes;  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.med_events; exception when duplicate_object then null; end;
end $$;

-- =========================================================
--  Деньги: кошелёк, конверты, операции. И выбор вкладок.
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- какие вкладки показывать этому человеку (null = набор по умолчанию)
alter table public.profiles add column if not exists tabs text[];
-- валюта раздела «Деньги»
alter table public.profiles add column if not exists fin_currency text not null default '$';

-- конверт: сколько из прихода отводится на это направление
create table if not exists public.fin_envelopes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  emoji      text not null default '💵',
  color      text not null default 'mint',
  mode       text not null default 'fixed' check (mode in ('fixed', 'percent')),
  plan       numeric(12, 2) not null default 0 check (plan >= 0),
  carry      boolean not null default false,   -- переносить остаток на след. месяц
  note       text,
  position   int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists fin_envelopes_owner_idx on public.fin_envelopes (owner_id, archived, position);

-- операция: приход на кошелёк или трата из конверта
create table if not exists public.fin_ops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  envelope_id uuid references public.fin_envelopes(id) on delete set null,
  kind        text not null check (kind in ('income', 'expense')),
  amount      numeric(12, 2) not null check (amount > 0),
  note        text,
  day         date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists fin_ops_owner_day_idx on public.fin_ops (owner_id, day desc);

alter table public.fin_envelopes enable row level security;
alter table public.fin_ops       enable row level security;

-- деньги личные: видит и правит только владелец
drop policy if exists "fin_envelopes own" on public.fin_envelopes;
create policy "fin_envelopes own" on public.fin_envelopes for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "fin_ops own" on public.fin_ops;
create policy "fin_ops own" on public.fin_ops for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

do $$
begin
  begin alter publication supabase_realtime add table public.fin_envelopes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.fin_ops;       exception when duplicate_object then null; end;
end $$;

-- =========================================================
--  Деньги: комиссия за снятие, разовые разделы, дата прихода
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- комиссия, удержанная при этом снятии
alter table public.fin_ops
  add column if not exists fee numeric(12, 2) not null default 0 check (fee >= 0);

-- у разовых трат (связь, подписка) дневной темп бессмыслен
alter table public.fin_envelopes
  add column if not exists show_pace boolean not null default true;

-- процент комиссии за снятие, свой у каждого
alter table public.profiles
  add column if not exists fin_fee_percent numeric(5, 2) not null default 1
  check (fin_fee_percent >= 0 and fin_fee_percent <= 100);

-- =========================================================
--  Деньги: траты не с кошелька, правка баланса, выборочная комиссия
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- трата записана, но с кошелька ничего не снималось (дали наличкой и т.п.)
alter table public.fin_ops
  add column if not exists off_wallet boolean not null default false;

-- появился третий вид операции: правка баланса, у неё сумма со знаком
alter table public.fin_ops drop constraint if exists fin_ops_kind_check;
alter table public.fin_ops
  add constraint fin_ops_kind_check check (kind in ('income', 'expense', 'adjust'));

alter table public.fin_ops drop constraint if exists fin_ops_amount_check;
alter table public.fin_ops
  add constraint fin_ops_amount_check check (amount <> 0);

-- =========================================================
--  Деньги: разделы без лимита, цели-накопления, запас по сроку зарплаты
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

-- третий вид раздела: без лимита, только учёт (здоровье, разовые нужды)
alter table public.fin_envelopes drop constraint if exists fin_envelopes_mode_check;
alter table public.fin_envelopes
  add constraint fin_envelopes_mode_check check (mode in ('fixed', 'percent', 'free'));

-- цель-накопление: в отличие от раздела не обнуляется с новой зарплатой
create table if not exists public.fin_goals (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  emoji      text not null default '🎯',
  color      text not null default 'violet',
  target     numeric(12, 2) check (target is null or target >= 0),
  per_income numeric(12, 2) not null default 0 check (per_income >= 0),
  note       text,
  position   int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists fin_goals_owner_idx on public.fin_goals (owner_id, archived, position);

alter table public.fin_goals enable row level security;
drop policy if exists "fin_goals own" on public.fin_goals;
create policy "fin_goals own" on public.fin_goals for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- операция откладывания: деньги остаются на кошельке, но помечены под цель
alter table public.fin_ops
  add column if not exists goal_id uuid references public.fin_goals(id) on delete set null;

alter table public.fin_ops drop constraint if exists fin_ops_kind_check;
alter table public.fin_ops
  add constraint fin_ops_kind_check check (kind in ('income', 'expense', 'adjust', 'save'));

do $$
begin
  begin alter publication supabase_realtime add table public.fin_goals; exception when duplicate_object then null; end;
end $$;

-- =========================================================
--  Копилки: взнос можно задавать долей от прихода
--  SQL Editor → New query → вставить → Run. Ничего не удаляет.
-- =========================================================

alter table public.fin_goals
  add column if not exists per_mode text not null default 'fixed'
  check (per_mode in ('fixed', 'percent'));
