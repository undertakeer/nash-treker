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
const inc = (day, amount, created_at, id) => ({ kind: "income", day, amount, created_at, id });
const exp = (day, amount, envelope_id = null, fee = 0, created_at) =>
  ({ kind: "expense", day, amount, envelope_id, fee, created_at });

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

check("траты не с кошелька: лимит съедают, баланс не трогают", () => {
  const offWallet = { kind: "expense", day: "2026-09-26", amount: 50, fee: 0, envelope_id: "b", off_wallet: true };
  const ops = [inc("2026-09-25", 1000), exp("2026-09-26", 100, "b", 1), offWallet];
  assert.equal(F.walletBalance(ops), 899, "снялось только то, что шло с кошелька");
  const envelopes = [{ id: "b", mode: "fixed", plan: 250, position: 1 }];
  const plan = F.periodPlan(envelopes, ops, F.periodFor(ops, "2026-09-26"));
  assert.equal(plan.rows[0].spent, 151, "а лимит раздела съеден весь");
  assert.equal(plan.rows[0].left, 99);
});

check("правка баланса: считаем разницу и не путаем с приходом", () => {
  const ops = [inc("2026-09-25", 1000), exp("2026-09-26", 100, "b", 1)];
  assert.equal(F.walletBalance(ops), 899);
  assert.equal(F.adjustmentFor(ops, 850), -49, "фактически меньше — минус");
  assert.equal(F.adjustmentFor(ops, 900), 1, "фактически больше — плюс");

  const fixed = [...ops, { kind: "adjust", day: "2026-09-27", amount: -49, fee: 0 }];
  assert.equal(F.walletBalance(fixed), 850, "после правки баланс сходится");
  const plan = F.periodPlan([], fixed, F.periodFor(fixed, "2026-09-27"));
  assert.equal(plan.income, 1000, "правка не попала в приход");
});

check("период считается от прихода, плюс запас на задержку зарплаты", () => {
  const ops = [inc("2026-09-25", 1600)];
  const p = F.periodFor(ops, "2026-09-26");
  assert.equal(p.from, "2026-09-25");
  assert.equal(p.to, "2026-10-27", "месяц плюс три дня запаса");
  assert.equal(F.daysLeftIn(p, "2026-09-26"), 32, "а не 5 дней до конца месяца");
});

check("раздел без лимита только считает потраченное", () => {
  const envelopes = [
    { id: "h", mode: "free", plan: 0, position: 1 },
    { id: "f", mode: "fixed", plan: 250, position: 2 },
  ];
  const ops = [inc("2026-09-25", 1000), exp("2026-09-26", 80, "h"), exp("2026-09-26", 50, "f")];
  const plan = F.periodPlan(envelopes, ops, F.periodFor(ops, "2026-09-26"));
  const [free, fixed] = plan.rows;
  assert.equal(free.unlimited, true);
  assert.equal(free.spent, 80);
  assert.equal(free.left, null, "остатка у него нет по смыслу");
  assert.equal(free.allocated, 0, "и лимит он не резервирует");
  assert.equal(plan.free, 1000 - 250, "в «не разложено» попал только фиксированный раздел");
  assert.equal(plan.reserved, 200, "зарезервировано только по разделам с лимитом");
  assert.equal(fixed.left, 200);
});

check("свободные деньги: баланс минус лимиты и минус отложенное", () => {
  assert.equal(F.spendableNow(1000, 300, 200), 500);
  assert.equal(F.spendableNow(400, 300, 200), -100, "минус значит денег уже не хватает");
});

