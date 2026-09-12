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
  entryPoints: ["src/lib/meds.js"],
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

check("dayPartOf: раскладка по частям дня", () => {
  assert.equal(M.dayPartOf("07:30").id, "morning");
  assert.equal(M.dayPartOf("13:00").id, "day");
  assert.equal(M.dayPartOf("21:00").id, "evening");
  assert.equal(M.dayPartOf("23:15").id, "night");
});

console.log(process.exitCode ? "модульные проверки: ЕСТЬ ПАДЕНИЯ" : `модульные проверки: ${passed} ок`);
