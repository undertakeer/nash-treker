import { useEffect, useState } from "react";
import Sheet from "../components/Sheet";
import { Button, Field, TextInput } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { humanDateFull, todayISO } from "../lib/date";
import { EVENT_KINDS, EVENT_OFFSETS, eventKind, offsetToISO, untilLabel } from "../lib/meds";

const EMPTY = {
  title: "", emoji: "🧪", kind: "analysis", date: todayISO(),
  note: "", remind_days_before: 1,
};

const REMIND = [
  { v: 0, t: "в день" },
  { v: 1, t: "за день" },
  { v: 3, t: "за 3 дня" },
  { v: 7, t: "за неделю" },
];

export default function MedEventEditor({ open, item, onClose }) {
  const { createMedEvent, updateMedEvent, deleteMedEvent } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editing = Boolean(item);

  useEffect(() => {
    if (!open) return;
    setForm(item ? { ...EMPTY, ...item, note: item.note || "" } : EMPTY);
    setConfirmDelete(false);
    setBusy(false);
  }, [open, item]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const kind = eventKind(form.kind);
  const color = kind.color;

  function pickKind(id) {
    const k = eventKind(id);
    // эмодзи подставляем, пока его не меняли руками
    const untouched = form.emoji === eventKind(form.kind).emoji;
    set({ kind: id, ...(untouched ? { emoji: k.emoji } : {}) });
  }

  async function save() {
    if (!form.title.trim() || busy) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      emoji: form.emoji,
      kind: form.kind,
      date: form.date,
      note: form.note?.trim() || null,
      remind_days_before: form.remind_days_before,
    };
    try {
      if (editing) await updateMedEvent(item.id, payload);
      else {
        const made = await createMedEvent(payload);
        if (!made) return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteMedEvent(item.id);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{editing ? "Событие" : "Новое событие"}</div>
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
            <div className="text-[16px] font-bold truncate">{form.title || "Что сделать"}</div>
            <div className="text-[13px] text-white/40 truncate">
              {humanDateFull(form.date)} · {untilLabel(form.date)}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Field label="Что сделать">
            <TextInput
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Например, сдать биохимию крови"
              maxLength={80}
            />
          </Field>

          <Field label="Что это">
            <div className="flex flex-wrap gap-2">
              {EVENT_KINDS.map((k) => {
                const on = form.kind === k.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => pickKind(k.id)}
                    className="press px-3 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1.5"
                    style={{
                      background: on ? rgba(k.color, 0.22) : "rgba(255,255,255,.05)",
                      border: `1px solid ${on ? rgba(k.color, 0.45) : "rgba(255,255,255,.08)"}`,
                    }}
                  >
                    <span>{k.emoji}</span>{k.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Когда" hint="Быстрые сроки считаются от сегодня.">
            <div className="flex flex-wrap gap-2">
              {EVENT_OFFSETS.map((o) => {
                const iso = offsetToISO(o);
                const on = form.date === iso;
                return (
                  <button
                    key={o.label}
                    onClick={() => set({ date: iso })}
                    className="press px-3 py-2 rounded-xl text-[13px] font-semibold"
                    style={{
                      background: on ? hex(color) : "rgba(255,255,255,.06)",
                      color: on ? "#0A0A0E" : "rgba(255,255,255,.55)",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set({ date: e.target.value || todayISO() })}
              className="w-full mt-2.5 px-4 py-3.5 rounded-2xl bg-white/6 border border-white/10 outline-none font-semibold"
            />
          </Field>

          <Field label="Напомнить">
            <div className="grid grid-cols-4 gap-2">
              {REMIND.map((r) => {
                const on = form.remind_days_before === r.v;
                return (
                  <button
                    key={r.v}
                    onClick={() => set({ remind_days_before: r.v })}
                    className="press py-2.5 rounded-xl text-[13px] font-bold"
                    style={{
                      background: on ? hex(color) : "rgba(255,255,255,.06)",
                      color: on ? "#0A0A0E" : "rgba(255,255,255,.55)",
                    }}
                  >
                    {r.t}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Заметка">
            <TextInput
              value={form.note}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Например, натощак, в лаборатории на Шота Руставели"
              maxLength={200}
            />
          </Field>

          <Button onClick={save} disabled={busy || !form.title.trim()} colorKey={color}>
            {editing ? "Сохранить" : "Добавить событие"}
          </Button>

          {editing && (
            <Button variant="danger" onClick={remove}>
              {confirmDelete ? "Точно удалить?" : "Удалить событие"}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
