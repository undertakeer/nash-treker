import { useEffect, useState } from "react";
import Sheet from "../components/Sheet";
import EmojiPicker from "../components/EmojiPicker";
import { Button, Field, Switch, TextInput } from "../components/ui";
import { useStore } from "../lib/store";
import { COLORS, COLOR_KEYS, hex, rgba } from "../lib/theme";
import { WEEKDAY_SHORT, humanDateFull, todayISO } from "../lib/date";
import { MED_SCHEDULES, hhmm, scheduleLabel } from "../lib/meds";

const EMOJI = [
  "💊","🧴","💉","🩹","🧪","🌡","🧫","🫧","🧼","🪥","🧽","🥛","🍶","☀️","🌙","🧻",
  "🧂","🍋","🐟","🥑","🥕","💧","🫙","🧬","🩺","🦠","🫀","🧠","👁","✨",
];

// сколько тянется курс — обычные для лечения сроки
const LENGTHS = [
  { label: "без срока", months: null },
  { label: "1 мес", months: 1 },
  { label: "2 мес", months: 2 },
  { label: "3 мес", months: 3 },
  { label: "6 мес", months: 6 },
];

const EMPTY = {
  title: "", emoji: "💊", color: "teal", dose: "", note: "",
  schedule_type: "daily", target_per_week: 7, weekdays: [1, 2, 3, 4, 5, 6, 7],
  every_n_days: 2, day_of_month: 1, times: ["09:00"],
  start_date: todayISO(), end_date: null, reminder: true, status: "active",
};

function plusMonths(iso, months) {
  const d = new Date(iso);
  const day = d.getDate();
  const shifted = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
  shifted.setDate(Math.min(day, last));
  const p = (n) => String(n).padStart(2, "0");
  return `${shifted.getFullYear()}-${p(shifted.getMonth() + 1)}-${p(shifted.getDate())}`;
}

