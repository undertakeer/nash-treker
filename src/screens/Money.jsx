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
  adjustmentFor, cleanAmountInput, daysLeftIn, doubleSpendHint, feeFor, goalsSummary, money,
  moneyExact, parseAmount, periodLabel, periodPlan, periodsOf, plainAmount, spendableNow,
  walletBalance, withFee,
} from "../lib/finance";

const EMOJI = [
  "💵","💰","🏦","💳","🐖","💗","🤖","💊","🩹","🍔","🛒","🏠","🚗","⛽️","📱","🎮",
  "👕","✈️","🎁","☕️","🍿","🏋️","📚","🐈","🔧","💡","🧾","🎓","🪙","📈",
];

export default function Money({ onOpenOps }) {
  const {
    me, envelopes, finOps, finGoals, missing,
    addFinOp, updateFinOp, deleteFinOp, addIncomeWithSavings,
  } = useStore();
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
  const [goalEditor, setGoalEditor] = useState(null);
  const [saveTo, setSaveTo] = useState(null);
  const [takeFrom, setTakeFrom] = useState(null);
  const [breakdown, setBreakdown] = useState(false);
  const [fixing, setFixing] = useState(false);

  // периоды идут от прихода до прихода, а не по календарю
  const periods = useMemo(() => periodsOf(finOps, today), [finOps, today]);
  const [index, setIndex] = useState(null);
  const at = index === null ? periods.length - 1 : Math.min(index, periods.length - 1);
  const period = periods[at];

  const plan = useMemo(() => periodPlan(envelopes, finOps, period), [envelopes, finOps, period]);
  const balance = useMemo(() => walletBalance(finOps), [finOps]);
  const daysLeft = daysLeftIn(period, today);

  // израсходованные разделы уезжают в отдельную шторку, чтобы не мешали
  const goals = useMemo(
    () => goalsSummary(finGoals, finOps, period, plan.income),
    [finGoals, finOps, period, plan.income]
  );
  const spendable = spendableNow(balance, plan.reserved, goals.earmarked, goals.pending);
  // сколько из этого прихода забирают копилки: «не разложено» без этого врёт
  const goalsDue = goals.rows.reduce((s, r) => s + r.due, 0);
  const unplanned = Math.round((plan.free - goalsDue) * 100) / 100;
  // минус почти всегда означает одно: снятие записано и тратой, и откладыванием
  const doubled = useMemo(
    () => (spendable < 0 ? doubleSpendHint(finOps, period) : null),
    [spendable, finOps, period]
  );

  /** Убираем лишнюю трату и помечаем откладывания снятыми — деньги ушли один раз */
  async function fixDoubled() {
    if (!doubled || fixing) return;
    setFixing(true);
    try {
      // комиссию снятия переносим на первую пометку, чтобы баланс кошелька
      // после правки остался ровно тем же
      const fee = Number(doubled.expense.fee) || 0;
      // сначала пометки, и только если все прошли — убираем лишнюю трату:
      // иначе на полпути получится ещё более кривой расклад
      for (const [i, op] of doubled.saves.entries()) {
        const patch = i === 0 && fee > 0 ? { withdrawn: true, fee } : { withdrawn: true };
        if (!(await updateFinOp(op.id, patch))) return;
      }
      await deleteFinOp(doubled.expense.id);
    } finally {
      setFixing(false);
    }
  }

  // без лимита разделу нечего исчерпывать — он всегда на виду
  const openRows = plan.rows.filter((r) => r.unlimited || r.left > 0);
  const closedRows = plan.rows.filter((r) => !r.unlimited && r.left <= 0);
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
          с {humanDate(period.from)}: пришло {money(plan.income, currency)} · ушло {money(plan.outflow, currency)}
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

      {/* сколько из баланса уже расписано */}
      {(plan.reserved > 0 || goals.earmarked > 0 || goals.pending > 0) && (
        <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-3 mb-3 space-y-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-white/45">Осталось по разделам</span>
            <span className="font-bold">{money(plan.reserved, currency)}</span>
          </div>
          {goals.earmarked > 0 && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-white/45">Отложено с кошелька</span>
              <span className="font-bold">{money(goals.earmarked, currency)}</span>
            </div>
          )}
          {goals.pending > 0 && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-white/45">Ещё отложить в копилки</span>
              <span className="font-bold">{money(goals.pending, currency)}</span>
            </div>
          )}
          <button
            onClick={() => setBreakdown(true)}
            className="press w-full flex items-center justify-between pt-1.5 border-t border-white/6 text-left"
          >
            <span className="text-[13px] font-semibold">
              {spendable < 0 ? "Не хватает на расписанное" : "Свободно сверх этого"}
              <span className="text-white/25 font-medium"> · разбор ›</span>
            </span>
            <span
              className="text-[16px] font-extrabold"
              style={{ color: spendable < 0 ? hex("rose") : hex("mint") }}
            >
              {money(spendable, currency)}
            </span>
          </button>
          {spendable < 0 && !doubled && (
            <div className="text-[11.5px] leading-relaxed" style={{ color: hex("rose") }}>
              На кошельке меньше, чем расписано по лимитам и целям. Если эти деньги уже
              сняты — откройте копилку и поправьте взнос, иначе уменьшите лимиты.
            </div>
          )}
          {doubled && (
            <div
              className="rounded-xl px-3 py-2.5 mt-1"
              style={{ background: rgba("amber", 0.12), border: `1px solid ${rgba("amber", 0.25)}` }}
            >
              <div className="text-[12px] leading-relaxed" style={{ color: hex("amber") }}>
                Похоже, {money(doubled.amount, currency)} посчитаны дважды: записаны тратой
                и тем же числом отложены в {doubled.saves.length === 1 ? "копилку" : "копилки"}.
                Физически деньги ушли один раз.
              </div>
              <button
                onClick={fixDoubled}
                disabled={fixing}
                className="press w-full mt-2 py-2 rounded-lg text-[12.5px] font-bold"
                style={{ background: hex("amber"), color: "#0A0A0E" }}
              >
                Убрать трату и отметить снятие
              </button>
            </div>
          )}
        </div>
      )}

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
          <div className="text-[14px] font-bold">{periodLabel(period)}</div>
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
            <div className="text-[13px] font-semibold text-white/45">Не разложено с прихода</div>
            <div className="text-[11.5px] text-white/30 mt-0.5">
              разделы: {money(plan.allocated, currency)}
              {goalsDue > 0 ? ` · копилки: ${money(goalsDue, currency)}` : ""}
            </div>
            {unplanned < 0 && (
              <div className="text-[11.5px] mt-0.5" style={{ color: hex("amber") }}>
                разделы и копилки просят больше, чем пришло
              </div>
            )}
            {plan.looseSpent > 0 && (
              <div className="text-[11.5px] text-white/30 mt-0.5">
                траты без раздела: {money(plan.looseSpent, currency)}
              </div>
            )}
          </div>
          <div
            className="text-[17px] font-extrabold shrink-0"
            style={{ color: unplanned < 0 ? hex("rose") : "#fff" }}
          >
            {money(unplanned, currency)}
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

      <div className="mt-6">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <h3 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30">
              Цели
              {goals.saved > 0 && (
                <span className="text-white/25 normal-case tracking-normal font-semibold">
                  {" "}· всего {money(goals.saved, currency)}
                </span>
              )}
            </h3>
            <button
              onClick={() => setGoalEditor({ goal: null })}
              className="press text-[12.5px] font-semibold text-white/40"
            >
              + добавить
            </button>
          </div>

          {missing.includes("fin_goals") ? (
            <MissingTable what="Цель-копилка" />
          ) : !goals.rows.length ? (
            <button
              onClick={() => setGoalEditor({ goal: null })}
              className="press w-full p-4 rounded-2xl bg-white/5 border border-dashed border-white/15 text-left"
            >
              <div className="text-[14px] font-semibold text-white/60 mb-1">🎯 Завести копилку</div>
              <div className="text-[12.5px] text-white/35 leading-relaxed">
                Копится поверх разделов и не обнуляется с зарплатой. Можно указать
                цель, сколько откладывать с каждого прихода и сколько уже накоплено.
              </div>
            </button>
          ) : (
            <div className="space-y-2.5">
              {goals.rows.map((row) => (
                <GoalRow
                  key={row.goal.id}
                  row={row}
                  currency={currency}
                  onSave={() => setSaveTo({ ...row.goal, pending: row.pending })}
                  onTake={() => setTakeFrom({ ...row.goal, saved: row.saved, earmarked: row.earmarked })}
                  onEdit={() => setGoalEditor({ goal: row.goal })}
                />
              ))}
            </div>
          )}
      </div>

      <GoalEditor
        open={Boolean(goalEditor)}
        goal={goalEditor?.goal || null}
        row={goalEditor?.goal ? goals.rows.find((r) => r.goal.id === goalEditor.goal.id) : null}
        ops={goalEditor?.goal
          ? finOps.filter(
              (o) => (o.kind === "save" || o.kind === "unsave") && o.goal_id === goalEditor.goal.id
            )
          : []}
        currency={currency}
        onClose={() => setGoalEditor(null)}
        onOpenOp={(op) => { setGoalEditor(null); setEditOp(op); }}
      />

      <AmountSheet
        open={Boolean(saveTo)}
        title={saveTo ? `${saveTo.emoji} ${saveTo.title}` : ""}
        defaultAmount={saveTo?.pending ? String(saveTo.pending) : ""}
        hint="Пометить на кошельке или записать снятие — выберите ниже."
        actionLabel="Отложить"
        colorKey={saveTo?.color || "violet"}
        currency={currency}
        withWithdraw
        feePercent={feePercent}
        onClose={() => setSaveTo(null)}
        onSubmit={async (amount, note, day, extra) => {
          await addFinOp({
            kind: "save",
            goal_id: saveTo.id,
            envelope_id: null,
            amount,
            note: note || null,
            day: today,
            withdrawn: extra.withdrawn,
            fee: extra.withdrawn && extra.takeFee ? feeFor(amount, feePercent) : 0,
          });
          setSaveTo(null);
        }}
      />

      <AmountSheet
        open={Boolean(takeFrom)}
        title={takeFrom ? `${takeFrom.emoji} ${takeFrom.title}` : ""}
        hint={takeFrom
          ? `В копилке ${money(takeFrom.saved, currency)}. Сумма уйдёт из накопленного.`
          : ""}
        actionLabel="Потратить из копилки"
        colorKey={takeFrom?.color || "violet"}
        currency={currency}
        withOptions
        defaultOffWallet={!takeFrom?.earmarked}
        optionLabel="Деньги лежали на кошельке"
        optionHint="Включено — баланс кошелька тоже уменьшится. Выключите, если тратите наличные, снятые в копилку раньше: баланс не тронем."
        feePercent={feePercent}
        onClose={() => setTakeFrom(null)}
        onSubmit={async (amount, note, day, extra) => {
          await addFinOp({
            kind: "unsave",
            goal_id: takeFrom.id,
            envelope_id: null,
            amount,
            note: note || null,
            day: today,
            off_wallet: extra.offWallet,
            fee: extra.offWallet || !extra.takeFee ? 0 : feeFor(amount, feePercent),
          });
          setTakeFrom(null);
        }}
      />

      <SpendableBreakdown
        open={breakdown}
        currency={currency}
        balance={balance}
        plan={plan}
        goals={goals}
        spendable={spendable}
        onClose={() => setBreakdown(false)}
      />

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
        goals={finGoals}
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
          await addIncomeWithSavings({ envelope_id: null, amount, note: note || null, day });
          setIncome(false);
          setIndex(null);
        }}
      />
    </div>
  );
}

