import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MissingTable from "../components/MissingTable";
import { Button, Empty, Field, Progress, Switch, TextInput } from "../components/ui";
import Sheet from "../components/Sheet";
import EmojiPicker from "../components/EmojiPicker";
import { useStore } from "../lib/store";
import { COLORS, COLOR_KEYS, hex, rgba } from "../lib/theme";
import { addDays, humanDate, todayISO } from "../lib/date";
import {
  adjustmentFor, cleanAmountInput, daysLeftIn, feeFor, hitsWallet, money, moneyExact,
  parseAmount, periodLabel, periodPlan, periodsOf, walletBalance, withFee,
} from "../lib/finance";

const EMOJI = [
  "💵","💰","🏦","💳","🐖","💗","🤖","💊","🩹","🍔","🛒","🏠","🚗","⛽️","📱","🎮",
  "👕","✈️","🎁","☕️","🍿","🏋️","📚","🐈","🔧","💡","🧾","🎓","🪙","📈",
];

export default function Money({ onOpenOps }) {
  const { me, envelopes, finOps, missing, addFinOp } = useStore();
  const feePercent = Number(me?.fin_fee_percent ?? 1);
  const currency = me?.fin_currency || "$";
  const today = todayISO();

  const [editor, setEditor] = useState(null);   // { envelope } | { envelope: null }
  const [spend, setSpend] = useState(null);     // раздел, из которого пишем трату
  const [income, setIncome] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const [detail, setDetail] = useState(null);   // раздел, открытый со историей
  const [fixBalance, setFixBalance] = useState(false);
  const [editOp, setEditOp] = useState(null);

  // периоды идут от прихода до прихода, а не по календарю
  const periods = useMemo(() => periodsOf(finOps, today), [finOps, today]);
  const [index, setIndex] = useState(null);
  const at = index === null ? periods.length - 1 : Math.min(index, periods.length - 1);
  const period = periods[at];

  const plan = useMemo(() => periodPlan(envelopes, finOps, period), [envelopes, finOps, period]);
  const balance = useMemo(() => walletBalance(finOps), [finOps]);
  const daysLeft = daysLeftIn(period, today);

  // израсходованные разделы уезжают в отдельную шторку, чтобы не мешали
  const openRows = plan.rows.filter((r) => r.left > 0);
  const closedRows = plan.rows.filter((r) => r.left <= 0);
  const live = plan.rows.length;

  return (
    <div className="px-4 pb-8">
      <header className="safe-top pt-2 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold tracking-[0.14em] text-white/35 uppercase mb-1">
              Кошелёк
            </div>
            <h1 className="text-[29px] font-extrabold tracking-tight leading-none">Деньги</h1>
          </div>
          <button
            onClick={() => setEditor({ envelope: null })}
            className="press w-11 h-11 shrink-0 rounded-full bg-white/10 border border-white/10 grid place-items-center text-[22px] font-light leading-none pb-0.5"
            aria-label="Новый раздел"
          >
            +
          </button>
        </div>
      </header>

      {missing.includes("fin_envelopes") && <MissingTable what="Деньги" />}

      {/* кошелёк целиком */}
      <div
        className="rounded-3xl p-5 mb-3"
        style={{
          background: `linear-gradient(168deg, ${rgba("mint", 0.14)} 0%, ${rgba("mint", 0.4)} 100%), #0F0F14`,
          border: `1px solid ${rgba("mint", 0.2)}`,
        }}
      >
        <div className="text-[12px] font-bold tracking-[0.14em] uppercase text-white/45 mb-1.5">
          На кошельке
        </div>
        <button
          onClick={() => setFixBalance(true)}
          className="press text-[38px] font-extrabold leading-none flex items-baseline gap-2"
        >
          {money(balance, currency)}
          <span className="text-[14px] font-semibold text-white/40">поправить</span>
        </button>
        <div className="text-[12.5px] text-white/45 mt-2">
          с {humanDate(period.from)}: пришло {money(plan.income, currency)} · снято {money(plan.spent, currency)}
          {plan.fees > 0 ? ` · комиссия ${moneyExact(plan.fees, currency)}` : ""}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => setIncome(true)}
            className="press py-2.5 rounded-xl text-[13.5px] font-bold"
            style={{ background: hex("mint"), color: "#0A0A0E" }}
          >
            Пришли деньги
          </button>
          <button
            onClick={() => setSpend({ id: null, title: "Без раздела", emoji: "💸", color: "slate" })}
            className="press py-2.5 rounded-xl text-[13.5px] font-bold bg-white/10"
          >
            Записать трату
          </button>
        </div>
      </div>

      {/* месяц */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={() => setIndex(Math.max(0, at - 1))}
          disabled={at <= 0}
          className="press w-8 h-8 rounded-full bg-white/8 grid place-items-center text-[14px] text-white/50 disabled:opacity-25"
          aria-label="Предыдущий период"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-[14px] font-bold">{periodLabel(period, today)}</div>
          {daysLeft !== null && (
            <div className="text-[11.5px] text-white/35">осталось {daysLeft} дн. до следующего прихода</div>
          )}
        </div>
        <button
          onClick={() => setIndex(Math.min(periods.length - 1, at + 1))}
          disabled={at >= periods.length - 1}
          className="press w-8 h-8 rounded-full bg-white/8 grid place-items-center text-[14px] text-white/50 disabled:opacity-25"
          aria-label="Следующий период"
        >
          ›
        </button>
      </div>

      {/* свободный остаток */}
      {live > 0 && (
        <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-3 mb-3 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-semibold text-white/45">Не разложено</div>
            {plan.looseSpent > 0 && (
              <div className="text-[11.5px] text-white/30 mt-0.5">
                траты без раздела: {money(plan.looseSpent, currency)}
              </div>
            )}
          </div>
          <div
            className="text-[17px] font-extrabold"
            style={{ color: plan.free < 0 ? hex("rose") : "#fff" }}
          >
            {money(plan.free, currency)}
          </div>
        </div>
      )}

      {!live ? (
        <Empty
          emoji="💰"
          title="Разделов пока нет"
          subtitle="Добавьте направления: накопления, еда, подписки. Можно долей от прихода или фиксированной суммой — и станет видно, сколько ещё можно тратить."
        />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {openRows.map((row) => (
              <EnvelopeRow
                key={row.envelope.id}
                row={row}
                currency={currency}
                income={plan.income}
                daysLeft={daysLeft}
                onSpend={() => setSpend(row.envelope)}
                onEdit={() => setDetail(row.envelope)}
              />
            ))}
          </AnimatePresence>

          {closedRows.length > 0 && (
            <button
              onClick={() => setClosedOpen(true)}
              className="press w-full py-3 rounded-2xl bg-white/5 border border-white/8 text-[14px] font-semibold text-white/55 flex items-center justify-center gap-2"
            >
              Израсходованы · {closedRows.length}
              <span className="text-white/25">›</span>
            </button>
          )}

          <button
            onClick={() => setEditor({ envelope: null })}
            className="press w-full py-3 rounded-2xl bg-white/5 border border-dashed border-white/15 text-[14px] font-semibold text-white/55"
          >
            ➕ Ещё раздел
          </button>

          <button
            onClick={onOpenOps}
            className="press w-full py-3 rounded-2xl bg-white/5 text-[14px] font-semibold text-white/55"
          >
            История операций
          </button>
        </div>
      )}

      <ClosedEnvelopes
        open={closedOpen}
        rows={closedRows}
        currency={currency}
        onClose={() => setClosedOpen(false)}
        onSpend={(e) => { setClosedOpen(false); setSpend(e); }}
        onEdit={(e) => { setClosedOpen(false); setDetail(e); }}
      />

      <EnvelopeDetail
        envelope={detail}
        row={detail ? plan.rows.find((r) => r.envelope.id === detail.id) : null}
        ops={detail ? finOps.filter((o) => o.envelope_id === detail.id) : []}
        currency={currency}
        onClose={() => setDetail(null)}
        onSpend={() => { const e = detail; setDetail(null); setSpend(e); }}
        onSettings={() => { const e = detail; setDetail(null); setEditor({ envelope: e }); }}
        onOpenOp={(op) => { setDetail(null); setEditOp(op); }}
      />

      <BalanceFix
        open={fixBalance}
        currency={currency}
        balance={balance}
        today={today}
        onClose={() => setFixBalance(false)}
        onSubmit={async (actual) => {
          const delta = adjustmentFor(finOps, actual);
          if (delta !== 0) {
            await addFinOp({ envelope_id: null, kind: "adjust", amount: delta, note: "правка баланса", day: today });
          }
          setFixBalance(false);
        }}
      />

      <OpEditor
        op={editOp}
        currency={currency}
        feePercent={feePercent}
        envelopes={envelopes}
        onClose={() => setEditOp(null)}
      />

      <EnvelopeEditor
        open={Boolean(editor)}
        envelope={editor?.envelope || null}
        currency={currency}
        emojiList={EMOJI}
        onClose={() => setEditor(null)}
      />

      <SpendSheet
        envelope={spend}
        currency={currency}
        onClose={() => setSpend(null)}
        feePercent={feePercent}
        onSubmit={async (amount, note, day, extra) => {
          await addFinOp({
            envelope_id: spend?.id || null,
            kind: "expense",
            amount,
            note: note || null,
            day: today,
            off_wallet: extra.offWallet,
            fee: extra.offWallet || !extra.takeFee ? 0 : feeFor(amount, feePercent),
          });
          setSpend(null);
        }}
      />

      <IncomeSheet
        open={income}
        currency={currency}
        today={today}
        onClose={() => setIncome(false)}
        onSubmit={async (amount, note, day) => {
          await addFinOp({ envelope_id: null, kind: "income", amount, note: note || null, day });
          setIncome(false);
          setIndex(null);
        }}
      />
    </div>
  );
}

