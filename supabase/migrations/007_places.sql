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