check("цели копятся и не обнуляются с новой зарплатой", () => {
  const goals = [
    { id: "g1", title: "Горы", target: 500, per_income: 100, position: 1 },
    { id: "g2", title: "Без суммы", target: null, per_income: 50, position: 2 },
  ];
  const save = (goal_id, day, amount) => ({ kind: "save", goal_id, day, amount, fee: 0 });
  const ops = [
    inc("2026-09-25", 1000), save("g1", "2026-09-25", 100),
    inc("2026-10-25", 1000), save("g1", "2026-10-25", 100), save("g2", "2026-10-25", 50),
  ];
  const sum = F.goalsSummary(goals, ops);
  assert.equal(sum.rows[0].saved, 200, "две зарплаты подряд, период не сбросил");
  assert.equal(sum.rows[0].left, 300);
  assert.equal(sum.rows[0].percent, 40);
  assert.equal(sum.rows[0].done, false);
  assert.equal(sum.rows[1].target, null);
  assert.equal(sum.rows[1].percent, null, "без цели процента нет");
  assert.equal(sum.saved, 250, "всего отложено");
});

check("цель считается достигнутой и не уходит выше 100%", () => {
  const goals = [{ id: "g1", target: 100, per_income: 0, position: 1 }];
  const ops = [{ kind: "save", goal_id: "g1", day: "2026-09-25", amount: 140, fee: 0 }];
  const r = F.goalsSummary(goals, ops).rows[0];
  assert.equal(r.done, true);
  assert.equal(r.percent, 100);
  assert.equal(r.left, 0, "ниже нуля не уходим");
});

check("откладывание не трогает кошелёк", () => {
  const ops = [inc("2026-09-25", 1000), { kind: "save", goal_id: "g1", day: "2026-09-25", amount: 100, fee: 0 }];
  assert.equal(F.walletBalance(ops), 1000, "деньги лежат там же, просто помечены");
  assert.equal(F.periodPlan([], ops, F.periodFor(ops, "2026-09-26")).income, 1000,
    "и приходом откладывание не считается");
});

check("утренняя трата не съедает лимит вечерней зарплаты", () => {
  const envelopes = [{ id: "f", mode: "fixed", plan: 250, position: 1 }];
  const ops = [
    inc("2026-09-25", 1000, "2026-09-25T10:00:00Z", "i1"),
    exp("2026-10-23", 20, "f", 0, "2026-10-23T08:00:00Z"),   // утром, из старых денег
    inc("2026-10-23", 1000, "2026-10-23T20:00:00Z", "i2"),   // вечером зарплата
    exp("2026-10-23", 30, "f", 0, "2026-10-23T21:00:00Z"),   // вечером, уже из новых
  ];
  const periods = F.periodsOf(ops, "2026-10-23");
  const fresh = F.periodPlan(envelopes, ops, periods[1]);
  assert.equal(fresh.rows[0].spent, 30, "в новом периоде только вечерняя трата");
  assert.equal(fresh.rows[0].left, 220);
  assert.equal(fresh.income, 1000, "и ровно одна зарплата");

  const old = F.periodPlan(envelopes, ops, periods[0]);
  assert.equal(old.rows[0].spent, 20, "утренние 20 остались в старом периоде, не пропали");
});

check("без времени записи судим по дате, как раньше", () => {
  const envelopes = [{ id: "f", mode: "fixed", plan: 250, position: 1 }];
  const ops = [
    { kind: "expense", day: "2026-10-23", amount: 20, envelope_id: "f", fee: 0 },
    { kind: "income", day: "2026-10-23", amount: 1000, id: "i1" },
  ];
  const plan = F.periodPlan(envelopes, ops, F.periodFor(ops, "2026-10-23"));
  assert.equal(plan.rows[0].spent, 20);
});

check("самый первый период забирает всё, что было до него", () => {
  const envelopes = [{ id: "f", mode: "fixed", plan: 250, position: 1 }];
  const ops = [
    exp("2026-09-01", 15, "f", 0, "2026-09-01T09:00:00Z"),
    inc("2026-09-25", 1000, "2026-09-25T10:00:00Z", "i1"),
  ];
  const plan = F.periodPlan(envelopes, ops, F.periodsOf(ops, "2026-09-26")[0]);
  assert.equal(plan.rows[0].spent, 15, "иначе запись пропала бы со всех экранов");
});

check("следующий приход закрывает прошлый период", () => {
  const ops = [inc("2026-09-25", 1600, "2026-09-25T10:00:00Z", "i1"),
               inc("2026-10-20", 1600, "2026-10-20T10:00:00Z", "i2")];
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
