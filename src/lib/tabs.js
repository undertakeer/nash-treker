/** Все вкладки приложения. id совпадает с ключом в App. */
export const ALL_TABS = [
  { id: "home", label: "Привычки", locked: true },
  { id: "today", label: "Сегодня" },
  { id: "tasks", label: "Задачи" },
  { id: "meds", label: "Лечение" },
  { id: "money", label: "Деньги" },
  { id: "map", label: "Карта" },
  { id: "together", label: "Мы" },
  { id: "profile", label: "Профиль", locked: true },
];

/** По умолчанию показываем не всё: лечение и деньги нужны не каждому */
export const DEFAULT_TABS = ["home", "today", "tasks", "map", "together", "profile"];

const ORDER = ALL_TABS.map((t) => t.id);
const LOCKED = ALL_TABS.filter((t) => t.locked).map((t) => t.id);

/** Приводим сохранённый набор к порядку из ALL_TABS и добиваем обязательными */
export function visibleTabs(saved) {
  const chosen = Array.isArray(saved) && saved.length ? saved : DEFAULT_TABS;
  const set = new Set([...chosen.filter((id) => ORDER.includes(id)), ...LOCKED]);
  return ORDER.filter((id) => set.has(id));
}

export const isLockedTab = (id) => LOCKED.includes(id);
