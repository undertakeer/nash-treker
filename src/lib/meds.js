import { addDays, diffDays, fromISO, isoWeekday, plural, startOfWeek, todayISO } from "./date";

export const MED_SCHEDULES = [
  { v: "daily", t: "Каждый день" },
  { v: "times_per_week", t: "Сколько-то раз в неделю" },
  { v: "weekdays", t: "По определённым дням" },
  { v: "every_n_days", t: "Через день и реже" },
  { v: "monthly", t: "Раз в месяц" },
];

export const EVENT_KINDS = [
  { id: "analysis", label: "Анализы", emoji: "🧪", color: "sky" },
  { id: "consult", label: "Приём врача", emoji: "🩺", color: "mint" },
  { id: "purchase", label: "Закупка", emoji: "🛒", color: "amber" },
  { id: "message", label: "Написать", emoji: "✉️", color: "violet" },
  { id: "other", label: "Другое", emoji: "📌", color: "slate" },
];

export const eventKind = (id) => EVENT_KINDS.find((k) => k.id === id) || EVENT_KINDS.at(-1);

/** Время приёма к виду «09:00» */
export const hhmm = (t) => String(t || "").slice(0, 5);

/** Части дня: по ним группируется экран «Сегодня» */
export const DAY_PARTS = [
  { id: "morning", label: "Утро", emoji: "🌅", from: 0, to: 11 },
  { id: "day", label: "День", emoji: "☀️", from: 12, to: 16 },
  { id: "evening", label: "Вечер", emoji: "🌆", from: 17, to: 21 },
  { id: "night", label: "Ночь", emoji: "🌙", from: 22, to: 23 },
];

export function dayPartOf(time) {
  const h = Number(hhmm(time).slice(0, 2));
  return DAY_PARTS.find((p) => h >= p.from && h <= p.to) || DAY_PARTS[0];
}

/** Курс ещё идёт на эту дату */
export function inCourse(med, iso) {
  if (med.start_date && iso < med.start_date) return false;
  if (med.end_date && iso > med.end_date) return false;
  return true;
}

/** Нужно ли принимать препарат в этот день */
export function isMedDay(med, iso) {
  if (med.status !== "active" || !inCourse(med, iso)) return false;
  switch (med.schedule_type) {
    case "daily":
      return true;
    // как у привычек: день не закреплён, считаем норму за неделю
    case "times_per_week":
      return true;
    case "weekdays":
      return (med.weekdays || []).includes(isoWeekday(iso));
    case "every_n_days": {
      const step = Math.max(2, med.every_n_days || 2);
      const passed = diffDays(iso, med.start_date || iso);
      return passed >= 0 && passed % step === 0;
    }
    case "monthly": {
      const d = fromISO(iso);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      // 31-е число в коротком месяце сдвигаем на последний день
      const target = Math.min(med.day_of_month || 1, last);
      return d.getDate() === target;
    }
    default:
      return false;
  }
}

/** Приёмы препарата за день, по времени */
export const slotsOf = (med) => (med.times || ["09:00"]).map(hhmm).sort();

/** Все приёмы на дату: плоский список, отсортированный по времени */
export function dosesFor(meds, iso) {
  const out = [];
  meds.filter((m) => isMedDay(m, iso)).forEach((m) => {
    slotsOf(m).forEach((slot) => out.push({ med: m, slot, key: `${m.id}|${slot}` }));
  });
  return out.sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0));
}

/** Сколько раз за эту неделю уже принято — для «сколько-то раз в неделю» */
export function weekTaken(med, takenKeys, iso) {
  const monday = startOfWeek(iso);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    if (slotsOf(med).some((s) => takenKeys.has(`${med.id}|${day}|${s}`))) n++;
  }
  return n;
}

export function scheduleLabel(med) {
  switch (med.schedule_type) {
    case "daily":
      return "каждый день";
    case "times_per_week":
      return `${plural(med.target_per_week, "раз", "раза", "раз")} в неделю`;
    case "weekdays": {
      const names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
      return (med.weekdays || []).map((d) => names[d - 1]).join(", ");
    }
    case "every_n_days":
      return med.every_n_days === 2
        ? "через день"
        : `каждые ${plural(med.every_n_days, "день", "дня", "дней")}`;
    case "monthly":
      return `${med.day_of_month || 1}-го числа`;
    default:
      return "";
  }
}

/** Сколько дней курса пройдено и сколько всего */
export function courseProgress(med, iso = todayISO()) {
  if (!med.start_date) return null;
  const passed = Math.max(0, diffDays(iso, med.start_date)) + 1;
  if (!med.end_date) return { passed, total: null };
  const total = diffDays(med.end_date, med.start_date) + 1;
  return { passed: Math.min(passed, total), total };
}

/** «через 4 месяца», «через 2 недели» — быстрые сроки для вех */
export const EVENT_OFFSETS = [
  { label: "через неделю", days: 7 },
  { label: "через 2 недели", days: 14 },
  { label: "через месяц", months: 1 },
  { label: "через 2 месяца", months: 2 },
  { label: "через 3 месяца", months: 3 },
  { label: "через 4 месяца", months: 4 },
  { label: "через 6 месяцев", months: 6 },
];

export function offsetToISO(offset, from = todayISO()) {
  if (offset.days) return addDays(from, offset.days);
  const d = fromISO(from);
  const day = d.getDate();
  const shifted = new Date(d.getFullYear(), d.getMonth() + offset.months, 1);
  const last = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, last));
  const p = (n) => String(n).padStart(2, "0");
  return `${shifted.getFullYear()}-${p(shifted.getMonth() + 1)}-${p(shifted.getDate())}`;
}

/** «через 4 месяца» / «послезавтра» / «просрочено на 3 дня» */
export function untilLabel(iso, from = todayISO()) {
  const d = diffDays(iso, from);
  if (d === 0) return "сегодня";
  if (d === 1) return "завтра";
  if (d === -1) return "было вчера";
  if (d < 0) return `просрочено на ${plural(-d, "день", "дня", "дней")}`;
  if (d < 14) return `через ${plural(d, "день", "дня", "дней")}`;
  if (d < 60) {
    const w = Math.round(d / 7);
    return `через ${plural(w, "неделю", "недели", "недель")}`;
  }
  const m = Math.round(d / 30);
  return `через ${plural(m, "месяц", "месяца", "месяцев")}`;
}
