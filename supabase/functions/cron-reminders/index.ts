// Плановые уведомления: напоминания, стрик под угрозой, итоги недели.
// Дёргается расписанием pg_cron каждые 5 минут.
import {
  adminClient, claim, cors, hhmmToMinutes, inQuietHours, json, localParts, sendToUser,
} from "../_shared/push.ts";

const WINDOW = 7; // минут: попадание во временное окно вокруг заданного часа

const dayMs = 86400000;
const parseISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const daysBetween = (a: string, b: string) => Math.round((parseISO(b) - parseISO(a)) / dayMs);
const shiftISO = (iso: string, days: number) =>
  new Date(parseISO(iso) + days * dayMs).toISOString().slice(0, 10);

/** Нужно ли принимать препарат в этот день — та же логика, что на клиенте */
function medDueToday(med: Record<string, unknown>, date: string, isoWeekday: number) {
  const start = med.start_date as string | null;
  const end = med.end_date as string | null;
  if (start && date < start) return false;
  if (end && date > end) return false;

  switch (med.schedule_type) {
    case "daily":
    case "times_per_week":
      return true;
    case "weekdays":
      return ((med.weekdays as number[]) ?? []).includes(isoWeekday);
    case "every_n_days": {
      const step = Math.max(2, (med.every_n_days as number) ?? 2);
      const passed = daysBetween(start ?? date, date);
      return passed >= 0 && passed % step === 0;
    }
    case "monthly": {
      const [y, m, d] = date.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return d === Math.min((med.day_of_month as number) ?? 1, last);
    }
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return json({ error: "forbidden" }, 403);
  }

  const admin = adminClient();

  const [{ data: profiles }, { data: habits }, { data: prefsRows }, { data: tasks },
         { data: meds }, { data: medEvents }] =
    await Promise.all([
      admin.from("profiles").select("*"),
      admin.from("habits").select("*").eq("status", "active"),
      admin.from("notification_prefs").select("*"),
      admin.from("tasks").select("*").eq("done", false).not("due_time", "is", null),
      admin.from("meds").select("*").eq("status", "active"),
      admin.from("med_events").select("*").eq("done", false),
    ]);

  const prefsOf = (id: string) => prefsRows?.find((p) => p.user_id === id);
  let sent = 0;

  for (const person of profiles ?? []) {
    const prefs = prefsOf(person.id);
    const { minutes, date, isoWeekday } = localParts(person.timezone || "UTC");
    const quiet = inQuietHours(minutes, prefs?.quiet_from, prefs?.quiet_to);

    // 0. Приём препаратов: у каждого времени свой пуш
    if (prefs?.med_reminders !== false && !quiet) {
      const mine = (meds ?? []).filter((m) => m.owner_id === person.id && m.reminder !== false);
      if (mine.length) {
        const { data: takes } = await admin
          .from("med_takes").select("med_id, slot").eq("user_id", person.id).eq("day", date);
        const taken = new Set((takes ?? []).map((t) => `${t.med_id}|${String(t.slot).slice(0, 5)}`));

        for (const med of mine) {
          if (!medDueToday(med, date, isoWeekday)) continue;
          for (const raw of (med.times as string[]) ?? ["09:00"]) {
            const slot = String(raw).slice(0, 5);
            if (taken.has(`${med.id}|${slot}`)) continue;
            if (Math.abs(minutes - hhmmToMinutes(slot, 9 * 60)) > WINDOW) continue;
            if (!(await claim(admin, person.id, "med", `${med.id}:${date}:${slot}`))) continue;

            sent += await sendToUser(admin, person.id, {
              title: `${med.emoji} ${med.title}`,
              body: med.dose ? `${slot} — ${med.dose}` : `Пора принять, ${slot}`,
              tag: `med-${med.id}-${slot}`,
            });
          }
        }
      }
    }

    // 0б. События курса: анализы, повторный приём, закупка — утром в свой день
    if (prefs?.med_reminders !== false && !quiet && Math.abs(minutes - 10 * 60) <= WINDOW) {
      const mine = (medEvents ?? []).filter((e) => e.owner_id === person.id);
      for (const ev of mine) {
        const remindOn = shiftISO(ev.date, -(ev.remind_days_before ?? 1));
        if (remindOn !== date) continue;
        if (!(await claim(admin, person.id, "med_event", `${ev.id}:${date}`))) continue;

        const when = ev.date === date ? "сегодня" : `${daysBetween(date, ev.date)} дн.`;
        sent += await sendToUser(admin, person.id, {
          title: `${ev.emoji} ${ev.title}`,
          body: ev.note ? `${when} · ${ev.note}` : when,
          tag: `med-event-${ev.id}`,
        });
      }
    }

    const own = (habits ?? []).filter((h) => h.kind === "shared" || h.owner_id === person.id);
    if (!own.length) continue;

    const { data: todayChecks } = await admin
      .from("checkins").select("habit_id").eq("user_id", person.id).eq("day", date);
    const doneToday = new Set((todayChecks ?? []).map((c) => c.habit_id));

    // 1. Напоминания в заданное время
    if (prefs?.reminders !== false && !quiet) {
      for (const h of own) {
        if (!h.reminder_enabled) continue;
        if (doneToday.has(h.id)) continue;
        if (h.schedule_type === "weekdays" && !(h.weekdays ?? []).includes(isoWeekday)) continue;

        const target = hhmmToMinutes(h.reminder_time, 9 * 60);
        if (Math.abs(minutes - target) > WINDOW) continue;

        const key = `${h.id}:${date}`;
        if (!(await claim(admin, person.id, "reminder", key))) continue;

        sent += await sendToUser(admin, person.id, {
          title: `${h.icon} ${h.title}`,
          body: "Пора отметиться",
          tag: `reminder-${h.id}`,
          habitId: h.id,
        });
      }
    }

    // 2. Стрик под угрозой
    if (prefs?.streak_risk !== false && !quiet) {
      const target = hhmmToMinutes(prefs?.streak_risk_time, 21 * 60);
      if (Math.abs(minutes - target) <= WINDOW) {
        const pending = own.filter((h) => {
          if (doneToday.has(h.id)) return false;
          if (h.schedule_type === "weekdays" && !(h.weekdays ?? []).includes(isoWeekday)) return false;
          return true;
        });
        if (pending.length && (await claim(admin, person.id, "streak_risk", date))) {
          const first = pending[0];
          sent += await sendToUser(admin, person.id, {
            title: pending.length === 1 ? `${first.icon} ${first.title}` : "Остались привычки",
            body: pending.length === 1
              ? "День заканчивается — стрик под угрозой"
              : `Сегодня не отмечено: ${pending.length}. Стрик под угрозой`,
            tag: "streak-risk",
            habitId: pending.length === 1 ? first.id : undefined,
          });
        }
      }
    }

    // 3. Задачи со сроком: пинг в назначенное время
    if (prefs?.task_reminders !== false && !quiet) {
      const mine = (tasks ?? []).filter(
        (t) => t.due_date === date && (t.assignee_id === person.id || t.assignee_id === null),
      );
      for (const task of mine) {
        const target = hhmmToMinutes(task.due_time, 9 * 60);
        if (Math.abs(minutes - target) > WINDOW) continue;
        if (!(await claim(admin, person.id, "task", `${task.id}:${date}`))) continue;

        sent += await sendToUser(admin, person.id, {
          title: `${task.emoji} ${task.title}`,
          body: task.note || (task.assignee_id ? "Пора заняться" : "Общая задача — пора заняться"),
          tag: `task-${task.id}`,
        });
      }
    }

    // 4. Умное напоминание: партнёр закрыл общую привычку, вы — нет
    if (prefs?.smart_nudge !== false && !quiet) {
      const shared = own.filter((h) => h.kind === "shared" && !doneToday.has(h.id));
      if (shared.length) {
        const { data: partnerChecks } = await admin
          .from("checkins")
          .select("habit_id, created_at, user_id")
          .neq("user_id", person.id)
          .eq("day", date)
          .in("habit_id", shared.map((h) => h.id));

        for (const check of partnerChecks ?? []) {
          const ageMin = (Date.now() - new Date(check.created_at).getTime()) / 60000;
          if (ageMin < 120 || ageMin > 240) continue; // окно: через 2–4 часа после партнёра

          const habit = shared.find((h) => h.id === check.habit_id);
          if (!habit) continue;
          if (!(await claim(admin, person.id, "smart_nudge", `${habit.id}:${date}`))) continue;

          sent += await sendToUser(admin, person.id, {
            title: `${habit.icon} ${habit.title}`,
            body: "Партнёр уже закрыл — догоняйте",
            tag: `smart-${habit.id}`,
            habitId: habit.id,
          });
        }
      }
    }

    // 5. Итоги недели, воскресенье вечером
    if (prefs?.weekly_summary !== false && isoWeekday === 7 && Math.abs(minutes - 20 * 60) <= WINDOW) {
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - 6);
      const from = weekStart.toISOString().slice(0, 10);

      const { count } = await admin
        .from("checkins")
        .select("*", { count: "exact", head: true })
        .eq("user_id", person.id)
        .gte("day", from)
        .lte("day", date);

      if (await claim(admin, person.id, "weekly", date)) {
        sent += await sendToUser(admin, person.id, {
          title: "Итоги недели",
          body: `${count ?? 0} отметок за семь дней. Загляните в раздел «Мы»`,
          tag: "weekly",
        });
      }
    }
  }

  return json({ ok: true, sent });
});
