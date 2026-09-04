import { useEffect, useState } from "react";
import Sheet from "../components/Sheet";
import Avatar from "../components/Avatar";
import { Button, Field, TextInput } from "../components/ui";
import { useStore } from "../lib/store";
import { COLORS, COLOR_KEYS, hex, rgba } from "../lib/theme";
import { addDays, relativeDay, todayISO } from "../lib/date";

const EMOJI = [
  "📌","✅","🛒","🧹","🧺","🍽","🍳","💊","🏥","💰","💳","📞","✉️","📄","🔧","🚗",
  "⛽️","🐶","🌿","🎁","🎂","🎓","💻","✈️","🏖","🎬","📚","🧾","🔑","📦",
];

const EMPTY = {
  title: "", emoji: "📌", color: "sky", note: "",
  due_date: null, due_time: null, assignee_id: null, priority: 0,
};

export default function TaskEditor({ open, task, onClose }) {
  const { uid, profiles, partner, createTask, updateTask, deleteTask } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(task);
  const today = todayISO();

  useEffect(() => {
    if (!open) return;
    setForm(task ? { ...EMPTY, ...task } : EMPTY);
    setConfirmDelete(false);
  }, [open, task]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const color = form.color || "sky";

  async function save() {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      emoji: form.emoji,
      color: form.color,
      note: form.note?.trim() || null,
      due_date: form.due_date || null,
      due_time: form.due_date ? form.due_time || null : null,
      assignee_id: form.assignee_id,
      priority: form.priority ? 1 : 0,
    };
    if (editing) await updateTask(task.id, payload);
    else await createTask(payload);
    onClose();
  }

  const dueOptions = [
    { v: null, t: "Без срока" },
    { v: today, t: "Сегодня" },
    { v: addDays(today, 1), t: "Завтра" },
    { v: addDays(today, 7), t: "Через неделю" },
  ];

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{editing ? "Задача" : "Новая задача"}</div>
          <button
            onClick={save}
            disabled={!form.title.trim()}
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
            <div className="text-[16px] font-bold truncate">{form.title || "Название задачи"}</div>
            <div className="text-[13px] text-white/40 truncate">
              {form.due_date ? relativeDay(form.due_date) : "без срока"}
              {form.due_time ? ` · ${form.due_time.slice(0, 5)}` : ""}
              {form.priority ? " · важное" : ""}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Field label="Что сделать">
            <TextInput
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Например, купить корм коту"
              maxLength={80}
            />
          </Field>

          <Field label="Заметка">
            <TextInput
              value={form.note || ""}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Необязательно"
              maxLength={140}
            />
          </Field>

          <Field label="Стикер">
            <div className="grid grid-cols-10 gap-1.5 max-h-[132px] overflow-y-auto no-scrollbar p-1">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  onClick={() => set({ emoji: e })}
                  className="aspect-square rounded-xl grid place-items-center text-[17px] press"
                  style={{
                    background: form.emoji === e ? rgba(color, 0.28) : "rgba(255,255,255,.05)",
                    border: `1px solid ${form.emoji === e ? rgba(color, 0.5) : "transparent"}`,
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Цвет">
            <div className="flex flex-wrap gap-2.5">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => set({ color: k })}
                  className="w-8 h-8 rounded-full press"
                  style={{
                    background: hex(k),
                    boxShadow: form.color === k ? `0 0 0 2.5px #111116, 0 0 0 4.5px ${hex(k)}` : "none",
                  }}
                  aria-label={COLORS[k].label}
                />
              ))}
            </div>
          </Field>

          <Field label="Когда">
            <div className="flex flex-wrap gap-2">
              {dueOptions.map((o) => (
                <button
                  key={String(o.v)}
                  onClick={() => set({ due_date: o.v, due_time: o.v ? form.due_time : null })}
                  className="press px-3.5 py-2.5 rounded-xl text-[13px] font-semibold"
                  style={{
                    background: form.due_date === o.v ? rgba(color, 0.22) : "rgba(255,255,255,.05)",
                    color: form.due_date === o.v ? hex(color) : "rgba(255,255,255,.55)",
                    border: `1px solid ${form.due_date === o.v ? rgba(color, 0.4) : "transparent"}`,
                  }}
                >
                  {o.t}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2.5">
              <input
                type="date"
                value={form.due_date || ""}
                onChange={(e) => set({ due_date: e.target.value || null })}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/6 border border-white/10 outline-none text-[14px]"
              />
              <input
                type="time"
                value={(form.due_time || "").slice(0, 5)}
                disabled={!form.due_date}
                onChange={(e) => set({ due_time: e.target.value || null })}
                className="px-3.5 py-2.5 rounded-xl bg-white/6 border border-white/10 outline-none text-[14px] disabled:opacity-35"
              />
            </div>
            {form.due_time && (
              <div className="text-[12px] text-white/30 mt-1.5">
                В это время придёт напоминание — если уведомления включены.
              </div>
            )}
          </Field>

          <Field label="Кому">
            <div className="flex flex-wrap gap-2">
              <Who active={!form.assignee_id} onClick={() => set({ assignee_id: null })} label="Общая" emoji="🫶" color={color} />
              {profiles.map((p) => (
                <Who
                  key={p.id}
                  active={form.assignee_id === p.id}
                  onClick={() => set({ assignee_id: p.id })}
                  label={p.id === uid ? "Мне" : p.display_name?.split(" ")[0] || "Партнёру"}
                  avatar={p}
                  color={color}
                />
              ))}
            </div>
            {!partner && (
              <div className="text-[12px] text-white/30 mt-1.5">
                Второй профиль появится, когда партнёр войдёт в приложение.
              </div>
            )}
          </Field>

          <button
            onClick={() => set({ priority: form.priority ? 0 : 1 })}
            className="press w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white/5 border border-white/8"
          >
            <span className="text-[15px] font-semibold">❗️ Важное</span>
            <span
              className="w-[50px] h-[30px] rounded-full relative transition-colors"
              style={{ background: form.priority ? hex("amber") : "rgba(255,255,255,.14)" }}
            >
              <span
                className="absolute top-[3px] w-6 h-6 rounded-full bg-white transition-all"
                style={{ left: form.priority ? 23 : 3 }}
              />
            </span>
          </button>

          <Button onClick={save} disabled={!form.title.trim()} colorKey={color}>
            {editing ? "Сохранить" : "Создать задачу"}
          </Button>

          {editing && (
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) { deleteTask(task.id); onClose(); }
                else setConfirmDelete(true);
              }}
            >
              {confirmDelete ? "Точно удалить? Нажмите ещё раз" : "Удалить задачу"}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function Who({ active, onClick, label, emoji, avatar, color }) {
  return (
    <button
      onClick={onClick}
      className="press px-3.5 py-2.5 rounded-xl text-[13px] font-semibold flex items-center gap-2"
      style={{
        background: active ? rgba(color, 0.22) : "rgba(255,255,255,.05)",
        color: active ? hex(color) : "rgba(255,255,255,.55)",
        border: `1px solid ${active ? rgba(color, 0.4) : "transparent"}`,
      }}
    >
      {avatar ? <Avatar profile={avatar} size={18} showMood={false} /> : <span>{emoji}</span>}
      {label}
    </button>
  );
}