function EnvelopeRow({ row, currency, income, daysLeft, onSpend, onEdit }) {
  const { envelope: e, allocated, spent, left } = row;
  const color = e.color || "mint";
  const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
  const over = left < 0;
  // у разовых трат вроде связи или подписки дневной темп ничего не значит
  const perDay = e.show_pace !== false && daysLeft && left > 0 ? left / daysLeft : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
      <div
        className="rounded-[22px] p-4"
        style={{
          background: `linear-gradient(168deg, ${rgba(color, 0.1)} 0%, ${rgba(color, 0.28)} 100%), #0F0F14`,
          border: `1px solid ${rgba(over ? "rose" : color, over ? 0.4 : 0.18)}`,
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={onEdit}
          onKeyDown={(ev) => { if (ev.key === "Enter") onEdit(); }}
          className="flex items-start gap-3 cursor-pointer"
        >
          <span className="text-[21px] leading-none shrink-0">{e.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15.5px] font-bold truncate">
              {e.title}
              {e.mode === "percent" && (
                <span className="text-white/40 font-semibold"> · {Number(e.plan)}%</span>
              )}
            </div>
            <div className="text-[12.5px] text-white/45">
              из {money(allocated, currency)}
              {e.mode === "percent" && income > 0 ? " от прихода" : ""}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div
              className="text-[19px] font-extrabold leading-none"
              style={{ color: over ? hex("rose") : hex(color) }}
            >
              {money(left, currency)}
            </div>
            <div className="text-[11px] text-white/35 mt-1">осталось</div>
          </div>
        </div>

        <div className="mt-3">
          <Progress percent={pct} colorKey={over ? "rose" : color} />
          <div className="flex items-center justify-between mt-2">
            <div className="text-[11.5px] text-white/35">
              потрачено {money(spent, currency)}
              {perDay ? ` · ещё ${money(perDay, currency)} в день` : ""}
            </div>
            <button
              onClick={onSpend}
              className="press px-3 py-1.5 rounded-lg text-[12px] font-bold"
              style={{ background: rgba(color, 0.22), color: hex(color) }}
            >
              Трата
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AmountSheet({
  open, title, hint, actionLabel, colorKey, currency, onClose, onSubmit,
  withDate = false, withOptions = false, today, feePercent = 0,
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(today);
  const [takeFee, setTakeFee] = useState(true);
  const [offWallet, setOffWallet] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDay(today);
    setTakeFee(true);
    setOffWallet(false);
  }, [open, today]);

  const value = parseAmount(amount);
  const valid = value !== null && value > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(value, note.trim(), day, { takeFee, offWallet });
      setAmount("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-10">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{title}</div>
          <span className="w-14" />
        </div>

        <div className="space-y-5">
          <Field label="Сколько" hint={hint}>
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-extrabold text-white/35 shrink-0">{currency}</span>
              <TextInput
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(cleanAmountInput(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="0"
                className="flex-1 min-w-0 text-[20px] font-extrabold"
                autoFocus
              />
            </div>
          </Field>

          {withOptions && (
            <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/6">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <div className="text-[14.5px] font-semibold">Снято с кошелька</div>
                  <div className="text-[12.5px] text-white/35 leading-relaxed">
                    Выключите, если платили не с крипты. Лимит раздела спишется,
                    баланс кошелька не тронем.
                  </div>
                </div>
                <Switch checked={!offWallet} onChange={(v) => setOffWallet(!v)} />
              </div>
              {!offWallet && feePercent > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div>
                    <div className="text-[14.5px] font-semibold">Комиссия {feePercent}%</div>
                    <div className="text-[12.5px] text-white/35 leading-relaxed">
                      Наличкой в офисе или картой — комиссии нет, выключите.
                    </div>
                  </div>
                  <Switch checked={takeFee} onChange={setTakeFee} />
                </div>
              )}
            </div>
          )}

          {withOptions && valid && !offWallet && takeFee && feePercent > 0 && (
            <div className="text-[12.5px] text-white/40 -mt-2">
              Комиссия — {moneyExact(feeFor(value, feePercent), currency)}.
              С кошелька уйдёт {moneyExact(value + feeFor(value, feePercent), currency)}.
            </div>
          )}

          {withDate && (
            <Field label="Когда пришли" hint="От этой даты считается период: остаток делится до следующего прихода.">
              <div className="flex gap-2 mb-2">
                {[
                  { v: today, t: "Сегодня" },
                  { v: addDays(today, -1), t: "Вчера" },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setDay(o.v)}
                    className="press flex-1 py-2.5 rounded-xl text-[13px] font-bold"
                    style={{
                      background: day === o.v ? hex(colorKey) : "rgba(255,255,255,.06)",
                      color: day === o.v ? "#0A0A0E" : "rgba(255,255,255,.55)",
                    }}
                  >
                    {o.t}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={day}
                max={today}
                onChange={(e) => setDay(e.target.value || today)}
                className="w-full px-4 py-3 rounded-2xl bg-white/6 border border-white/10 outline-none font-semibold"
              />
            </Field>
          )}

          <Field label="На что">
            <TextInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="Необязательно"
              maxLength={100}
            />
          </Field>

          <Button onClick={submit} disabled={!valid || busy} colorKey={colorKey}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function SpendSheet({ envelope, currency, feePercent, onClose, onSubmit }) {
  return (
    <AmountSheet
      open={Boolean(envelope)}
      title={envelope ? `${envelope.emoji} ${envelope.title}` : ""}
      hint="Записываем, что снято с кошелька."
      actionLabel="Записать трату"
      colorKey={envelope?.color || "rose"}
      currency={currency}
      feePercent={feePercent}
      withOptions
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function IncomeSheet({ open, currency, today, onClose, onSubmit }) {
  return (
    <AmountSheet
      open={open}
      title="Пришли деньги"
      hint="Приход добавится на кошелёк и разойдётся по долям."
      actionLabel="Записать приход"
      colorKey="mint"
      currency={currency}
      withDate
      today={today}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

/** Одна строка истории: дата, на что, сумма и пометки */
function OpLine({ op, currency, onClick }) {
  const plus = op.kind === "income" || (op.kind === "adjust" && Number(op.amount) > 0);
  const adjust = op.kind === "adjust";
  const amount = op.kind === "expense" ? withFee(op) : Math.abs(Number(op.amount));

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="press w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white/4 border border-white/6 text-left"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold truncate">
          {op.note || (adjust ? "Правка баланса" : plus ? "Приход" : "Трата")}
        </span>
        <span className="block text-[12px] text-white/35 truncate">
          {humanDate(op.day)}
          {op.kind === "expense" && op.off_wallet ? " · не с кошелька" : ""}
          {op.kind === "expense" && Number(op.fee) > 0 ? ` · комиссия ${moneyExact(op.fee, currency)}` : ""}
        </span>
      </span>
      <span
        className="text-[15px] font-extrabold shrink-0"
        style={{ color: plus ? hex("mint") : adjust ? hex("amber") : "#fff" }}
      >
        {plus ? "+" : "−"}{moneyExact(amount, currency)}
      </span>
      {onClick && <span className="text-[15px] text-white/20 shrink-0">›</span>}
    </button>
  );
}

/** Раздел целиком: сколько осталось и все траты по нему */
function EnvelopeDetail({ envelope, row, ops, currency, onClose, onSpend, onSettings, onOpenOp }) {
  const e = envelope;
  const color = e?.color || "mint";
  const history = [...ops].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const total = ops.reduce((s, o) => s + withFee(o), 0);

  return (
    <Sheet open={Boolean(e)} onClose={onClose} tall>
      {e && (
        <div className="px-5 pb-12">
          <div className="flex items-center justify-between py-3">
            <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
            <div className="text-[15px] font-bold truncate px-3">{e.title}</div>
            <button onClick={onSettings} className="press text-[15px] font-bold" style={{ color: hex(color) }}>
              Настроить
            </button>
          </div>

          {row && (
            <div
              className="rounded-3xl p-5 mb-4"
              style={{
                background: `linear-gradient(168deg, ${rgba(color, 0.12)} 0%, ${rgba(color, 0.34)} 100%), #0F0F14`,
                border: `1px solid ${rgba(row.left < 0 ? "rose" : color, 0.2)}`,
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[26px] leading-none">{e.emoji}</span>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold tracking-[0.12em] uppercase text-white/45">
                    осталось в периоде
                  </div>
                  <div
                    className="text-[30px] font-extrabold leading-none"
                    style={{ color: row.left < 0 ? hex("rose") : "#fff" }}
                  >
                    {money(row.left, currency)}
                  </div>
                </div>
              </div>
              <Progress
                percent={row.allocated > 0 ? Math.min(100, Math.round((row.spent / row.allocated) * 100)) : 0}
                colorKey={row.left < 0 ? "rose" : color}
              />
              <div className="text-[12.5px] text-white/45 mt-2">
                потрачено {money(row.spent, currency)} из {money(row.allocated, currency)}
                {e.mode === "percent" ? ` · ${Number(e.plan)}% от прихода` : ""}
              </div>
            </div>
          )}

          <Button onClick={onSpend} colorKey={color}>Записать трату</Button>

          <div className="flex items-center justify-between mt-6 mb-2.5 px-1">
            <h3 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30">История</h3>
            {ops.length > 0 && (
              <span className="text-[12px] text-white/30">всего {money(total, currency)}</span>
            )}
          </div>

          {!history.length ? (
            <div className="text-[13px] text-white/35 px-1 leading-relaxed">
              Трат по этому разделу ещё не было.
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((op) => (
                <OpLine key={op.id} op={op} currency={currency} onClick={() => onOpenOp(op)} />
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Правка баланса: вводим фактический остаток, разницу дописываем операцией */
function BalanceFix({ open, currency, balance, today, onClose, onSubmit }) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setRaw(String(Math.trunc(balance))); }, [open, balance]);

  const actual = parseAmount(raw);
  const valid = actual !== null;
  const delta = valid ? Math.round((actual - balance) * 100) / 100 : 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(actual);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-10">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">Баланс кошелька</div>
          <span className="w-14" />
        </div>

        <div className="space-y-5">
          <Field
            label="Сколько на самом деле"
            hint={`Посчитано ${moneyExact(balance, currency)}. Разницу допишем отдельной строкой, история не тронется.`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-extrabold text-white/35 shrink-0">{currency}</span>
              <TextInput
                type="text"
                inputMode="decimal"
                value={raw}
                onChange={(ev) => setRaw(cleanAmountInput(ev.target.value))}
                onKeyDown={(ev) => { if (ev.key === "Enter") submit(); }}
                placeholder="0"
                className="flex-1 min-w-0 text-[20px] font-extrabold"
                autoFocus
              />
            </div>
          </Field>

          {valid && delta !== 0 && (
            <div className="text-[13px] text-white/45">
              Расхождение {delta > 0 ? "+" : "−"}{moneyExact(Math.abs(delta), currency)} —{" "}
              {delta > 0 ? "добавим" : "спишем"} правкой.
            </div>
          )}

          <Button onClick={submit} disabled={!valid || busy} colorKey="mint">
            {delta === 0 ? "Всё сходится" : "Поправить"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Правка уже записанной операции: сумма, дата, раздел, комиссия */
function OpEditor({ op, currency, feePercent, envelopes, onClose }) {
  const { updateFinOp, deleteFinOp } = useStore();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState("");
  const [envelopeId, setEnvelopeId] = useState(null);
  const [takeFee, setTakeFee] = useState(true);
  const [offWallet, setOffWallet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!op) return;
    setAmount(String(Math.abs(Number(op.amount))));
    setNote(op.note || "");
    setDay(op.day);
    setEnvelopeId(op.envelope_id || null);
    setTakeFee(Number(op.fee) > 0);
    setOffWallet(Boolean(op.off_wallet));
    setConfirmDelete(false);
    setBusy(false);
  }, [op]);

  const value = parseAmount(amount);
  const valid = value !== null && value > 0;
  const expense = op?.kind === "expense";
  const adjust = op?.kind === "adjust";
  const sign = adjust && Number(op?.amount) < 0 ? -1 : 1;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    const patch = {
      amount: adjust ? value * sign : value,
      note: note.trim() || null,
      day,
    };
    if (expense) {
      patch.envelope_id = envelopeId;
      patch.off_wallet = offWallet;
      patch.fee = offWallet || !takeFee ? 0 : feeFor(value, feePercent);
    }
    try {
      await updateFinOp(op.id, patch);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteFinOp(op.id);
    onClose();
  }

  return (
    <Sheet open={Boolean(op)} onClose={onClose} tall>
      {op && (
        <div className="px-5 pb-12">
          <div className="flex items-center justify-between py-3">
            <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
            <div className="text-[15px] font-bold">
              {expense ? "Трата" : adjust ? "Правка баланса" : "Приход"}
            </div>
            <button
              onClick={save}
              disabled={!valid || busy}
              className="press text-[15px] font-bold disabled:opacity-30"
              style={{ color: hex("mint") }}
            >
              Сохранить
            </button>
          </div>

          <div className="space-y-5">
            <Field label="Сумма" hint="После правки всё пересчитается заново — и остаток раздела, и баланс.">
              <div className="flex items-center gap-2">
                <span className="text-[22px] font-extrabold text-white/35 shrink-0">{currency}</span>
                <TextInput
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(ev) => setAmount(cleanAmountInput(ev.target.value))}
                  placeholder="0"
                  className="flex-1 min-w-0 text-[20px] font-extrabold"
                />
              </div>
            </Field>

            <Field label="На что">
              <TextInput value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={100} />
            </Field>

            <Field label="Когда">
              <input
                type="date"
                value={day}
                onChange={(ev) => setDay(ev.target.value || op.day)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/6 border border-white/10 outline-none font-semibold"
              />
            </Field>

            {expense && (
              <>
                <Field label="Раздел">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setEnvelopeId(null)}
                      className="press px-3 py-2 rounded-xl text-[13px] font-semibold"
                      style={{
                        background: !envelopeId ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.08)",
                      }}
                    >
                      Без раздела
                    </button>
                    {envelopes.filter((e) => !e.archived).map((e) => {
                      const on = envelopeId === e.id;
                      return (
                        <button
                          key={e.id}
                          onClick={() => setEnvelopeId(e.id)}
                          className="press px-3 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1.5"
                          style={{
                            background: on ? rgba(e.color, 0.22) : "rgba(255,255,255,.05)",
                            border: `1px solid ${on ? rgba(e.color, 0.45) : "rgba(255,255,255,.08)"}`,
                          }}
                        >
                          <span>{e.emoji}</span>{e.title}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/6">
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="text-[14.5px] font-semibold">Снято с кошелька</div>
                    <Switch checked={!offWallet} onChange={(v) => setOffWallet(!v)} />
                  </div>
                  {!offWallet && feePercent > 0 && (
                    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                      <div className="text-[14.5px] font-semibold">Комиссия {feePercent}%</div>
                      <Switch checked={takeFee} onChange={setTakeFee} />
                    </div>
                  )}
                </div>
              </>
            )}

            <Button variant="danger" onClick={remove}>
              {confirmDelete ? "Точно удалить?" : "Удалить запись"}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Разделы, из которых уже нечего брать. Убраны с глаз, но открыть можно. */
function ClosedEnvelopes({ open, rows, currency, onClose, onSpend, onEdit }) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-10">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
          <div className="text-[15px] font-bold">Израсходованы</div>
          <span className="w-14" />
        </div>

        <div className="text-[13px] text-white/40 leading-relaxed mb-4">
          Лимит выбран до конца. Тратить всё ещё можно — раздел уйдёт в минус,
          и это будет видно.
        </div>

        <div className="space-y-2">
          {rows.map(({ envelope: e, allocated, spent, left }) => {
            const color = e.color || "mint";
            const over = left < 0;
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 px-3.5 py-3 rounded-2xl"
                style={{
                  background: rgba(over ? "rose" : color, 0.1),
                  border: `1px solid ${rgba(over ? "rose" : color, 0.2)}`,
                }}
              >
                <span className="text-[19px] shrink-0">{e.emoji}</span>
                <button onClick={() => onEdit(e)} className="press flex-1 min-w-0 text-left">
                  <span className="block text-[14.5px] font-bold truncate">{e.title}</span>
                  <span className="block text-[12px] text-white/40 truncate">
                    {money(spent, currency)} из {money(allocated, currency)}
                    {over ? ` · перебор ${money(-left, currency)}` : ""}
                  </span>
                </button>
                <button
                  onClick={() => onSpend(e)}
                  className="press px-3 py-1.5 rounded-lg text-[12px] font-bold shrink-0"
                  style={{ background: rgba(color, 0.22), color: hex(color) }}
                >
                  Трата
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

function EnvelopeEditor({ open, envelope, currency, emojiList, onClose }) {
  const { createEnvelope, updateEnvelope, deleteEnvelope } = useStore();
  const EMPTY = { title: "", emoji: "💵", color: "mint", mode: "fixed", plan: "", note: "", show_pace: true };
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(envelope);

  useEffect(() => {
    if (!open) return;
    setForm(envelope
      ? { ...envelope, plan: String(envelope.plan ?? ""), note: envelope.note || "" }
      : EMPTY);
    setConfirmDelete(false);
  }, [open, envelope]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const color = form.color || "mint";
  const planValue = parseAmount(form.plan);
  const valid = Boolean(form.title.trim()) && planValue !== null && planValue >= 0;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      emoji: form.emoji,
      color: form.color,
      mode: form.mode,
      plan: planValue,
      note: form.note?.trim() || null,
      show_pace: form.show_pace !== false,
    };
    try {
      if (editing) await updateEnvelope(envelope.id, payload);
      else if (!(await createEnvelope(payload))) return;
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteEnvelope(envelope.id);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{editing ? "Раздел" : "Новый раздел"}</div>
          <button
            onClick={save}
            disabled={!valid || busy}
            className="press text-[15px] font-bold disabled:opacity-30"
            style={{ color: hex(color) }}
          >
            {editing ? "Сохранить" : "Создать"}
          </button>
        </div>

        <div className="space-y-6">
          <Field label="Название">
            <TextInput
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Например, Накопления"
              maxLength={60}
            />
          </Field>

          <Field label="Сколько отводим" hint="Долей от прихода — сумма пересчитается сама. Фиксированной — всегда одна и та же.">
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              {[
                { v: "percent", t: "Доля от прихода" },
                { v: "fixed", t: "Фиксированно" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => set({ mode: o.v })}
                  className="press py-3 rounded-2xl text-[13.5px] font-semibold"
                  style={{
                    background: form.mode === o.v ? rgba(color, 0.2) : "rgba(255,255,255,.05)",
                    border: `1px solid ${form.mode === o.v ? rgba(color, 0.4) : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  {o.t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <TextInput
                type="text"
                inputMode="decimal"
                value={form.plan}
                onChange={(e) => set({ plan: cleanAmountInput(e.target.value) })}
                placeholder="0"
                className="flex-1 min-w-0 text-[17px] font-bold"
              />
              <span className="text-[16px] font-extrabold text-white/40 shrink-0 w-8 text-center">
                {form.mode === "percent" ? "%" : currency}
              </span>
            </div>
          </Field>

          <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-3.5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold">Считать на день</div>
              <div className="text-[12.5px] text-white/35 leading-relaxed">
                Для еды и бензина полезно. Для связи или подписки — нет: это
                разовая трата, делить её по дням незачем.
              </div>
            </div>
            <Switch
              checked={form.show_pace !== false}
              onChange={(v) => set({ show_pace: v })}
            />
          </div>

          <Field label="Заметка">
            <TextInput
              value={form.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Например, разовое здоровье и подарки"
              maxLength={120}
            />
          </Field>

          <Field label="Иконка">
            <EmojiPicker
              value={form.emoji}
              onChange={(emoji) => set({ emoji })}
              list={emojiList}
              colorKey={color}
              cols={10}
              size={17}
              maxHeight={132}
            />
          </Field>

          <Field label="Цвет">
            <div className="flex flex-wrap gap-2.5">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => set({ color: k })}
                  className="w-9 h-9 rounded-full press"
                  style={{
                    background: hex(k),
                    boxShadow: form.color === k ? `0 0 0 2.5px #111116, 0 0 0 4.5px ${hex(k)}` : "none",
                  }}
                  aria-label={COLORS[k].label}
                />
              ))}
            </div>
          </Field>

          <Button onClick={save} disabled={!valid || busy} colorKey={color}>
            {editing ? "Сохранить" : "Добавить раздел"}
          </Button>

          {editing && (
            <Button variant="danger" onClick={remove}>
              {confirmDelete ? "Точно удалить?" : "Удалить раздел"}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export function MoneyOps({ open, onClose }) {
  const { me, envelopes, finOps } = useStore();
  const currency = me?.fin_currency || "$";
  const feePercent = Number(me?.fin_fee_percent ?? 1);
  const [editOp, setEditOp] = useState(null);

  return (
    <>
      <Sheet open={open} onClose={onClose} tall>
        <div className="px-5 pb-12">
          <div className="flex items-center justify-between py-3">
            <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
            <div className="text-[15px] font-bold">История операций</div>
            <span className="w-14" />
          </div>

          {!finOps.length ? (
            <Empty emoji="🧾" title="Операций пока нет" subtitle="Записи о приходах и тратах появятся здесь." />
          ) : (
            <div className="space-y-1.5">
              {finOps.map((o) => (
                <OpLine key={o.id} op={o} currency={currency} onClick={() => setEditOp(o)} />
              ))}
            </div>
          )}
        </div>
      </Sheet>

      <OpEditor
        op={editOp}
        currency={currency}
        feePercent={feePercent}
        envelopes={envelopes}
        onClose={() => setEditOp(null)}
      />
    </>
  );
}
