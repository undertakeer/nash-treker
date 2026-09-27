/* Модульные проверки арифметики дат: на глаз такие ошибки не видны, а
   расписание лечения на них держится. Собираем модуль через esbuild,
   потому что в браузерном коде импорты без расширений. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSync } from "esbuild";

const tmp = path.join(os.tmpdir(), `nt-units-${process.pid}.mjs`);
buildSync({
  entryPoints: ["units.entry.js"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmp,
  logLevel: "silent",
});
const M = await import(`file://${tmp}`);
fs.rmSync(tmp, { force: true });

const day = (n) => new Date(Date.UTC(2026, 8, 12) + n * 86400000).toISOString().slice(0, 10);
const T = day(0); // 2026-09-12, суббота
let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`УПАЛО: ${name}\n  ${e.message}`);
    process.exitCode = 1;
  }
};

check("untilLabel: сегодня, завтра, вчера", () => {
  assert.equal(M.untilLabel(T, T), "сегодня");
  assert.equal(M.untilLabel(day(1), T), "завтра");
  assert.equal(M.untilLabel(day(-1), T), "было вчера");
});

check("untilLabel: будущее без удвоенного числа", () => {
  assert.equal(M.untilLabel(day(2), T), "через 2 дня");
  assert.equal(M.untilLabel(day(5), T), "через 5 дней");
  assert.equal(M.untilLabel(day(21), T), "через 3 недели");
  assert.equal(M.untilLabel(day(120), T), "через 4 месяца");
});

check("untilLabel: прошлое — просрочено, а не «через»", () => {
  assert.equal(M.untilLabel(day(-2), T), "просрочено на 2 дня");
  assert.equal(M.untilLabel(day(-11), T), "просрочено на 11 дней");
});

check("scheduleLabel без удвоенных чисел", () => {
  assert.equal(M.scheduleLabel({ schedule_type: "daily" }), "каждый день");
  assert.equal(M.scheduleLabel({ schedule_type: "times_per_week", target_per_week: 4 }), "4 раза в неделю");
  assert.equal(M.scheduleLabel({ schedule_type: "times_per_week", target_per_week: 1 }), "1 раз в неделю");
  assert.equal(M.scheduleLabel({ schedule_type: "every_n_days", every_n_days: 2 }), "через день");
  assert.equal(M.scheduleLabel({ schedule_type: "every_n_days", every_n_days: 3 }), "каждые 3 дня");
  assert.equal(M.scheduleLabel({ schedule_type: "monthly", day_of_month: 5 }), "5-го числа");
  assert.equal(M.scheduleLabel({ schedule_type: "weekdays", weekdays: [1, 3, 5] }), "Пн, Ср, Пт");
});

check("isMedDay: каждый день и окно курса", () => {
  const med = { status: "active", schedule_type: "daily", start_date: day(-5), end_date: day(5) };
  assert.equal(M.isMedDay(med, T), true);
  assert.equal(M.isMedDay(med, day(-6)), false, "до начала курса");
  assert.equal(M.isMedDay(med, day(6)), false, "после конца курса");
  assert.equal(M.isMedDay({ ...med, status: "paused" }, T), false, "на паузе");
});

check("isMedDay: через N дней считается от начала", () => {
  const med = { status: "active", schedule_type: "every_n_days", every_n_days: 3, start_date: day(0) };
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6].map((n) => M.isMedDay(med, day(n))),
    [true, false, false, true, false, false, true],
  );
});

check("isMedDay: раз в месяц, включая короткий месяц", () => {
  const med = { status: "active", schedule_type: "monthly", day_of_month: 31, start_date: "2026-01-01" };
  assert.equal(M.isMedDay(med, "2026-01-31"), true);
  assert.equal(M.isMedDay(med, "2026-02-28"), true, "31-е в феврале — последний день");
  assert.equal(M.isMedDay(med, "2026-02-27"), false);
});

check("isMedDay: по дням недели", () => {
  const med = { status: "active", schedule_type: "weekdays", weekdays: [6], start_date: day(-30) };
  assert.equal(M.isMedDay(med, T), true, "2026-09-12 — суббота");
  assert.equal(M.isMedDay(med, day(1)), false);
});

check("courseProgress: день N из M", () => {
  const p = M.courseProgress({ start_date: day(-9), end_date: day(20) }, T);
  assert.equal(p.passed, 10);
  assert.equal(p.total, 30);
  assert.equal(M.courseProgress({ start_date: day(-2), end_date: null }, T).total, null);
});

check("dosesFor: несколько приёмов в день, по времени", () => {
  const meds = [
    { id: "a", status: "active", schedule_type: "daily", start_date: day(-1), times: ["21:00", "09:00"] },
    { id: "b", status: "active", schedule_type: "daily", start_date: day(-1), times: ["13:00"] },
    { id: "c", status: "active", schedule_type: "daily", start_date: day(3), times: ["08:00"] },
  ];
  assert.deepEqual(M.dosesFor(meds, T).map((d) => `${d.med.id}@${d.slot}`), ["a@09:00", "b@13:00", "a@21:00"]);
});

check("offsetToISO: месяцы и короткий месяц", () => {
  assert.equal(M.offsetToISO({ months: 4 }, "2026-09-12"), "2027-01-12");
  assert.equal(M.offsetToISO({ days: 14 }, "2026-09-12"), "2026-09-26");
  assert.equal(M.offsetToISO({ months: 1 }, "2026-01-31"), "2026-02-28");
});

check("freezesLeftInWeek: 2 на привычку в неделю", () => {
  const f = (habit, d) => ({ user_id: "u1", habit_id: habit, day: d });
  const args = { userId: "u1", habitId: "h1", day: T, limit: 2 };
  assert.equal(M.freezesLeftInWeek([], args), 2, "ничего не заморожено");
  // 2026-09-12 — пятница, её неделя: Пн 07.09 — Вс 13.09
  assert.equal(M.freezesLeftInWeek([f("h1", day(-1))], args), 1);
  assert.equal(M.freezesLeftInWeek([f("h1", day(-1)), f("h1", day(-2))], args), 0);
  assert.equal(M.freezesLeftInWeek([f("h1", day(-1)), f("h1", day(-2)), f("h1", day(-3))], args), 0,
    "ниже нуля не уходим");
});

check("freezesLeftInWeek: у каждой привычки свой запас", () => {
  const f = (habit, d) => ({ user_id: "u1", habit_id: habit, day: d });
  const rows = [f("h1", day(-1)), f("h1", day(-2)), f("h2", day(-1))];
  assert.equal(M.freezesLeftInWeek(rows, { userId: "u1", habitId: "h1", day: T, limit: 2 }), 0);
  assert.equal(M.freezesLeftInWeek(rows, { userId: "u1", habitId: "h2", day: T, limit: 2 }), 1);
  assert.equal(M.freezesLeftInWeek(rows, { userId: "u2", habitId: "h1", day: T, limit: 2 }), 2,
    "чужие заморозки не считаются");
});

check("freezesLeftInWeek: запас обновляется в понедельник", () => {
  const f = (d) => ({ user_id: "u1", habit_id: "h1", day: d });
  const args = (d) => ({ userId: "u1", habitId: "h1", day: d, limit: 2 });
  // T = пятница 12.09, её понедельник — 07.09
  const spent = [f("2026-09-07"), f("2026-09-08")];
  assert.equal(M.freezesLeftInWeek(spent, args(T)), 0, "на этой неделе кончились");
  assert.equal(M.freezesLeftInWeek(spent, args("2026-09-14")), 2, "в понедельник снова две");
  assert.equal(M.freezesLeftInWeek(spent, args("2026-09-06")), 2, "прошлая неделя не тронута");
});

check("dayPartOf: раскладка по частям дня", () => {
  assert.equal(M.dayPartOf("07:30").id, "morning");
  assert.equal(M.dayPartOf("13:00").id, "day");
  assert.equal(M.dayPartOf("21:00").id, "evening");
  assert.equal(M.dayPartOf("23:15").id, "night");
});

// ---------- деньги ----------
const F = M.fin;
const inc = (day, amount) => ({ kind: "income", day, amount });
const exp = (day, amount, envelope_id = null, fee = 0) => ({ kind: "expense", day, amount, envelope_id, fee });

check("округление: доля вверх до десятков, остальное вниз до доллара", () => {
  assert.equal(F.roundAllocation(546.6), 550);
  assert.equal(F.roundAllocation(540), 540, "ровное не раздуваем");
  assert.equal(F.roundAllocation(540.01), 550);
  assert.equal(F.roundDown(1445.56), 1445);
  assert.equal(F.money(1445.56), "$1445");
  assert.equal(F.moneyExact(1445.56), "$1445.56", "в истории копейки нужны");
});

check("сумма читается и с запятой, и с точкой", () => {
  assert.equal(F.parseAmount("0,80"), 0.8, "запятая — основная причина жалобы");
  assert.equal(F.parseAmount("0.80"), 0.8);
  assert.equal(F.parseAmount(" 1 234,5 "), 1234.5, "пробелы выкидываем");
  assert.equal(F.parseAmount("12"), 12);
  assert.equal(F.parseAmount("0"), 0);
  for (const bad of ["", ",", ".", "abc", "1.2.3", null, undefined]) {
    assert.equal(F.parseAmount(bad), null, `${JSON.stringify(bad)} — не сумма`);
  }
});

check("поле ввода чистится, но не мешает набирать", () => {
  assert.equal(F.cleanAmountInput("0,8"), "0.8");
  assert.equal(F.cleanAmountInput("0."), "0.", "точку в конце оставляем — человек ещё набирает");
  assert.equal(F.cleanAmountInput("12abc"), "12");
  assert.equal(F.cleanAmountInput("1.2.3"), "1.23", "второй разделитель не плодим");
  assert.equal(F.cleanAmountInput("1.239"), "1.23", "больше двух знаков не нужно");
});

check("сумма меньше доллара не превращается в ноль", () => {
  assert.equal(F.money(0.8), "$0.80", "иначе введённые 80 центов выглядят как ничего");
  assert.equal(F.money(0), "$0");
  assert.equal(F.money(1.99), "$1", "а вот тут копейки уже отбрасываем");
});

check("комиссия 1% добавляется к снятию", () => {
  assert.equal(F.feeFor(100, 1), 1);
  assert.equal(F.feeFor(84.5, 1), 0.85);
  assert.equal(F.withFee({ amount: 100, fee: 1 }), 101);
  assert.equal(F.walletBalance([inc("2026-09-25", 1000), exp("2026-09-26", 100, null, 1)]), 899);
});

check("период считается от прихода, а не от начала месяца", () => {
  const ops = [inc("2026-09-25", 1600)];
  const p = F.periodFor(ops, "2026-09-26");
  assert.equal(p.from, "2026-09-25");
  assert.equal(p.to, "2026-10-24", "до дня перед следующей зарплатой");
  assert.equal(F.daysLeftIn(p, "2026-09-26"), 29, "а не 5 дней до конца месяца");
});

check("следующий приход закрывает прошлый период", () => {
  const ops = [inc("2026-09-25", 1600), inc("2026-10-20", 1600)];
  const [first, second] = F.periodsOf(ops, "2026-10-21");
  assert.equal(first.to, "2026-10-19");
  assert.equal(second.from, "2026-10-20");
  assert.equal(F.periodFor(ops, "2026-10-21").from, "2026-10-20");
  assert.equal(F.periodFor(ops, "2026-10-01").from, "2026-09-25", "старый день — старый период");
});

check("без прихода показываем календарный месяц", () => {
  const p = F.periodFor([], "2026-09-26");
  assert.equal(p.from, "2026-09-01");
  assert.equal(p.to, "2026-09-30");
});

check("раскладка периода: доли, фиксированные суммы и комиссии", () => {
  const envelopes = [
    { id: "a", mode: "percent", plan: 30, position: 1 },
    { id: "b", mode: "fixed", plan: 250, position: 2 },
  ];
  const ops = [
    inc("2026-09-25", 1822),                 // 30% = 546.60 → 550
    exp("2026-09-26", 100, "b", 1),          // со снятия удержан доллар
    exp("2026-09-26", 50, null, 0.5),        // трата без раздела
  ];
  const plan = F.periodPlan(envelopes, ops, F.periodFor(ops, "2026-09-26"));
  assert.equal(plan.rows[0].allocated, 550, "доля округлена вверх");
  assert.equal(plan.rows[1].spent, 101, "комиссия входит в трату раздела");
  assert.equal(plan.rows[1].left, 149);
  assert.equal(plan.looseSpent, 50.5);
  assert.equal(plan.fees, 1.5);
  assert.equal(plan.free, 1822 - 550 - 250);
});

check("траты из прошлого периода не липнут к текущему", () => {
  const envelopes = [{ id: "b", mode: "fixed", plan: 250, position: 1 }];
  const ops = [inc("2026-08-25", 1000), exp("2026-09-01", 200, "b"), inc("2026-09-25", 1000)];
  const plan = F.periodPlan(envelopes, ops, F.periodFor(ops, "2026-09-26"));
  assert.equal(plan.rows[0].spent, 0, "августовская трата осталась в августе");
  assert.equal(plan.rows[0].left, 250);
});

console.log(process.exitCode ? "модульные проверки: ЕСТЬ ПАДЕНИЯ" : `модульные проверки: ${passed} ок`);
