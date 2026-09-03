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