function EnvelopeRow({ row, currency, income, daysLeft, onSpend, onEdit }) {
  const { envelope: e, allocated, spent, left, unlimited } = row;
  const color = e.color || "mint";
  const pct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
  const over = !unlimited && left < 0;
  // у разовых трат вроде связи или подписки дневной темп ничего не значит
  const perDay = !unlimited && e.show_pace !== false && daysLeft && left > 0 ? left / daysLeft : null;

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
              {unlimited
                ? "без лимита"
                : `из ${money(allocated, currency)}${e.mode === "percent" && income > 0 ? " от прихода" : ""}`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div
              className="text-[19px] font-extrabold leading-none"
              style={{ color: over ? hex("rose") : hex(color) }}
            >
              {money(unlimited ? spent : left, currency)}
            </div>
            <div className="text-[11px] text-white/35 mt-1">
              {unlimited ? "за период" : "осталось"}
            </div>
          </div>
        </div>

        <div className="mt-3">
          {!unlimited && <Progress percent={pct} colorKey={over ? "rose" : color} />}
          <div className="flex items-center justify-between mt-2">
            <div className="text-[11.5px] text-white/35">
              {unlimited ? "только учёт, лимита нет" : `потрачено ${money(spent, currency)}`}
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
  withDate = false, withOptions = false, withWithdraw = false,
  today, feePercent = 0, defaultAmount = "", defaultOffWallet = false,
  optionLabel = "Снято с кошелька",
  optionHint = "Выключите, если платили не с крипты. Лимит раздела спишется, баланс кошелька не тронем.",
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(today);
  const [takeFee, setTakeFee] = useState(true);
  const [offWallet, setOffWallet] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(defaultAmount);
    setDay(today);
    setTakeFee(true);
    setOffWallet(defaultOffWallet);
    setWithdrawn(false);
  }, [open, today, defaultAmount, defaultOffWallet]);

  const value = parseAmount(amount);
  const valid = value !== null && value > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(value, note.trim(), day, { takeFee, offWallet, withdrawn });
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
                  <div className="text-[14.5px] font-semibold">{optionLabel}</div>
                  <div className="text-[12.5px] text-white/35 leading-relaxed">{optionHint}</div>
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

          {withWithdraw && (
            <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/6">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <div className="text-[14.5px] font-semibold">Деньги сняты со счёта</div>
                  <div className="text-[12.5px] text-white/35 leading-relaxed">
                    Включите, если физически сняли и положили в копилку — баланс
                    кошелька уменьшится. Выключено: деньги остаются на кошельке
                    и просто помечены под цель.
                  </div>
                </div>
                <Switch checked={withdrawn} onChange={setWithdrawn} />
              </div>
              {withdrawn && feePercent > 0 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="text-[14.5px] font-semibold">Комиссия {feePercent}%</div>
                  <Switch checked={takeFee} onChange={setTakeFee} />
                </div>
              )}
            </div>
          )}

          {withWithdraw && valid && withdrawn && takeFee && feePercent > 0 && (
            <div className="text-[12.5px] text-white/40 -mt-2">
              С кошелька уйдёт {moneyExact(value + feeFor(value, feePercent), currency)}
              {" "}— в копилку {moneyExact(value, currency)}, комиссия{" "}
              {moneyExact(feeFor(value, feePercent), currency)}.
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

/** Цель-накопление: сколько собрано и сколько осталось до суммы */
function GoalRow({ row, currency, onSave, onTake, onEdit }) {
  const {
    goal: g, saved, opening, earmarked, movedOut, taken,
    target, left, percent, done, due, paid, pending, settled,
  } = row;
  const color = g.color || "violet";

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div
        className="rounded-[22px] p-4"
        style={{
          background: `linear-gradient(168deg, ${rgba(color, 0.1)} 0%, ${rgba(color, 0.28)} 100%), #0F0F14`,
          border: `1px solid ${rgba(done ? "mint" : color, done ? 0.4 : 0.18)}`,
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={onEdit}
          onKeyDown={(ev) => { if (ev.key === "Enter") onEdit(); }}
          className="flex items-start gap-3 cursor-pointer"
        >
          <span className="text-[21px] leading-none shrink-0">{g.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15.5px] font-bold truncate">
              {g.title}
              {done && <span className="text-[12px] font-bold" style={{ color: hex("mint") }}> · собрано</span>}
            </div>
            <div className="text-[12.5px] text-white/45">
              {target !== null ? `цель ${money(target, currency)}` : "без конкретной суммы"}
              {Number(g.per_income) > 0
                ? g.per_mode === "percent"
                  ? ` · ${Number(g.per_income)}% с прихода`
                  : ` · ${money(g.per_income, currency)} с прихода`
                : ""}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[19px] font-extrabold leading-none" style={{ color: hex(color) }}>
              {money(saved, currency)}
            </div>
            <div className="text-[11px] text-white/35 mt-1">
              {opening > 0 && opening === saved ? "было до учёта" : "накоплено"}
            </div>
          </div>
        </div>

        <div className="mt-3">
          {percent !== null && <Progress percent={percent} colorKey={done ? "mint" : color} />}
          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="text-[11.5px] text-white/35 min-w-0 truncate">
              {left !== null && left > 0 ? `осталось собрать ${money(left, currency)}` : "копится"}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {saved > 0 && (
                <button
                  onClick={onTake}
                  className="press px-3 py-1.5 rounded-lg text-[12px] font-bold bg-white/8 text-white/55"
                >
                  Потратить
                </button>
              )}
              <button
                onClick={onSave}
                className="press px-3 py-1.5 rounded-lg text-[12px] font-bold"
                style={{ background: rgba(color, 0.22), color: hex(color) }}
              >
                Отложить
              </button>
            </div>
          </div>

          {([opening, earmarked, movedOut].filter((v) => v > 0).length > 1 || taken > 0) && (
            <div className="mt-2 text-[11.5px] text-white/35">
              {[
                opening > 0 ? `${money(opening, currency)} было до учёта` : null,
                movedOut > 0 ? `${money(movedOut, currency)} снято в копилку` : null,
                earmarked > 0 ? `${money(earmarked, currency)} помечено на кошельке` : null,
              ].filter(Boolean).join(" + ")}
              {taken > 0 ? ` − ${money(taken, currency)} потрачено` : ""}
            </div>
          )}

          {due > 0 && (
            <div
              className="mt-2.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold flex items-center gap-2"
              style={{
                background: settled ? rgba("mint", 0.14) : rgba("amber", 0.14),
                color: settled ? hex("mint") : hex("amber"),
              }}
            >
              {settled ? (
                <>✅ В этом периоде внесено {money(paid, currency)}</>
              ) : (
                <>
                  ⏳ Надо внести {money(pending, currency)}
                  {paid > 0 ? ` · уже внесено ${money(paid, currency)} из ${money(due, currency)}` : ""}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Настройка цели: сумма и сколько уходит туда с каждой зарплаты */
function GoalEditor({ open, goal, row = null, ops = [], currency, onClose, onOpenOp }) {
  const {
    createGoalSaving, updateGoalSaving, deleteGoalSaving, deleteFinOp, showToast,
  } = useStore();
  const EMPTY = {
    title: "", emoji: "🎯", color: "violet", target: "",
    per_mode: "fixed", per_income: "", note: "", total: "",
  };
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmMove, setConfirmMove] = useState(false);
  const editing = Boolean(goal);

  // всё, что записано операциями: отложенное минус потраченное из копилки
  const earmarked = row?.earmarked || 0;
  // пометки на кошельке целиком — их и переносим в «накоплено до учёта»
  const marked = useMemo(
    () => Math.round(ops
      .filter((o) => o.kind === "save" && !o.withdrawn)
      .reduce((sum, o) => sum + Number(o.amount), 0) * 100) / 100,
    [ops]
  );
  const contributed = useMemo(
    () => Math.round(ops.reduce(
      (sum, o) => sum + (o.kind === "unsave" ? -1 : 1) * Number(o.amount), 0
    ) * 100) / 100,
    [ops]
  );
  const history = useMemo(
    () => [...ops].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)),
    [ops]
  );

  useEffect(() => {
    if (!open) return;
    setForm(goal
      ? {
          ...goal,
          target: goal.target === null || goal.target === undefined ? "" : String(goal.target),
          per_income: String(goal.per_income ?? ""),
          // в поле живёт вся сумма копилки, а не только доприложенная часть
          total: plainAmount(Number(goal.opening || 0) + contributed),
          note: goal.note || "",
        }
      : EMPTY);
    setConfirmDelete(false);
    setConfirmMove(false);
    setBusy(false);
    // contributed меняется вместе с операциями — переоткрытие подхватит новое
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const color = form.color || "violet";
  const target = form.target === "" ? null : parseAmount(form.target);
  const perIncome = form.per_income === "" ? 0 : parseAmount(form.per_income);
  // сумма копилки не может быть меньше того, что уже записано операциями:
  // иначе «накоплено до учёта» уехало бы в минус
  const total = form.total === "" ? 0 : parseAmount(form.total);
  const shortfall = total !== null && total < contributed;
  const opening = total === null ? 0 : Math.max(0, total - contributed);
  const valid = Boolean(form.title.trim()) && target !== undefined && perIncome !== null
    && (form.target === "" || target !== null) && total !== null && !shortfall;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      emoji: form.emoji,
      color: form.color,
      target,
      per_mode: form.per_mode,
      per_income: perIncome || 0,
      // отдельным полем, а не операцией: это не взнос и не деньги с кошелька
      opening,
      note: form.note?.trim() || null,
    };
    try {
      if (editing) await updateGoalSaving(goal.id, payload);
      else if (!(await createGoalSaving(payload))) return;
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteGoalSaving(goal.id);
    onClose();
  }

  /**
   * Взносы, помеченные на кошельке, превращаем в «было до учёта»: сумма в
   * копилке та же, но кошелёк её больше не резервирует. Это выход, когда
   * деньги уже ушли тратой, а копилку заполнили теми же деньгами второй раз.
   */
  async function moveToOpening() {
    // только пометки на кошельке: снятые деньги и траты из копилки трогать нельзя
    const moving = ops.filter((o) => o.kind === "save" && !o.withdrawn);
    if (!moving.length || busy) return;
    if (!confirmMove) { setConfirmMove(true); return; }
    setBusy(true);
    try {
      const sum = moving.reduce((s, o) => s + Number(o.amount), 0);
      // пока сумма не легла в «накоплено», записи не трогаем: иначе деньги
      // пропали бы совсем
      if (!(await updateGoalSaving(goal.id, { opening: Number(goal.opening || 0) + sum }))) return;
      for (const o of moving) await deleteFinOp(o.id);
      showToast("Перенесено в накопленное", "🎯");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{editing ? "Цель" : "Новая цель"}</div>
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
          <Field label="На что копим">
            <TextInput
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Например, горы зимой"
              maxLength={60}
            />
          </Field>

          <Field label="Сколько нужно" hint="Можно оставить пустым — тогда просто копим без финиша.">
            <div className="flex items-center gap-2">
              <TextInput
                type="text"
                inputMode="decimal"
                value={form.target}
                onChange={(e) => set({ target: cleanAmountInput(e.target.value) })}
                placeholder="1000"
                className="flex-1 min-w-0 text-[17px] font-bold"
              />
              <span className="text-[16px] font-extrabold text-white/40 shrink-0 w-8 text-center">
                {currency}
              </span>
            </div>
          </Field>

          <Field
            label="Сколько сейчас в копилке"
            hint={
              shortfall ? (
                <span style={{ color: hex("rose") }}>
                  Операциями записано {money(contributed, currency)} — меньше этой суммы быть
                  не может. Поправьте или удалите запись в списке ниже.
                </span>
              ) : contributed !== 0 ? (
                `${money(opening, currency)} лежало до учёта, операциями ниже ${
                  contributed > 0 ? "добавлено" : "потрачено"
                } ${money(Math.abs(contributed), currency)}.`
              ) : (
                "Вся сумма копилки. В прогресс идёт, но взносом за период не считается и на кошельке не резервируется."
              )
            }
          >
            <div className="flex items-center gap-2">
              <TextInput
                type="text"
                inputMode="decimal"
                value={form.total}
                onChange={(e) => set({ total: cleanAmountInput(e.target.value) })}
                placeholder="1040"
                className="flex-1 min-w-0 text-[17px] font-bold"
              />
              <span className="text-[16px] font-extrabold text-white/40 shrink-0 w-8 text-center">
                {currency}
              </span>
            </div>
          </Field>

          {editing && history.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30">
                  Движения
                </h3>
                <span className="text-[12px] text-white/30">{money(contributed, currency)}</span>
              </div>
              <div className="space-y-1.5">
                {history.map((op) => (
                  <OpLine key={op.id} op={op} currency={currency} onClick={() => onOpenOp(op)} />
                ))}
              </div>
              <div className="text-[12px] text-white/30 mt-2 leading-relaxed">
                Нажмите на запись, чтобы изменить сумму, дату или удалить её.
              </div>

              {earmarked > 0 && (
                <button
                  onClick={moveToOpening}
                  disabled={busy}
                  className="press w-full mt-2.5 py-2.5 rounded-xl text-[12.5px] font-semibold leading-snug px-3"
                  style={{ background: rgba("amber", 0.16), color: hex("amber") }}
                >
                  {confirmMove
                    ? "Точно перенести?"
                    : `Это не новые взносы — перенести ${money(marked, currency)} в накопленное`}
                </button>
              )}
              {earmarked > 0 && (
                <div className="text-[12px] text-white/30 mt-1.5 leading-relaxed">
                  Сумма в копилке не изменится, но кошелёк перестанет держать её в резерве.
                  Нужно, если эти деньги вы уже списали тратой.
                </div>
              )}
            </div>
          )}

          <Field
            label="Откладывать с каждого прихода"
            hint="Запишется само, как только отметите зарплату. Доля считается от суммы этого прихода."
          >
            <div className="grid grid-cols-2 gap-2 mb-2.5">
              {[
                { v: "fixed", t: "Суммой" },
                { v: "percent", t: "Долей" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => set({ per_mode: o.v })}
                  className="press py-3 rounded-2xl text-[13.5px] font-semibold"
                  style={{
                    background: form.per_mode === o.v ? rgba(color, 0.2) : "rgba(255,255,255,.05)",
                    border: `1px solid ${form.per_mode === o.v ? rgba(color, 0.4) : "rgba(255,255,255,.08)"}`,
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
                value={form.per_income}
                onChange={(e) => set({ per_income: cleanAmountInput(e.target.value) })}
                placeholder={form.per_mode === "percent" ? "30" : "550"}
                className="flex-1 min-w-0 text-[17px] font-bold"
              />
              <span className="text-[16px] font-extrabold text-white/40 shrink-0 w-8 text-center">
                {form.per_mode === "percent" ? "%" : currency}
              </span>
            </div>
          </Field>

          <Field label="Заметка">
            <TextInput
              value={form.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Необязательно"
              maxLength={120}
            />
          </Field>

          <Field label="Иконка">
            <EmojiPicker
              value={form.emoji}
              onChange={(emoji) => set({ emoji })}
              list={["🎯","🏔","✈️","🏖","🚗","🏠","💍","🎓","💻","📷","🎸","🛵","⌚️","🪙","🏦","🎁","🧳","⛷","🏝","🎢"]}
              colorKey={color}
              cols={10}
              size={17}
              maxHeight={96}
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
            {editing ? "Сохранить" : "Добавить цель"}
          </Button>

          {editing && (
            <Button variant="danger" onClick={remove}>
              {confirmDelete ? "Точно удалить?" : "Удалить цель"}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** Строка разбора: подпись слева, сумма справа; sub — вложенный пункт */
function BreakdownLine({ label, value, sub = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${sub ? "pl-3" : ""}`}>
      <span className={sub ? "text-[12.5px] text-white/35 min-w-0 truncate" : "text-[14px] text-white/70"}>
        {label}
      </span>
      <span className={`shrink-0 font-bold ${sub ? "text-[12.5px] text-white/35" : "text-[14.5px]"}`}>
        {value}
      </span>
    </div>
  );
}

/** Разбор: из чего сложилось «свободно», построчно и с подписями */
function SpendableBreakdown({ open, currency, balance, plan, goals, spendable, onClose }) {
  const limits = plan.rows.filter((r) => !r.unlimited && r.left > 0);
  const marked = goals.rows.filter((r) => r.earmarked > 0);
  const owed = goals.rows.filter((r) => r.pending > 0);

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
          <div className="text-[15px] font-bold">Откуда это число</div>
          <span className="w-14" />
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/8 px-4 py-4 space-y-3">
          <BreakdownLine label="На кошельке" value={money(balance, currency)} />

          <div className="space-y-1.5 pt-1 border-t border-white/6">
            <BreakdownLine label="− не потраченные лимиты" value={money(plan.reserved, currency)} />
            {limits.map((r) => (
              <BreakdownLine
                key={r.envelope.id}
                sub
                label={`${r.envelope.emoji} ${r.envelope.title}`}
                value={money(r.left, currency)}
              />
            ))}
            {!limits.length && (
              <div className="pl-3 text-[12.5px] text-white/25">лимиты уже израсходованы</div>
            )}
          </div>

          <div className="space-y-1.5 pt-1 border-t border-white/6">
            <BreakdownLine label="− отложено на кошельке" value={money(goals.earmarked, currency)} />
            {marked.map((r) => (
              <BreakdownLine key={r.goal.id} sub label={`${r.goal.emoji} ${r.goal.title}`} value={money(r.earmarked, currency)} />
            ))}
            {!marked.length && (
              <div className="pl-3 text-[12.5px] text-white/25">
                помеченных под цели денег на кошельке нет
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-1 border-t border-white/6">
            <BreakdownLine label="− ещё отложить в копилки" value={money(goals.pending, currency)} />
            {owed.map((r) => (
              <BreakdownLine key={r.goal.id} sub label={`${r.goal.emoji} ${r.goal.title}`} value={money(r.pending, currency)} />
            ))}
            {!owed.length && (
              <div className="pl-3 text-[12.5px] text-white/25">взносы этого периода закрыты</div>
            )}
          </div>

          <div className="flex items-baseline justify-between gap-3 pt-2.5 border-t border-white/10">
            <span className="text-[14.5px] font-bold">
              {spendable < 0 ? "Не хватает" : "Свободно"}
            </span>
            <span
              className="text-[20px] font-extrabold"
              style={{ color: spendable < 0 ? hex("rose") : hex("mint") }}
            >
              {money(spendable, currency)}
            </span>
          </div>
        </div>

        <div className="text-[12.5px] text-white/35 leading-relaxed mt-4 px-1">
          Снятые в копилку деньги сюда не входят: их на кошельке уже нет, баланс
          уменьшился в момент снятия. Помеченные под цель — наоборот, лежат на
          кошельке, поэтому тратить их нельзя.
        </div>
      </div>
    </Sheet>
  );
}

/** Одна строка истории: дата, на что, сумма и пометки */
function OpLine({ op, currency, onClick }) {
  const plus = op.kind === "income" || (op.kind === "adjust" && Number(op.amount) > 0);
  const adjust = op.kind === "adjust";
  const saving = op.kind === "save";
  const taking = op.kind === "unsave";
  const amount = op.kind === "expense" || taking ? withFee(op) : Math.abs(Number(op.amount));

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="press w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white/4 border border-white/6 text-left"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[14.5px] font-semibold truncate">
          {op.note
            || (adjust ? "Правка баланса"
              : saving ? "Отложено"
              : taking ? "Трата из копилки"
              : plus ? "Приход" : "Трата")}
        </span>
        <span className="block text-[12px] text-white/35 truncate">
          {humanDate(op.day)}
          {op.kind === "expense" && op.off_wallet ? " · не с кошелька" : ""}
          {saving ? (op.withdrawn ? " · снято со счёта" : " · помечено на кошельке") : ""}
          {taking ? (op.off_wallet ? " · наличными из копилки" : " · с кошелька") : ""}
          {Number(op.fee) > 0 ? ` · комиссия ${moneyExact(op.fee, currency)}` : ""}
        </span>
      </span>
      <span
        className="text-[15px] font-extrabold shrink-0"
        style={{
          color: plus ? hex("mint")
            : adjust ? hex("amber")
            : saving ? hex("violet")
            : taking ? hex("sky") : "#fff",
        }}
      >
        {saving ? "→ " : taking ? "← " : plus ? "+" : "−"}{moneyExact(amount, currency)}
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
function OpEditor({ op, currency, feePercent, envelopes, goals = [], onClose }) {
  const { updateFinOp, deleteFinOp } = useStore();
  const [retype, setRetype] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState("");
  const [envelopeId, setEnvelopeId] = useState(null);
  const [takeFee, setTakeFee] = useState(true);
  const [offWallet, setOffWallet] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
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
    setWithdrawn(Boolean(op.withdrawn));
    setConfirmDelete(false);
    setRetype(false);
    setBusy(false);
  }, [op]);

  const value = parseAmount(amount);
  const valid = value !== null && value > 0;
  const expense = op?.kind === "expense";
  const adjust = op?.kind === "adjust";
  const saving = op?.kind === "save";
  const taking = op?.kind === "unsave";
  const sign = adjust && Number(op?.amount) < 0 ? -1 : 1;
  const liveGoals = goals.filter((g) => !g.archived);

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
    if (saving) {
      patch.withdrawn = withdrawn;
      patch.fee = withdrawn && takeFee ? feeFor(value, feePercent) : 0;
    }
    if (taking) {
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

  /**
   * Запись записана не тем видом: трату превращаем в откладывание и обратно.
   * Баланс кошелька при этом не меняется — если деньги уже ушли с кошелька,
   * откладывание помечаем снятием, и наоборот.
   */
  async function toSaving(goalId) {
    if (busy) return;
    setBusy(true);
    try {
      await updateFinOp(op.id, {
        kind: "save",
        goal_id: goalId,
        envelope_id: null,
        withdrawn: !op.off_wallet,
        off_wallet: false,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function toExpense(envelopeId) {
    if (busy) return;
    setBusy(true);
    try {
      await updateFinOp(op.id, {
        kind: "expense",
        envelope_id: envelopeId,
        goal_id: null,
        off_wallet: !op.withdrawn,
        withdrawn: false,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(op)} onClose={onClose} tall>
      {op && (
        <div className="px-5 pb-12">
          <div className="flex items-center justify-between py-3">
            <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
            <div className="text-[15px] font-bold">
              {expense ? "Трата"
                : adjust ? "Правка баланса"
                : saving ? "Откладывание"
                : taking ? "Трата из копилки"
                : "Приход"}
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

            {saving && (
              <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/6">
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div>
                    <div className="text-[14.5px] font-semibold">Деньги сняты со счёта</div>
                    <div className="text-[12.5px] text-white/35 leading-relaxed">
                      Включено — баланс кошелька уменьшается. Выключено — деньги
                      остаются на кошельке и просто помечены под цель.
                    </div>
                  </div>
                  <Switch checked={withdrawn} onChange={setWithdrawn} />
                </div>
                {withdrawn && feePercent > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="text-[14.5px] font-semibold">Комиссия {feePercent}%</div>
                    <Switch checked={takeFee} onChange={setTakeFee} />
                  </div>
                )}
              </div>
            )}

            {taking && (
              <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/6">
                <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div>
                    <div className="text-[14.5px] font-semibold">Деньги лежали на кошельке</div>
                    <div className="text-[12.5px] text-white/35 leading-relaxed">
                      Включено — баланс кошелька тоже уменьшается. Выключено —
                      тратили наличные, снятые в копилку раньше.
                    </div>
                  </div>
                  <Switch checked={!offWallet} onChange={(v) => setOffWallet(!v)} />
                </div>
                {!offWallet && feePercent > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                    <div className="text-[14.5px] font-semibold">Комиссия {feePercent}%</div>
                    <Switch checked={takeFee} onChange={setTakeFee} />
                  </div>
                )}
              </div>
            )}

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

            {(expense || saving) && (
              <div>
                <button
                  onClick={() => setRetype((v) => !v)}
                  className="press w-full py-3 rounded-2xl bg-white/5 text-[13.5px] font-semibold text-white/55"
                >
                  {expense ? "Это было откладывание в копилку" : "Это была трата, а не копилка"}
                </button>
                {retype && (
                  <div className="mt-2.5">
                    <div className="text-[12px] text-white/30 leading-relaxed mb-2 px-1">
                      Баланс кошелька не изменится — поменяется только то, куда
                      записаны деньги. Выберите, куда перенести.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {expense
                        ? liveGoals.map((g) => (
                            <button
                              key={g.id}
                              onClick={() => toSaving(g.id)}
                              disabled={busy}
                              className="press px-3 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1.5"
                              style={{
                                background: rgba(g.color || "violet", 0.18),
                                border: `1px solid ${rgba(g.color || "violet", 0.35)}`,
                              }}
                            >
                              <span>{g.emoji}</span>{g.title}
                            </button>
                          ))
                        : [{ id: null, title: "Без раздела", emoji: "💸", color: "slate" },
                           ...envelopes.filter((e) => !e.archived)].map((e) => (
                            <button
                              key={e.id || "none"}
                              onClick={() => toExpense(e.id)}
                              disabled={busy}
                              className="press px-3 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1.5"
                              style={{
                                background: rgba(e.color || "slate", 0.18),
                                border: `1px solid ${rgba(e.color || "slate", 0.35)}`,
                              }}
                            >
                              <span>{e.emoji}</span>{e.title}
                            </button>
                          ))}
                      {expense && !liveGoals.length && (
                        <div className="text-[13px] text-white/35">Копилок пока нет.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
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
  const planValue = form.mode === "free" ? 0 : parseAmount(form.plan);
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
            <div className="grid grid-cols-3 gap-2 mb-2.5">
              {[
                { v: "percent", t: "Доля" },
                { v: "fixed", t: "Сумма" },
                { v: "free", t: "Без лимита" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => set({ mode: o.v })}
                  className="press py-3 rounded-2xl text-[13px] font-semibold"
                  style={{
                    background: form.mode === o.v ? rgba(color, 0.2) : "rgba(255,255,255,.05)",
                    border: `1px solid ${form.mode === o.v ? rgba(color, 0.4) : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  {o.t}
                </button>
              ))}
            </div>
            {form.mode === "free" ? (
              <div className="text-[12.5px] text-white/40 leading-relaxed">
                Лимита нет — раздел просто показывает, сколько ушло за период.
                Для здоровья и прочих непредсказуемых трат.
              </div>
            ) : (
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
            )}
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
  const { me, envelopes, finOps, finGoals } = useStore();
  const currency = me?.fin_currency || "$";
  const feePercent = Number(me?.fin_fee_percent ?? 1);
  const [editOp, setEditOp] = useState(null);
  // свежие записи сверху: операцию могли записать задним числом
  const history = useMemo(
    () => [...finOps].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)),
    [finOps]
  );

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
              {history.map((o) => (
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
        goals={finGoals}
        onClose={() => setEditOp(null)}
      />
    </>
  );
}
