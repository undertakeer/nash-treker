/* Таблица правил для денег: что откуда берётся и что где считается.
   Каждая строка — одна операция, каждый столбец — куда она влияет.
   Запуск: npm run rules */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSync } from "esbuild";

const tmp = path.join(os.tmpdir(), `nt-rules-${process.pid}.mjs`);
buildSync({ entryPoints: ["src/lib/finance.js"], bundle: true, format: "esm",
            platform: "node", outfile: tmp, logLevel: "silent" });
const F = await import(`file://${tmp}`);
fs.rmSync(tmp, { force: true });

const DAY = "2026-10-24";
const SALARY = "2026-10-22";
const at = (d, h) => `${d}T${String(h).padStart(2, "0")}:00:00Z`;

/** Разбор одного сценария: что получилось по всем показателям */
function evaluate({ goals = [], envelopes = [], ops = [] }) {
  const period = F.periodFor(ops, DAY);
  const plan = F.periodPlan(envelopes, ops, period);
  const g = F.goalsSummary(goals, ops, period, plan.income);
  return {
    "кошелёк": F.walletBalance(ops),
    "приход периода": plan.income,
    "снято за период": plan.spent,
    "зарезервировано": plan.reserved,
    "не разложено": plan.free,
    "отложено с кошелька": g.earmarked,
    "накоплено всего": g.saved,
    "взнос за период": g.rows.reduce((s, r) => s + r.paid, 0),
    "свободно": F.spendableNow(F.walletBalance(ops), plan.reserved, g.earmarked),
  };
}

const income = { kind: "income", id: "i1", day: SALARY, amount: 1000, fee: 0, created_at: at(SALARY, 10) };
const envFixed = { id: "e1", mode: "fixed", plan: 300, position: 1 };
const envFree = { id: "e2", mode: "free", plan: 0, position: 2 };
const goal = { id: "g1", target: 4000, per_mode: "fixed", per_income: 550, opening: 0, position: 1 };

const rows = [];
let bad = 0;

function rule(name, scenario, expected) {
  const got = evaluate(scenario);
  const diff = Object.entries(expected).filter(([k, v]) => got[k] !== v);
  rows.push({ name, got, ok: !diff.length });
  if (diff.length) {
    bad++;
    console.error(`\nНЕ СХОДИТСЯ: ${name}`);
    for (const [k, v] of diff) console.error(`  ${k}: ожидали ${v}, получили ${got[k]}`);
  }
}

// ---------- приход ----------
rule("приход 1000", { envelopes: [envFixed], goals: [goal], ops: [income] }, {
  "кошелёк": 1000, "приход периода": 1000, "зарезервировано": 300,
  "не разложено": 700, "отложено с кошелька": 0, "взнос за период": 0, "свободно": 700,
});

// ---------- трата с кошелька ----------
rule("трата 100 с кошелька, комиссия 1", {
  envelopes: [envFixed], goals: [goal],
  ops: [income, { kind: "expense", day: DAY, amount: 100, fee: 1, envelope_id: "e1", created_at: at(DAY, 9) }],
}, {
  "кошелёк": 899, "снято за период": 101, "зарезервировано": 199,
  "не разложено": 700, "свободно": 700,
});

// ---------- трата мимо кошелька ----------
rule("трата 100 не с кошелька", {
  envelopes: [envFixed], goals: [goal],
  ops: [income, { kind: "expense", day: DAY, amount: 100, fee: 0, envelope_id: "e1",
                  off_wallet: true, created_at: at(DAY, 9) }],
}, {
  "кошелёк": 1000, "снято за период": 100, "зарезервировано": 200, "свободно": 800,
});

// ---------- раздел без лимита ----------
rule("трата 80 в раздел без лимита", {
  envelopes: [envFixed, envFree], goals: [goal],
  ops: [income, { kind: "expense", day: DAY, amount: 80, fee: 0, envelope_id: "e2", created_at: at(DAY, 9) }],
}, {
  "кошелёк": 920, "снято за период": 80, "зарезервировано": 300,
  "не разложено": 700, "свободно": 620,
});

