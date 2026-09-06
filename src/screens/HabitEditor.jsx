import { useEffect, useState } from "react";
import Sheet from "../components/Sheet";
import EmojiPicker from "../components/EmojiPicker";
import { Button, Field, Switch, TextInput } from "../components/ui";
import { COLORS, COLOR_KEYS, hex, rgba } from "../lib/theme";
import { WEEKDAY_SHORT } from "../lib/date";
import { useStore } from "../lib/store";

const EMOJI = [
  "💧","🏃","🏋️","🧘","📚","✍️","🎯","💤","🥗","🍎","☕","🚭","💊","🦷","🧴","🚿",
  "🧹","🧺","🍳","🛒","💰","📈","💼","💻","🎨","🎸","🎧","🎮","📷","🌱","🐶","🐱",
  "❤️","🫶","💋","🎁","🌹","🕯","🍷","🍿","🎬","✈️","🚶","👟","🧠","🙏","📵","⏰",
  "🌞","🌙","🔥","⭐️","🏆","🎰","🥂","🧊","🩺","🚴","🏊","⛰","🧗","🎾","⚽️","🏀",
];

const GOAL_PRESETS = [null, 21, 30, 66, 100];
const GOAL_MAX = 999;

function daysWord(n) {
  const v = Number(n);
  if (!v) return "дней";
  const t = v % 100;
  if (t >= 11 && t <= 14) return "дней";
  const o = v % 10;
  if (o === 1) return "день";
  if (o >= 2 && o <= 4) return "дня";
  return "дней";
}

const EMPTY = {
  title: "", icon: "💧", color: "mint", kind: "shared",
  schedule_type: "daily", target_per_week: 7, weekdays: [1, 2, 3, 4, 5, 6, 7],
  reminder_enabled: false, reminder_time: "09:00", goal_days: null, pinned: false,
};

