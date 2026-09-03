export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const WEEKDAY_LONG = [
  "понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье",
];
export const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
export const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** 1 = понедельник … 7 = воскресенье */
export function isoWeekday(iso) {
  const d = fromISO(iso).getDay();
  return d === 0 ? 7 : d;
}

export function startOfWeek(iso) {
  return addDays(iso, -(isoWeekday(iso) - 1));
}

export function weekDays(iso) {
  const s = startOfWeek(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export function diffDays(a, b) {
  return Math.round((fromISO(a) - fromISO(b)) / 86400000);
}

/** Сетка месяца: 6 рядов по 7 дней, начиная с понедельника */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = fromISO(startOfWeek(toISO(first)));
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      iso: toISO(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  while (cells.length > 35 && !cells.slice(35).some((c) => c.inMonth)) cells.length = 35;
  return cells;
}

export function humanDate(iso) {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function humanDateFull(iso) {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

export function relativeDay(iso) {
  const t = todayISO();
  if (iso === t) return "сегодня";
  if (iso === addDays(t, -1)) return "вчера";
  if (iso === addDays(t, 1)) return "завтра";
  return humanDate(iso);
}

/** «5 дней», «21 день», «32 дня» */
export function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const days = (n) => plural(n, "день", "дня", "дней");
export const weeks = (n) => plural(n, "неделя", "недели", "недель");
export const times = (n) => plural(n, "раз", "раза", "раз");