export default function MedEditor({ open, med, onClose }) {
  const { createMed, updateMed, deleteMed } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(med);

  useEffect(() => {
    if (!open) return;
    setForm(med
      ? { ...EMPTY, ...med, times: (med.times || ["09:00"]).map(hhmm), dose: med.dose || "", note: med.note || "" }
      : EMPTY);
    setConfirmDelete(false);
    setBusy(false);
  }, [open, med]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const color = form.color || "teal";

  function toggleWeekday(d) {
    const has = form.weekdays.includes(d);
    const next = has ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort();
    if (next.length) set({ weekdays: next });
  }

  function setTime(i, value) {
    const next = form.times.slice();
    next[i] = value;
    set({ times: next });
  }

  function addTime() {
    if (form.times.length >= 6) return;
    const last = form.times[form.times.length - 1] || "09:00";
    const h = Math.min(23, Number(last.slice(0, 2)) + 6);
    set({ times: [...form.times, `${String(h).padStart(2, "0")}:00`] });
  }

  const removeTime = (i) =>
    form.times.length > 1 && set({ times: form.times.filter((_, x) => x !== i) });

  async function save() {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      emoji: form.emoji,
      color: form.color,
      dose: form.dose?.trim() || null,
      note: form.note?.trim() || null,
      schedule_type: form.schedule_type,
      target_per_week: form.schedule_type === "times_per_week" ? form.target_per_week : 7,
      weekdays: form.schedule_type === "weekdays" ? form.weekdays : [1, 2, 3, 4, 5, 6, 7],
      every_n_days: form.schedule_type === "every_n_days" ? form.every_n_days : 2,
      day_of_month: form.schedule_type === "monthly" ? form.day_of_month : null,
      // приёмы держим отсортированными: по ним строится экран «Сегодня»
      times: [...new Set(form.times.map(hhmm))].sort(),
      start_date: form.start_date,
      end_date: form.end_date,
      reminder: form.reminder,
      status: form.status,
    };
    try {
      if (editing) await updateMed(med.id, payload);
      else {
        const made = await createMed(payload);
        if (!made) return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteMed(med.id);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{editing ? "Препарат" : "Новый препарат"}</div>
          <button
            onClick={save}
            disabled={busy || !form.title.trim()}
            className="press text-[15px] font-bold disabled:opacity-30"
            style={{ color: hex(color) }}
          >
            {editing ? "Сохранить" : "Создать"}
          </button>
        </div>

        <div
          className="rounded-2xl p-4 mb-6 flex items-center gap-3"
          style={{ background: rgba(color, 0.12), border: `1px solid ${rgba(color, 0.18)}` }}
        >
          <span
            className="w-11 h-11 rounded-2xl grid place-items-center text-[22px] shrink-0"
            style={{ background: rgba(color, 0.2) }}
          >
            {form.emoji}
          </span>
          <div className="min-w-0">
            <div className="text-[16px] font-bold truncate">{form.title || "Название препарата"}</div>
            <div className="text-[13px] text-white/40 truncate">
              {scheduleLabel(form)} · {form.times.map(hhmm).join(", ")}
              {form.dose ? ` · ${form.dose}` : ""}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Field label="Что принимать">
            <TextInput
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Например, Роаккутан"
              maxLength={80}
            />
          </Field>

          <Field label="Дозировка" hint="Как принимать — чтобы не держать в голове.">
            <TextInput
              value={form.dose}
              onChange={(e) => set({ dose: e.target.value })}
              placeholder="1 капсула 20 мг после еды"
              maxLength={80}
            />
          </Field>

          <Field label="Во сколько" hint="Можно несколько приёмов в день — каждый отмечается отдельно.">
            <div className="space-y-2">
              {form.times.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={hhmm(t)}
                    onChange={(e) => setTime(i, e.target.value)}
                    className="flex-1 px-4 py-3 rounded-2xl bg-white/6 border border-white/10 outline-none font-semibold"
                  />
                  {form.times.length > 1 && (
                    <button
                      onClick={() => removeTime(i)}
                      className="press w-11 h-11 shrink-0 rounded-2xl bg-white/6 grid place-items-center text-[18px] text-white/45"
                      aria-label="Убрать приём"
                    >
                      −
                    </button>
                  )}
                </div>
              ))}
              {form.times.length < 6 && (
                <button
                  onClick={addTime}
                  className="press w-full py-2.5 rounded-xl bg-white/5 border border-dashed border-white/15 text-[13.5px] font-semibold text-white/55"
                >
                  ➕ Ещё приём в день
                </button>
              )}
            </div>
          </Field>

          <Field label="Как часто">
            <div className="space-y-2">
              {MED_SCHEDULES.map((o) => (
                <button
                  key={o.v}
                  onClick={() => set({ schedule_type: o.v })}
                  className="w-full press py-3 px-4 rounded-2xl text-[14px] font-semibold text-left"
                  style={{
                    background: form.schedule_type === o.v ? rgba(color, 0.18) : "rgba(255,255,255,.05)",
                    border: `1px solid ${form.schedule_type === o.v ? rgba(color, 0.36) : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  {o.t}
                </button>
              ))}
            </div>

            {form.schedule_type === "times_per_week" && (
              <div className="flex gap-1.5 mt-3">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => set({ target_per_week: n })}
                    className="flex-1 aspect-square rounded-xl text-[14px] font-bold press"
                    style={{
                      background: form.target_per_week === n ? hex(color) : "rgba(255,255,255,.06)",
                      color: form.target_per_week === n ? "#0A0A0E" : "rgba(255,255,255,.6)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {form.schedule_type === "weekdays" && (
              <div className="flex gap-1.5 mt-3">
                {WEEKDAY_SHORT.map((d, i) => {
                  const on = form.weekdays.includes(i + 1);
                  return (
                    <button
                      key={d}
                      onClick={() => toggleWeekday(i + 1)}
                      className="flex-1 py-2.5 rounded-xl text-[12.5px] font-bold press"
                      style={{
                        background: on ? hex(color) : "rgba(255,255,255,.06)",
                        color: on ? "#0A0A0E" : "rgba(255,255,255,.5)",
                      }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}

            {form.schedule_type === "every_n_days" && (
              <div className="flex items-center gap-2.5 mt-3">
                <span className="text-[14px] text-white/45 shrink-0">каждые</span>
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={60}
                  value={form.every_n_days}
                  onChange={(e) => set({ every_n_days: Math.min(60, Math.max(2, Number(e.target.value) || 2)) })}
                  className="flex-1"
                />
                <span className="text-[14px] text-white/45 shrink-0">дней</span>
              </div>
            )}

            {form.schedule_type === "monthly" && (
              <div className="flex items-center gap-2.5 mt-3">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={form.day_of_month}
                  onChange={(e) => set({ day_of_month: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
                  className="flex-1"
                />
                <span className="text-[14px] text-white/45 shrink-0">числа каждого месяца</span>
              </div>
            )}
          </Field>

          <Field label="Начало" hint={`Расписание «через N дней» считается от этой даты.`}>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => set({ start_date: e.target.value || todayISO() })}
              className="w-full px-4 py-3.5 rounded-2xl bg-white/6 border border-white/10 outline-none font-semibold"
            />
          </Field>

          <Field label="Сколько тянется" hint={form.end_date ? `До ${humanDateFull(form.end_date)}` : "Пока не отменю."}>
            <div className="flex gap-2 flex-wrap">
              {LENGTHS.map((l) => {
                const iso = l.months ? plusMonths(form.start_date, l.months) : null;
                const on = form.end_date === iso || (!l.months && !form.end_date);
                return (
                  <button
                    key={l.label}
                    onClick={() => set({ end_date: iso })}
                    className="press px-3.5 py-2.5 rounded-xl text-[13px] font-bold"
                    style={{
                      background: on ? hex(color) : "rgba(255,255,255,.06)",
                      color: on ? "#0A0A0E" : "rgba(255,255,255,.55)",
                    }}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
            <input
              type="date"
              value={form.end_date || ""}
              min={form.start_date}
              onChange={(e) => set({ end_date: e.target.value || null })}
              className="w-full mt-2.5 px-4 py-3 rounded-2xl bg-white/6 border border-white/10 outline-none font-semibold"
            />
          </Field>

          <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/6">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className="text-[15px] font-semibold">Напоминать</div>
                <div className="text-[12.5px] text-white/35">Пуш в каждое время приёма</div>
              </div>
              <Switch checked={form.reminder} onChange={(v) => set({ reminder: v })} />
            </div>
            {editing && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <div className="text-[15px] font-semibold">На паузе</div>
                  <div className="text-[12.5px] text-white/35">Пропадёт из «Сегодня», но не удалится</div>
                </div>
                <Switch
                  checked={form.status === "paused"}
                  onChange={(v) => set({ status: v ? "paused" : "active" })}
                />
              </div>
            )}
          </div>

          <Field label="Заметка">
            <TextInput
              value={form.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Например, не сочетать с витамином А"
              maxLength={200}
            />
          </Field>

          <Field label="Иконка">
            <EmojiPicker
              value={form.emoji}
              onChange={(emoji) => set({ emoji })}
              list={EMOJI}
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

          <Button onClick={save} disabled={busy || !form.title.trim()} colorKey={color}>
            {editing ? "Сохранить" : "Добавить в лечение"}
          </Button>

          {editing && (
            <Button variant="danger" onClick={remove}>
              {confirmDelete ? "Точно удалить?" : "Удалить препарат"}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
