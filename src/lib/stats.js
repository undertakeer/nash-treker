import { addDays, diffDays, isoWeekday, startOfWeek, todayISO, weekDays } from "./date";

/** Запланирован ли этот день для привычки */
export function isScheduled(habit, iso) {
  if (habit.schedule_type === "weekdays") {
    return (habit.weekdays || []).includes(isoWeekday(iso));
  }
  return true; // daily и times_per_week — любой день подходит
}

/** Сколько пропусков в неделю привычка прощает */
function weeklyAllowance(habit) {
  if (habit.schedule_type === "times_per_week") return 7 - (habit.target_per_week || 7);
  return 0;
}

/**
 * Стрик в днях. Считается назад от сегодня.
 * Сегодняшний день, если ещё не отмечен, стрик не рвёт.
 */
export function streak(habit, doneSet, freezeSet) {
  const today = todayISO();
  const allowance = weeklyAllowance(habit);
  const missesByWeek = new Map();

  let cursor = today;
  let count = 0;
  let firstStep = true;

  for (let guard = 0; guard < 4000; guard++) {
    const done = doneSet.has(cursor);
    if (done) {
      count++;
    } else if (freezeSet?.has(cursor)) {
      // заморозка: день не считается ни выполненным, ни пропущенным
    } else if (isScheduled(habit, cursor)) {
      if (firstStep) {
        // сегодня ещё можно успеть
      } else {
        const wk = startOfWeek(cursor);
        const used = (missesByWeek.get(wk) || 0) + 1;
        if (used > allowance) break;
        missesByWeek.set(wk, used);
      }
    }
    firstStep = false;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Лучший стрик за всю историю привычки */
export function bestStreak(habit, doneSet, sinceISO, freezeSet) {
  const today = todayISO();
  const from = sinceISO || today;
  const total = Math.max(0, diffDays(today, from));
  const allowance = weeklyAllowance(habit);

  let best = 0;
  let run = 0;
  const missesByWeek = new Map();

  for (let i = 0; i <= total; i++) {
    const iso = addDays(from, i);
    if (doneSet.has(iso)) {
      run++;
      best = Math.max(best, run);
    } else if (freezeSet?.has(iso)) {
      // заморозка стрик не рвёт
    } else if (isScheduled(habit, iso)) {
      const wk = startOfWeek(iso);
      const used = (missesByWeek.get(wk) || 0) + 1;
      if (used > allowance) {
        run = 0;
        missesByWeek.clear();
      } else {
        missesByWeek.set(wk, used);
      }
    }
  }
  return best;
}

/** Сколько дней ожидалось от привычки с даты старта по сегодня */
export function expectedDays(habit, sinceISO) {
  const today = todayISO();
  const total = Math.max(0, diffDays(today, sinceISO)) + 1;
  if (habit.schedule_type === "daily") return total;
  if (habit.schedule_type === "weekdays") {
    let n = 0;
    for (let i = 0; i < total; i++) {
      if (isScheduled(habit, addDays(sinceISO, i))) n++;
    }
    return n;
  }
  const target = habit.target_per_week || 7;
  return Math.max(1, Math.round((total / 7) * target));
}

/** Дисциплина: доля выполненного от ожидаемого, 0–100 */
export function discipline(habit, doneSet, sinceISO, freezeSet) {
  let frozen = 0;
  freezeSet?.forEach((iso) => {
    if (iso >= sinceISO && iso <= todayISO()) frozen++;
  });
  const expected = Math.max(1, expectedDays(habit, sinceISO) - frozen);
  let done = 0;
  doneSet.forEach((iso) => {
    if (iso >= sinceISO) done++;
  });
  return Math.min(100, Math.round((done / expected) * 100));
}

/** Полоска недели на карточке */
export function weekMarks(habit, doneSet, anchorISO) {
  const today = todayISO();
  return weekDays(anchorISO || today).map((iso) => ({
    iso,
    done: doneSet.has(iso),
    scheduled: isScheduled(habit, iso),
    future: iso > today,
    isToday: iso === today,
  }));
}

/** Текстовое описание режима */
export function scheduleLabel(habit) {
  if (habit.schedule_type === "daily") return "каждый день";
  if (habit.schedule_type === "times_per_week") {
    const n = habit.target_per_week || 7;
    const word = n === 1 ? "раз" : n >= 2 && n <= 4 ? "раза" : "раз";
    return `${n} ${word} в неделю`;
  }
  const list = (habit.weekdays || []).slice().sort();
  if (list.length === 7) return "каждый день";
  if (list.length === 5 && list.every((d) => d <= 5)) return "по будням";
  if (list.length === 2 && list[0] === 6 && list[1] === 7) return "по выходным";
  const short = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  return list.map((d) => short[d - 1]).join(", ");
}

/** Прогресс к цели, если она задана */
export function goalProgress(habit, doneCount) {
  if (!habit.goal_days) return null;
  return {
    done: doneCount,
    total: habit.goal_days,
    percent: Math.min(100, Math.round((doneCount / habit.goal_days) * 100)),
    reached: doneCount >= habit.goal_days,
  };
}
