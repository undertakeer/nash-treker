/** Сколько дней цель уже набрала: день засчитан, когда отметились оба */
export function goalProgressDays(goal, profiles, checkins) {
  const since = (goal.created_at || "").slice(0, 10);
  const perDay = new Map();
  checkins.forEach((c) => {
    if (c.day < since) return;
    if (goal.habit_id && c.habit_id !== goal.habit_id) return;
    if (!perDay.has(c.day)) perDay.set(c.day, new Set());
    perDay.get(c.day).add(c.user_id);
  });
  const need = Math.max(1, profiles.length);
  let n = 0;
  perDay.forEach((users) => { if (users.size >= need) n++; });
  return n;
}