// ---------- трата без раздела ----------
rule("трата 50 без раздела", {
  envelopes: [envFixed], goals: [goal],
  ops: [income, { kind: "expense", day: DAY, amount: 50, fee: 0, envelope_id: null, created_at: at(DAY, 9) }],
}, {
  "кошелёк": 950, "снято за период": 50, "зарезервировано": 300, "свободно": 650,
});

// ---------- правка баланса ----------
rule("правка баланса −50", {
  envelopes: [envFixed], goals: [goal],
  ops: [income, { kind: "adjust", day: DAY, amount: -50, fee: 0, created_at: at(DAY, 9) }],
}, {
  "кошелёк": 950, "приход периода": 1000, "снято за период": 0, "свободно": 650,
});

// ---------- откладывание операцией ----------
rule("отложено 550 операцией", {
  envelopes: [envFixed], goals: [goal],
  ops: [income, { kind: "save", goal_id: "g1", day: DAY, amount: 550, fee: 0, created_at: at(DAY, 9) }],
}, {
  "кошелёк": 1000, "приход периода": 1000, "снято за период": 0,
  "отложено с кошелька": 550, "накоплено всего": 550, "взнос за период": 550, "свободно": 150,
});

// ---------- накопленное до учёта ----------
rule("1040 было до учёта, операций нет", {
  envelopes: [envFixed], goals: [{ ...goal, opening: 1040 }], ops: [income],
}, {
  "кошелёк": 1000, "отложено с кошелька": 0, "накоплено всего": 1040,
  "взнос за период": 0, "свободно": 700,
});

// ---------- то и другое вместе ----------
rule("1040 до учёта плюс 550 операцией", {
  envelopes: [envFixed], goals: [{ ...goal, opening: 1040 }],
  ops: [income, { kind: "save", goal_id: "g1", day: DAY, amount: 550, fee: 0, created_at: at(DAY, 9) }],
}, {
  "накоплено всего": 1590, "отложено с кошелька": 550, "взнос за период": 550, "свободно": 150,
});

// ---------- границы периода ----------
rule("утренняя трата до вечерней зарплаты", {
  envelopes: [envFixed], goals: [goal],
  ops: [
    { kind: "income", id: "i0", day: "2026-09-22", amount: 1000, fee: 0, created_at: at("2026-09-22", 10) },
    { kind: "expense", day: SALARY, amount: 20, fee: 0, envelope_id: "e1", created_at: at(SALARY, 8) },
    income,
  ],
}, {
  "кошелёк": 1980, "приход периода": 1000, "снято за период": 0,
  "зарезервировано": 300, "свободно": 1680,
});

rule("взнос прошлого периода не засчитан в текущий", {
  envelopes: [envFixed], goals: [goal],
  ops: [
    { kind: "income", id: "i0", day: "2026-09-22", amount: 1000, fee: 0, created_at: at("2026-09-22", 10) },
    { kind: "save", goal_id: "g1", day: "2026-09-22", amount: 550, fee: 0, created_at: at("2026-09-22", 11) },
    income,
  ],
}, {
  "накоплено всего": 550, "взнос за период": 0, "отложено с кошелька": 550,
});

// ---------- таблица ----------
const cols = Object.keys(rows[0].got);
const w = Math.max(...rows.map((r) => r.name.length));
console.log("\n" + "".padEnd(w) + " │ " + cols.map((c) => c.slice(0, 11).padStart(11)).join(" │ "));
console.log("".padEnd(w, "─") + "─┼─" + cols.map(() => "".padEnd(11, "─")).join("─┼─"));
for (const r of rows) {
  console.log(
    (r.ok ? "" : "✗ ") + r.name.padEnd(r.ok ? w : w - 2) + " │ " +
    cols.map((c) => String(r.got[c]).padStart(11)).join(" │ ")
  );
}
console.log(bad ? `\nПРАВИЛА НЕ СХОДЯТСЯ: ${bad}` : `\nвсе ${rows.length} правил сходятся`);
process.exit(bad ? 1 : 0);