export default function HabitEditor({ open, onClose, habit }) {
  const { createHabit, updateHabit } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [customGoal, setCustomGoal] = useState(false);
  const editing = Boolean(habit);

  useEffect(() => {
    if (!open) return;
    setForm(habit ? { ...EMPTY, ...habit } : EMPTY);
    setCustomGoal(Boolean(habit?.goal_days) && !GOAL_PRESETS.includes(habit.goal_days));
  }, [open, habit]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const color = form.color || "mint";

  async function save() {
    if (!form.title.trim()) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      icon: form.icon,
      color: form.color,
      kind: form.kind,
      schedule_type: form.schedule_type,
      target_per_week: form.schedule_type === "times_per_week" ? form.target_per_week : 7,
      weekdays: form.schedule_type === "weekdays" ? form.weekdays : [1, 2, 3, 4, 5, 6, 7],
      reminder_enabled: form.reminder_enabled,
      reminder_time: form.reminder_time,
      goal_days: form.goal_days ? Math.min(GOAL_MAX, Math.max(1, Math.round(form.goal_days))) : null,
      pinned: form.pinned,
    };
    try {
      if (editing) await updateHabit(habit.id, payload);
      else await createHabit(payload);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  function toggleWeekday(d) {
    const has = form.weekdays.includes(d);
    const next = has ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort();
    if (next.length) set({ weekdays: next });
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-10">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{editing ? "Изменить" : "Новая привычка"}</div>
          <button
            onClick={save}
            disabled={busy || !form.title.trim()}
            className="press text-[15px] font-bold disabled:opacity-30"
            style={{ color: hex(color) }}
          >
            {editing ? "Сохранить" : "Создать"}
          </button>
        </div>

        {/* превью */}
        <div
          className="rounded-[26px] p-5 mb-6 mt-1"
          style={{
            background: `linear-gradient(168deg, ${rgba(color, 0.16)} 0%, ${rgba(color, 0.6)} 100%), #0F0F14`,
            border: `1px solid ${rgba(color, 0.18)}`,
          }}
        >
          <div className="text-[26px] leading-none mb-8">{form.icon}</div>
          <div className="text-[19px] font-bold">{form.title || "Название привычки"}</div>
          <div className="text-[14px] text-white/45 font-medium">
            {form.schedule_type === "daily" ? "каждый день"
              : form.schedule_type === "times_per_week" ? `${form.target_per_week} раз в неделю`
              : form.weekdays.map((d) => WEEKDAY_SHORT[d - 1]).join(", ")}
          </div>
        </div>

        <div className="space-y-6">
          <Field label="Название">
            <TextInput
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Например, ходить в зал"
              maxLength={60}
            />
          </Field>

          <Field label="Иконка">
            <EmojiPicker
              value={form.icon}
              onChange={(icon) => set({ icon })}
              list={EMOJI}
              colorKey={color}
            />
          </Field>

          <Field label="Цвет">
            <div className="flex flex-wrap gap-2.5">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => set({ color: k })}
                  className="w-9 h-9 rounded-full press grid place-items-center"
                  style={{
                    background: hex(k),
                    boxShadow: form.color === k ? `0 0 0 2.5px #111116, 0 0 0 4.5px ${hex(k)}` : "none",
                  }}
                  aria-label={COLORS[k].label}
                />
              ))}
            </div>
          </Field>

          <Field label="Тип" hint={form.kind === "shared"
            ? "Оба отмечаются, стрик считается когда отметились оба."
            : "Отмечаете только вы. Партнёр видит её, но отметить не может."}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "shared", t: "Общая", e: "🫶" },
                { v: "personal", t: "Личная", e: "🙋" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => set({ kind: o.v })}
                  className="press py-3 rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2"
                  style={{
                    background: form.kind === o.v ? rgba(color, 0.2) : "rgba(255,255,255,.05)",
                    border: `1px solid ${form.kind === o.v ? rgba(color, 0.4) : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  <span>{o.e}</span>{o.t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Как часто">
            <div className="space-y-2">
              {[
                { v: "daily", t: "Каждый день" },
                { v: "times_per_week", t: "Сколько-то раз в неделю" },
                { v: "weekdays", t: "По определённым дням" },
              ].map((o) => (
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
          </Field>

          <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/6">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className="text-[15px] font-semibold">Напоминание</div>
                <div className="text-[12.5px] text-white/35">Пуш на телефон</div>
              </div>
              <Switch checked={form.reminder_enabled} onChange={(v) => set({ reminder_enabled: v })} />
            </div>
            {form.reminder_enabled && (
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="text-[15px] font-semibold">Во сколько</div>
                <input
                  type="time"
                  value={(form.reminder_time || "09:00").slice(0, 5)}
                  onChange={(e) => set({ reminder_time: e.target.value })}
                  className="bg-white/8 rounded-xl px-3 py-1.5 text-[15px] font-semibold outline-none"
                />
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <div className="text-[15px] font-semibold">Закрепить сверху</div>
                <div className="text-[12.5px] text-white/35">Большая карточка на главной</div>
              </div>
              <Switch checked={form.pinned} onChange={(v) => set({ pinned: v })} />
            </div>
          </div>

          <Field label="Цель" hint="Когда наберёте нужное количество отметок, приложение предложит завершить привычку.">
            <div className="grid grid-cols-3 gap-2">
              {GOAL_PRESETS.map((g) => {
                const on = !customGoal && form.goal_days === g;
                return (
                  <button
                    key={String(g)}
                    onClick={() => { setCustomGoal(false); set({ goal_days: g }); }}
                    className="py-2.5 rounded-xl text-[13.5px] font-bold press"
                    style={{
                      background: on ? hex(color) : "rgba(255,255,255,.06)",
                      color: on ? "#0A0A0E" : "rgba(255,255,255,.55)",
                    }}
                  >
                    {g === null ? "без цели" : g}
                  </button>
                );
              })}
              <button
                onClick={() => { setCustomGoal(true); if (GOAL_PRESETS.includes(form.goal_days)) set({ goal_days: null }); }}
                className="py-2.5 rounded-xl text-[13.5px] font-bold press"
                style={{
                  background: customGoal ? hex(color) : "rgba(255,255,255,.06)",
                  color: customGoal ? "#0A0A0E" : "rgba(255,255,255,.55)",
                }}
              >
                своё
              </button>
            </div>

            {customGoal && (
              <div className="flex items-center gap-2.5 mt-2.5">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={GOAL_MAX}
                  value={form.goal_days ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    set({ goal_days: raw === "" ? null : Math.min(GOAL_MAX, Math.abs(parseInt(raw, 10)) || 0) || null });
                  }}
                  placeholder="например, 45"
                  className="flex-1"
                />
                <span className="text-[14px] font-semibold text-white/40 shrink-0">
                  {daysWord(form.goal_days)}
                </span>
              </div>
            )}
          </Field>

          <Button onClick={save} disabled={busy || !form.title.trim()} colorKey={color}>
            {editing ? "Сохранить" : "Создать привычку"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
