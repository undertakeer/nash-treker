import { addDays, fromISO, todayISO } from "./date";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const cents = (v) => Math.round(num(v) * 100) / 100;

/** Доля от прихода округляется вверх до десятков: бюджет удобнее круглый */
export const roundAllocation = (v) => Math.ceil(cents(v) / 10) * 10;

/** Всё остальное показываем без копеек, отбрасывая их в свою пользу */
export const roundDown = (v) => Math.trunc(cents(v));

export const money = (v, currency = "$") => {
  const exact = cents(v);
  const n = roundDown(exact);
  // копейки отбрасываем, но если от суммы при этом ничего не остаётся,
  // показываем как есть: иначе введённые 0.80 выглядят как «ничего»
  if (n === 0 && exact !== 0) return moneyExact(exact, currency);
  return currency === "$" || currency === "€" ? `${currency}${n}` : `${n} ${currency}`;
};

/** Точная сумма с копейками — для истории операций */
export const moneyExact = (v, currency = "$") => {
  const n = cents(v);
  const body = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return currency === "$" || currency === "€" ? `${currency}${body}` : `${body} ${currency}`;
};

/**
 * Разбор суммы из поля ввода. Поле текстовое, а не number: браузер у
 * type="number" молча съедает запятую целиком, и «0,80» приходит пустой
 * строкой. Принимаем и запятую, и точку, пробелы выкидываем.
 */
export function parseAmount(raw) {
  const s = String(raw ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!s || s === "." || !/^\d*\.?\d*$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? cents(n) : null;
}

/** То, что можно оставить в поле во время набора: цифры и один разделитель */
export function cleanAmountInput(raw) {
  const s = String(raw ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  const [head, ...rest] = s.split(".");
  return rest.length ? `${head}.${rest.join("").slice(0, 2)}` : head;
}

/** Комиссия за снятие: считаем от суммы траты */
export const feeFor = (amount, percent) => cents((num(amount) * num(percent)) / 100);

/** Полная стоимость траты — сумма плюс удержанная комиссия */
export const withFee = (op) => cents(num(op.amount) + num(op.fee));

/** Уменьшает ли операция кошелёк: часть трат идёт мимо него */
export const hitsWallet = (op) => op.kind !== "expense" || !op.off_wallet;

const plusMonth = (iso) => {
  const d = fromISO(iso);
  const day = d.getDate();
  const shifted = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const last = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, last));
  const p = (n) => String(n).padStart(2, "0");
  return `${shifted.getFullYear()}-${p(shifted.getMonth() + 1)}-${p(shifted.getDate())}`;
};

const startOfMonth = (iso) => `${iso.slice(0, 7)}-01`;

/**
 * Периоды считаем не по календарю, а от прихода до прихода: зарплата
 * приходит в свой день, и «осталось на день» должно считаться до следующей
 * зарплаты, а не до 31-го числа.
 */
export function periodsOf(ops, today = todayISO()) {
  const incomes = ops
    .filter((o) => o.kind === "income")
    .map((o) => o.day)
    .sort();
  const starts = [...new Set(incomes)];

  if (!starts.length) {
    // прихода ещё не было — показываем текущий календарный месяц
    const from = startOfMonth(today);
    return [{ from, to: addDays(plusMonth(from), -1) }];
  }

  return starts.map((from, i) => ({
    from,
    // следующий приход закрывает период, иначе считаем месяц вперёд
    to: i + 1 < starts.length ? addDays(starts[i + 1], -1) : addDays(plusMonth(from), -1),
  }));
}

/** Период, в который попадает день (последний начавшийся до него) */
export function periodFor(ops, day = todayISO()) {
  const list = periodsOf(ops, day);
  const started = list.filter((p) => p.from <= day);
  return started.length ? started[started.length - 1] : list[0];
}

export function periodLabel(period, today = todayISO()) {
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  const fmt = (iso) => {
    const d = fromISO(iso);
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };
  const current = period.from <= today && today <= period.to;
  return `${fmt(period.from)} — ${fmt(period.to)}${current ? "" : ""}`;
}

const inPeriod = (op, period) => op.day >= period.from && op.day <= period.to;

/**
 * Раскладка периода: сколько пришло, сколько отведено каждому разделу,
 * сколько из него снято (вместе с комиссией) и сколько осталось.
 */
export function periodPlan(envelopes, ops, period) {
  const mine = ops.filter((o) => inPeriod(o, period));
  const income = mine.filter((o) => o.kind === "income").reduce((s, o) => s + num(o.amount), 0);
  // правки баланса не считаем приходом: они не про заработок, а про сверку

  const live = envelopes.filter((e) => !e.archived);
  const rows = live.map((e) => {
    const allocated = e.mode === "percent"
      ? roundAllocation((income * num(e.plan)) / 100)
      : cents(e.plan);
    const spent = mine
      .filter((o) => o.kind === "expense" && o.envelope_id === e.id)
      .reduce((s, o) => s + withFee(o), 0);
    return { envelope: e, allocated, spent, left: cents(allocated - spent) };
  });

  const allocated = rows.reduce((s, r) => s + r.allocated, 0);
  const spent = mine.filter((o) => o.kind === "expense").reduce((s, o) => s + withFee(o), 0);
  const looseSpent = mine
    .filter((o) => o.kind === "expense" && !o.envelope_id)
    .reduce((s, o) => s + withFee(o), 0);
  const fees = mine.reduce((s, o) => s + num(o.fee), 0);

  return {
    period,
    income,
    allocated,
    spent,
    looseSpent,
    fees,
    free: cents(income - allocated),
    rows: rows.sort((a, b) => (a.envelope.position || 0) - (b.envelope.position || 0)),
  };
}

/**
 * На кошельке: приходы минус снятия с комиссиями, плюс правки баланса.
 * Траты, помеченные «не с кошелька», в баланс не входят — они записаны
 * ради лимита раздела, а деньги на них брались не отсюда.
 */
export function walletBalance(ops) {
  return cents(ops.reduce((s, o) => {
    if (o.kind === "income") return s + num(o.amount);
    if (o.kind === "adjust") return s + num(o.amount);
    return hitsWallet(o) ? s - withFee(o) : s;
  }, 0));
}

/** Разница между фактическим остатком и посчитанным — для правки баланса */
export const adjustmentFor = (ops, actual) => cents(num(actual) - walletBalance(ops));

/** Сколько дней периода ещё впереди, считая сегодняшний */
export function daysLeftIn(period, today = todayISO()) {
  if (today < period.from || today > period.to) return null;
  const ms = fromISO(period.to) - fromISO(today);
  return Math.round(ms / 86400000) + 1;
}
