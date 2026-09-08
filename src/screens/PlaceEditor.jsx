import { useEffect, useRef, useState } from "react";
import Sheet from "../components/Sheet";
import EmojiPicker from "../components/EmojiPicker";
import { Button, Field, TextInput } from "../components/ui";
import { useStore } from "../lib/store";
import { COLORS, COLOR_KEYS, hex, rgba } from "../lib/theme";
import { CATEGORIES, categoryOf, coordLabel } from "../lib/places";

const EMOJI = [
  "📍","🪑","☕️","🍽","🍕","🍦","🌇","🌳","🏞","🌊","🛍","🎬","🎭","🎨","📚","🏛",
  "🕌","🏰","🎡","🎳","🏊","⛰","🚲","🛝","🐈","🌸","🍻","🥐","🍜","🎂",
];

const EMPTY = {
  title: "", emoji: "📍", color: "sky", category: "other",
  note: "", status: "want",
};

export default function PlaceEditor({ open, place, draft, onClose }) {
  const { createPlace, updatePlace, deletePlace } = useStore();
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInput = useRef(null);
  const editing = Boolean(place);
  const point = place || draft;

  useEffect(() => {
    if (!open) return;
    setForm(place ? { ...EMPTY, ...place } : EMPTY);
    setFile(null);
    setPreview(null);
    setConfirmDelete(false);
    setBusy(false);
  }, [open, place]);

  // объектные ссылки нужно отзывать, иначе снимки висят в памяти
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const color = form.color || "sky";

  function pickCategory(id) {
    const c = categoryOf(id);
    // эмодзи и цвет подставляем, только пока их не трогали руками
    const untouched = form.emoji === categoryOf(form.category).emoji;
    set({ category: id, ...(untouched ? { emoji: c.emoji, color: c.color } : {}) });
  }

  function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!form.title.trim() || !point || busy) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      emoji: form.emoji,
      color: form.color,
      category: form.category,
      note: form.note?.trim() || null,
      status: form.status,
    };
    try {
      if (editing) await updatePlace(place.id, payload, file);
      else await createPlace({ ...payload, lat: point.lat, lng: point.lng }, file);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deletePlace(place.id);
    onClose();
  }

  const shot = preview || place?.thumb_url || place?.photo_url;

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">{editing ? "Место" : "Новое место"}</div>
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
            <div className="text-[16px] font-bold truncate">{form.title || "Название места"}</div>
            <div className="text-[13px] text-white/40 truncate">
              {categoryOf(form.category).label}
              {point ? ` · ${coordLabel(point)}` : ""}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Field label="Что за место">
            <TextInput
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Например, скамейка у Ц-1"
              maxLength={80}
            />
          </Field>

          <Field label="Заметка" hint="Чем запомнилось, как найти, когда лучше приходить.">
            <TextInput
              value={form.note || ""}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="Необязательно"
              maxLength={200}
            />
          </Field>

          <Field label="Категория">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = form.category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => pickCategory(c.id)}
                    className="press px-3 py-2 rounded-xl text-[13px] font-semibold flex items-center gap-1.5"
                    style={{
                      background: on ? rgba(color, 0.22) : "rgba(255,255,255,.05)",
                      border: `1px solid ${on ? rgba(color, 0.45) : "rgba(255,255,255,.08)"}`,
                    }}
                  >
                    <span>{c.emoji}</span>{c.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Фото">
            <input ref={fileInput} type="file" accept="image/*" onChange={pickFile} className="hidden" />
            {shot ? (
              <div className="relative rounded-2xl overflow-hidden">
                <img src={shot} alt="" className="w-full h-44 object-cover" />
                <button
                  onClick={() => fileInput.current?.click()}
                  className="press absolute bottom-2 right-2 px-3 py-1.5 rounded-xl bg-black/65 text-[12.5px] font-semibold"
                >
                  Заменить
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInput.current?.click()}
                className="press w-full py-6 rounded-2xl bg-white/5 border border-dashed border-white/15 text-[13.5px] font-semibold text-white/55"
              >
                📷 Добавить фото
              </button>
            )}
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

          <Field label="Статус">
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "want", t: "Хотим сходить", e: "💭" },
                { v: "visited", t: "Были", e: "✅" },
              ].map((o) => (
                <button
                  key={o.v}
                  onClick={() => set({ status: o.v })}
                  className="press py-3 rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2"
                  style={{
                    background: form.status === o.v ? rgba(color, 0.2) : "rgba(255,255,255,.05)",
                    border: `1px solid ${form.status === o.v ? rgba(color, 0.4) : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  <span>{o.e}</span>{o.t}
                </button>
              ))}
            </div>
          </Field>

          <Button onClick={save} disabled={busy || !form.title.trim()} colorKey={color}>
            {editing ? "Сохранить" : "Добавить на карту"}
          </Button>

          {editing && (
            <Button variant="danger" onClick={remove}>
              {confirmDelete ? "Точно удалить?" : "Удалить место"}
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
