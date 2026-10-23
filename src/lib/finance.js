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

/** Запас на задержку зарплаты: лучше растянуть остаток, чем остаться без денег */
export const PERIOD_BUFFER_DAYS = 3;

/**
 * Периоды считаем не по календарю, а от прихода до прихода: зарплата
 * приходит в свой день, и «осталось на день» должно считаться до следующей
 * зарплаты, а не до 31-го числа.
 */
export function periodsOf(ops, today = todayISO()) {
  const incomes = ops.filter((o) => o.kind === "income");

  // если зарплат за день несколько, период открывает самая ранняя
  const byDay = new Map();
  for (const o of incomes) {
    const prev = byDay.get(o.day);
    if (!prev || atOf(o) < atOf(prev)) byDay.set(o.day, o);
  }
  const starts = [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  if (!starts.length) {
    // прихода ещё не было — показываем текущий календарный месяц
    const from = startOfMonth(today);
    return [{ from, fromAt: null, incomeId: null, first: true, to: addDays(plusMonth(from), -1) }];
  }

  return starts.map((o, i) => {
    const next = starts[i + 1];
    return {
      from: o.day,
      fromAt: o.created_at ?? null,
      incomeId: o.id ?? null,
      first: i === 0,
      // следующий приход закрывает период; пока его нет — месяц плюс запас на
      // задержку, чтобы «на день» считалось с небольшим перестрахованием
      to: next ? addDays(next.day, -1) : addDays(plusMonth(o.day), PERIOD_BUFFER_DAYS - 1),
      nextFrom: next ? next.day : null,
      nextAt: next ? next.created_at ?? null : null,
      nextIncomeId: next ? next.id ?? null : null,
    };
  });
}

const atOf = (op) => {
  const t = Date.parse(op?.created_at || "");
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
};

/**
 * Записана ли операция уже после начала периода. В один день зарплата может
 * прийти вечером, а трата случиться утром — такая трата относится к старому
 * периоду и свежий лимит есть не должна.
 */
function startedAfter(op, from, fromAt, incomeId) {
  if (op.day !== from) return op.day > from;
  if (incomeId && op.id === incomeId) return true;
  const a = Date.parse(op.created_at || "");
  const b = Date.parse(fromAt || "");
  // без времени записи судить не о чем — считаем по старому, по дате
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return a >= b;
}

/** Период, в который попадает день (последний начавшийся до него) */
export function periodFor(ops, day = todayISO()) {
  const list = periodsOf(ops, day);
  const started = list.filter((p) => p.from <= day);
  return started.length ? started[started.length - 1] : list[0];
}

export function periodLabel(period) {
  const months = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  const fmt = (iso) => {
    const d = fromISO(iso);
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };
  return `${fmt(period.from)} — ${fmt(period.to)}`;
}

function inPeriod(op, period) {
  const started = startedAfter(op, period.from, period.fromAt, period.incomeId);
  // самый первый период забирает и всё, что было до него: иначе старые
  // записи просто пропали бы из всех экранов
  if (!started) return Boolean(period.first);
  if (!period.nextFrom) return true;
  return !startedAfter(op, period.nextFrom, period.nextAt, period.nextIncomeId);
}

export function periodPlan(envelopes, ops, period) {
  const mine = ops.filter((o) => inPeriod(o, period));
  const income = mine.filter((o) => o.kind === "income").reduce((s, o) => s + num(o.amount), 0);
  // правки баланса не считаем приходом: они не про заработок, а про сверку

  const live = envelopes.filter((e) => !e.archived);
  const rows = live.map((e) => {
    // раздел без лимита ничего не резервирует — он только считает потраченное
    const free = e.mode === "free";
    const allocated = free
      ? 0
      : e.mode === "percent"
      ? roundAllocation((income * num(e.plan)) / 100)
      : cents(e.plan);
    const spent = mine
      .filter((o) => o.kind === "expense" && o.envelope_id === e.id)
      .reduce((s, o) => s + withFee(o), 0);
    return {
      envelope: e,
      unlimited: free,
      allocated,
      spent,
      left: free ? null : cents(allocated - spent),
    };
  });

  const allocated = rows.reduce((s, r) => s + r.allocated, 0);
  const spent = mine.filter((o) => o.kind === "expense").reduce((s, o) => s + withFee(o), 0);
  const looseSpent = mine
    .filter((o) => o.kind === "expense" && !o.envelope_id)
    .reduce((s, o) => s + withFee(o), 0);
  const fees = mine.reduce((s, o) => s + num(o.fee), 0);
  // ещё не потраченные лимиты: столько денег должно остаться на кошельке
  const reserved = rows.reduce((s, r) => s + Math.max(0, r.left ?? 0), 0);

  return {
    period,
    income,
    allocated,
    spent,
    looseSpent,
    fees,
    free: cents(income - allocated),
    reserved: cents(reserved),
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
    if (o.kind === "income" || o.kind === "adjust") return s + num(o.amount);
    // откладывание под цель деньги с кошелька не уносит: они просто помечены
    if (o.kind !== "expense") return s;
    return hitsWallet(o) ? s - withFee(o) : s;
  }, 0));
}

/**
 * Цели-накопления. В отличие от разделов не обнуляются с новой зарплатой:
 * откладывания копятся, и видно, сколько уже собрано.
 */
export function goalsSummary(goals, ops, period = null, periodIncome = 0) {
  const live = goals.filter((g) => !g.archived);
  const mine = period ? ops.filter((o) => inPeriod(o, period)) : [];

  const rows = live.map((g) => {
    const saved = cents(
      ops.filter((o) => o.kind === "save" && o.goal_id === g.id).reduce((s, o) => s + num(o.amount), 0)
    );
    const target = g.target === null || g.target === undefined ? null : cents(g.target);

    // сколько полагается внести в этом периоде и сколько уже внесено
    const due = g.per_mode === "percent"
      ? roundAllocation((num(periodIncome) * num(g.per_income)) / 100)
      : cents(g.per_income);
    const paid = cents(
      mine.filter((o) => o.kind === "save" && o.goal_id === g.id).reduce((s, o) => s + num(o.amount), 0)
    );

    return {
      goal: g,
      saved,
      target,
      left: target === null ? null : cents(Math.max(0, target - saved)),
      percent: target ? Math.min(100, Math.round((saved / target) * 100)) : null,
      done: target !== null && saved >= target,
      due,
      paid,
      pending: cents(Math.max(0, due - paid)),
      // взнос за период закрыт: либо внесли сколько надо, либо вносить нечего
      settled: due <= 0 || paid >= due,
    };
  });

  return {
    rows: rows.sort((a, b) => (a.goal.position || 0) - (b.goal.position || 0)),
    saved: cents(rows.reduce((s, r) => s + r.saved, 0)),
    pending: cents(rows.reduce((s, r) => s + r.pending, 0)),
  };
}

/**
 * Сколько с кошелька можно тратить свободно: баланс минус неизрасходованные
 * лимиты разделов и минус отложенное под цели. Если ушло в минус — денег на
 * кошельке уже не хватает на то, что расписано.
 */
export function spendableNow(balance, reserved, saved) {
  return cents(num(balance) - num(reserved) - num(saved));
}

/** Разница между фактическим остатком и посчитанным — для правки баланса */
export const adjustmentFor = (ops, actual) => cents(num(actual) - walletBalance(ops));

/** Сколько дней периода ещё впереди, считая сегодняшний */
export function daysLeftIn(period, today = todayISO()) {
  if (today < period.from || today > period.to) return null;
  const ms = fromISO(period.to) - fromISO(today);
  return Math.round(ms / 86400000) + 1;
}
