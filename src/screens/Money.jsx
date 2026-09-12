import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import MissingTable from "../components/MissingTable";
import { Button, Empty, Field, Progress, TextInput } from "../components/ui";
import Sheet from "../components/Sheet";
import EmojiPicker from "../components/EmojiPicker";
import { useStore } from "../lib/store";
import { COLORS, COLOR_KEYS, hex, rgba } from "../lib/theme";
import { humanDate, todayISO } from "../lib/date";
import {
  daysLeftInMonth, money, monthKey, monthLabel, monthPlan, shiftMonth, walletBalance,
} from "../lib/finance";

const EMOJI = [
  "💵","💰","🏦","💳","🐖","💗","🤖","💊","🩹","🍔","🛒","🏠","🚗","⛽️","📱","🎮",
  "👕","✈️","🎁","☕️","🍿","🏋️","📚","🐈","🔧","💡","🧾","🎓","🪙","📈",
];

export default function Money({ onOpenOps }) {
  const { me, envelopes, finOps, missing, addFinOp } = useStore();
  const currency = me?.fin_currency || "$";
  const today = todayISO();

  const [month, setMonth] = useState(() => monthKey(today));
  const [editor, setEditor] = useState(null);   // { envelope } | { envelope: null }
  const [spend, setSpend] = useState(null);     // конверт, из которого пишем трату
  const [income, setIncome] = useState(false);

  const plan = useMemo(() => monthPlan(envelopes, finOps, month), [envelopes, finOps, month]);
  const balance = useMemo(() => walletBalance(finOps), [finOps]);
  const daysLeft = daysLeftInMonth(month, today);

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
        <div className="text-[38px] font-extrabold leading-none">{money(balance, currency)}</div>
        <div className="text-[12.5px] text-white/45 mt-2">
          за {monthLabel(month)}: пришло {money(plan.income, currency)} · снято {money(plan.spent, currency)}
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
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          className="press w-8 h-8 rounded-full bg-white/8 grid place-items-center text-[14px] text-white/50"
          aria-label="Предыдущий месяц"
        >
          ‹
        </button>
        <div className="text-[14px] font-bold">{monthLabel(month)}</div>
        <button
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={month >= monthKey(today)}
          className="press w-8 h-8 rounded-full bg-white/8 grid place-items-center text-[14px] text-white/50 disabled:opacity-25"
          aria-label="Следующий месяц"
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
            {plan.rows.map((row) => (
              <EnvelopeRow
                key={row.envelope.id}
                row={row}
                currency={currency}
                income={plan.income}
                daysLeft={daysLeft}
                onSpend={() => setSpend(row.envelope)}
                onEdit={() => setEditor({ envelope: row.envelope })}
              />
            ))}
          </AnimatePresence>

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
        onSubmit={async (amount, note) => {
          await addFinOp({
            envelope_id: spend?.id || null,
            kind: "expense",
            amount,
            note: note || null,
            day: today,
          });
          setSpend(null);
        }}
      />

      <IncomeSheet
        open={income}
        currency={currency}
        onClose={() => setIncome(false)}
        onSubmit={async (amount, note) => {
          await addFinOp({ envelope_id: null, kind: "income", amount, note: note || null, day: today });
          setIncome(false);
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
  const perDay = daysLeft && left > 0 ? left / daysLeft : null;

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
              {perDay ? ` · ${money(perDay, currency)} в день` : ""}
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

function AmountSheet({ open, title, hint, actionLabel, colorKey, currency, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const value = Number(String(amount).replace(",", "."));
  const valid = Number.isFinite(value) && value > 0;

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSubmit(Math.round(value * 100) / 100, note.trim());
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
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="0"
                className="flex-1 min-w-0 text-[20px] font-extrabold"
                autoFocus
              />
            </div>
          </Field>

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

function SpendSheet({ envelope, currency, onClose, onSubmit }) {
  return (
    <AmountSheet
      open={Boolean(envelope)}
      title={envelope ? `${envelope.emoji} ${envelope.title}` : ""}
      hint="Записываем, что снято с кошелька."
      actionLabel="Записать трату"
      colorKey={envelope?.color || "rose"}
      currency={currency}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function IncomeSheet({ open, currency, onClose, onSubmit }) {
  return (
    <AmountSheet
      open={open}
      title="Пришли деньги"
      hint="Приход добавится на кошелёк и разойдётся по процентным разделам."
      actionLabel="Записать приход"
      colorKey="mint"
      currency={currency}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

function EnvelopeEditor({ open, envelope, currency, emojiList, onClose }) {
  const { createEnvelope, updateEnvelope, deleteEnvelope } = useStore();
  const [form, setForm] = useState({ title: "", emoji: "💵", color: "mint", mode: "fixed", plan: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(envelope);

  useEffect(() => {
    if (!open) return;
    setForm(envelope
      ? { ...envelope, plan: String(envelope.plan ?? ""), note: envelope.note || "" }
      : { title: "", emoji: "💵", color: "mint", mode: "fixed", plan: "", note: "" });
    setConfirmDelete(false);
  }, [open, envelope]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const color = form.color || "mint";
  const planValue = Number(String(form.plan).replace(",", "."));
  const valid = form.title.trim() && Number.isFinite(planValue) && planValue >= 0;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      emoji: form.emoji,
      color: form.color,
      mode: form.mode,
      plan: Math.round(planValue * 100) / 100,
      note: form.note?.trim() || null,
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
                type="number"
                inputMode="decimal"
                min={0}
                step={form.mode === "percent" ? "1" : "0.01"}
                value={form.plan}
                onChange={(e) => set({ plan: e.target.value })}
                placeholder="0"
                className="flex-1 min-w-0 text-[17px] font-bold"
              />
              <span className="text-[16px] font-extrabold text-white/40 shrink-0 w-8 text-center">
                {form.mode === "percent" ? "%" : currency}
              </span>
            </div>
          </Field>

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
  const { me, envelopes, finOps, deleteFinOp } = useStore();
  const currency = me?.fin_currency || "$";
  const byId = useMemo(() => new Map(envelopes.map((e) => [e.id, e])), [envelopes]);

  return (
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
            {finOps.map((o) => {
              const e = o.envelope_id ? byId.get(o.envelope_id) : null;
              const plus = o.kind === "income";
              return (
                <div
                  key={o.id}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white/4 border border-white/6"
                >
                  <span className="text-[19px] shrink-0">{plus ? "💚" : e?.emoji || "💸"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14.5px] font-semibold truncate">
                      {o.note || (plus ? "Приход" : e?.title || "Трата")}
                    </div>
                    <div className="text-[12px] text-white/35 truncate">
                      {humanDate(o.day)}
                      {e && !plus ? ` · ${e.title}` : ""}
                    </div>
                  </div>
                  <div
                    className="text-[15px] font-extrabold shrink-0"
                    style={{ color: plus ? hex("mint") : "#fff" }}
                  >
                    {plus ? "+" : "−"}{money(o.amount, currency)}
                  </div>
                  <button
                    onClick={() => deleteFinOp(o.id)}
                    className="press w-7 h-7 shrink-0 rounded-full bg-white/6 grid place-items-center text-[13px] text-white/35"
                    aria-label="Удалить запись"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
