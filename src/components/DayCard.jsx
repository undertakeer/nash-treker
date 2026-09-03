import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { relativeDay } from "../lib/date";

/** Блок «сегодня»: фото, заметка и заморозка для одного дня привычки */
export default function DayCard({ habit, day, colorKey = "mint", canEdit }) {
  const {
    uid, checkinFor, attachPhoto, removePhoto, setNote,
    freezeSetFor, freezeDay, unfreezeDay, freezesLeft, showToast,
  } = useStore();

  const row = checkinFor(habit.id, uid, day);
  const frozen = freezeSetFor(habit.id, uid).has(day);
  const fileRef = useRef(null);
  const [note, setLocalNote] = useState(row?.note || "");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => setLocalNote(row?.note || ""), [row?.note, day]);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      await attachPhoto(habit, day, file);
    } catch (err) {
      showToast(err.message || "Не удалось загрузить", "⚠️");
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit) return null;

  return (
    <div className="rounded-2xl bg-white/5 border border-white/8 overflow-hidden mb-6">
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-white/45">{relativeDay(day)}</div>
        {frozen && (
          <span
            className="text-[11.5px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: rgba("sky", 0.18), color: hex("sky") }}
          >
            🧊 заморожен
          </span>
        )}
      </div>

      {row?.photo_url ? (
        <div className="px-4 pb-3">
          <motion.img
            layout
            src={row.photo_url}
            alt=""
            onClick={() => setZoom(true)}
            className="w-full rounded-xl object-cover cursor-zoom-in"
            style={{ maxHeight: 260 }}
          />
          <button
            onClick={() => removePhoto(habit, day)}
            className="press text-[12.5px] text-white/35 mt-2"
          >
            Убрать фото
          </button>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="press w-full py-3 rounded-xl text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: rgba(colorKey, 0.14), color: hex(colorKey) }}
          >
            📸 {busy ? "Загружаем…" : "Добавить фотоотчёт"}
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />

      <div className="px-4 pb-3">
        <input
          value={note}
          onChange={(e) => setLocalNote(e.target.value.slice(0, 140))}
          onBlur={() => note.trim() !== (row?.note || "") && setNote(habit, day, note)}
          placeholder="Заметка к дню — увидит партнёр"
          maxLength={140}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/6 border border-white/10 outline-none
                     text-[14px] placeholder:text-white/25 focus:border-white/25"
        />
      </div>

      <div className="px-4 pb-3.5">
        {frozen ? (
          <button
            onClick={() => unfreezeDay(habit, day)}
            className="press text-[13px] text-white/40 font-semibold"
          >
            Снять заморозку
          </button>
        ) : (
          <button
            onClick={() => freezeDay(habit, day)}
            disabled={Boolean(row) || freezesLeft <= 0}
            className="press text-[13px] font-semibold disabled:opacity-30"
            style={{ color: hex("sky") }}
          >
            🧊 Заморозить день · осталось {freezesLeft}
          </button>
        )}
        <div className="text-[11.5px] text-white/25 mt-1.5 leading-snug">
          Заморозка спасает стрик, когда день пропущен по уважительной причине.
        </div>
      </div>

      {zoom && row?.photo_url && (
        <div
          className="fixed inset-0 z-[80] bg-black/92 grid place-items-center p-4"
          onClick={() => setZoom(false)}
        >
          <img src={row.photo_url} alt="" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
