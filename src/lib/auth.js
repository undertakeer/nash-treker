/**
 * Вход устроен по логину, а не по почте.
 * Supabase хранит пользователя с адресом вида login@nashtreker.app —
 * адрес служебный, письма туда не отправляются.
 */
export const LOGIN_DOMAIN = "nashtreker.app";

/** «vlad» → «vlad@nashtreker.app», настоящую почту оставляем как есть */
export function loginToEmail(input) {
  const value = (input || "").trim().toLowerCase();
  if (!value) return "";
  return value.includes("@") ? value : `${value}@${LOGIN_DOMAIN}`;
}

/** Обратно: «vlad@nashtreker.app» → «vlad» */
export function emailToLogin(email) {
  const value = (email || "").trim();
  return value.endsWith(`@${LOGIN_DOMAIN}`) ? value.slice(0, -(LOGIN_DOMAIN.length + 1)) : value;
}

/** Допустимый логин: латиница, цифры, точка, дефис, подчёркивание */
export function isValidLogin(input) {
  const value = (input || "").trim().toLowerCase();
  if (value.includes("@")) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  return /^[a-z0-9._-]{2,30}$/.test(value);
}
