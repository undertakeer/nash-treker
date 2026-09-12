import { fromISO, todayISO } from "./date";

/** Ключ месяца «2026-09» */
export const monthKey = (iso = todayISO()) => iso.slice(0, 7);

export function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const monthLabel = (key) => {
  const names = ["январь","февраль","март","апрель","май","июнь",
                 "июль","август","сентябрь","октябрь","ноябрь","декабрь"];
  const [y, m] = key.split("-").map(Number);
  return `${names[m - 1]} ${y}`;
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Деньги округляем до копеек и не показываем «-0» */
export const money = (v, currency = "$") => {
  const n = Math.round(num(v) * 100) / 100;
  const body = Number.isInteger(n) ? String(n) : n.toFixed(2);
  const s = body.replace("-0", "0");
  return currency === "$" || currency === "€" ? `${currency}${s}` : `${s} ${currency}`;
};

const inMonth = (op, key) => String(op.day || "").startsWith(key);

/**
 * Раскладка месяца: сколько пришло, сколько отведено каждому конверту,
 * сколько из него потрачено и сколько осталось.
 *
 * Процентные конверты считаются от прихода этого месяца, конверты с
 * фиксированной суммой — по своей сумме. Что не разошлось по конвертам —
 * «свободно».
 */
export function monthPlan(envelopes, ops, key) {
  const monthOps = ops.filter((o) => inMonth(o, key));
  const income = monthOps.filter((o) => o.kind === "income").reduce((s, o) => s + num(o.amount), 0);

  const live = envelopes.filter((e) => !e.archived);
  const rows = live.map((e) => {
    const allocated = e.mode === "percent" ? (income * num(e.plan)) / 100 : num(e.plan);
    const spent = monthOps
      .filter((o) => o.kind === "expense" && o.envelope_id === e.id)
      .reduce((s, o) => s + num(o.amount), 0);
    return { envelope: e, allocated, spent, left: allocated - spent };
  });

  const allocated = rows.reduce((s, r) => s + r.allocated, 0);
  const spent = monthOps.filter((o) => o.kind === "expense").reduce((s, o) => s + num(o.amount), 0);
  // трата без конверта тоже уменьшает кошелёк, но не съедает чужой лимит
  const looseSpent = monthOps
    .filter((o) => o.kind === "expense" && !o.envelope_id)
    .reduce((s, o) => s + num(o.amount), 0);

  return {
    key,
    income,
    allocated,
    spent,
    looseSpent,
    free: income - allocated,
    rows: rows.sort((a, b) => (a.envelope.position || 0) - (b.envelope.position || 0)),
  };
}

/** На кошельке: всё, что пришло, минус всё, что снято — за всё время */
export function walletBalance(ops) {
  return ops.reduce((s, o) => s + (o.kind === "income" ? num(o.amount) : -num(o.amount)), 0);
}

/** Сколько дней осталось в месяце и сколько можно тратить в день */
export function daysLeftInMonth(key, today = todayISO()) {
  if (monthKey(today) !== key) return null;
  const d = fromISO(today);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return last - d.getDate() + 1;
}
