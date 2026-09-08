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
