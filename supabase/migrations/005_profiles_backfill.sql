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
