import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sheet from "../components/Sheet";
import Avatar from "../components/Avatar";
import { Empty } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { MONTHS, humanDateFull } from "../lib/date";

export default function Gallery({ open, onClose }) {
  const { photos, habits, profiles } = useStore();
  const [filter, setFilter] = useState("all");
  const [active, setActive] = useState(null);

  const withHabit = useMemo(
    () =>
      photos
        .map((c) => ({
          ...c,
          habit: habits.find((h) => h.id === c.habit_id),
          author: profiles.find((p) => p.id === c.user_id),
        }))
        .filter((c) => c.habit),
    [photos, habits, profiles]
  );

  const list = filter === "all" ? withHabit : withHabit.filter((c) => c.habit_id === filter);

  const byMonth = useMemo(() => {
    const groups = new Map();
    list.forEach((c) => {
      const key = c.day.slice(0, 7);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    });
    return [...groups.entries()];
  }, [list]);

  const usedHabits = useMemo(() => {
    const ids = new Set(withHabit.map((c) => c.habit_id));
    return habits.filter((h) => ids.has(h.id));
  }, [withHabit, habits]);

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
          <div className="text-[15px] font-bold">Галерея</div>
          <span className="text-[13px] text-white/30">{withHabit.length}</span>
        </div>

        {usedHabits.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
            <Chip active={filter === "all"} onClick={() => setFilter("all")} label="Все" />
            {usedHabits.map((h) => (
              <Chip
                key={h.id}
                active={filter === h.id}
                onClick={() => setFilter(h.id)}
                label={`${h.icon} ${h.title}`}
                colorKey={h.color}
              />
            ))}
          </div>
        )}

        {!list.length ? (
          <Empty
            emoji="📷"
            title="Фотографий пока нет"
            subtitle="Откройте привычку и добавьте фотоотчёт к дню — снимки соберутся здесь."
          />
        ) : (
          byMonth.map(([month, items]) => {
            const [y, m] = month.split("-").map(Number);
            return (
              <div key={month} className="mb-6">
                <div className="text-[13px] font-bold tracking-[0.08em] uppercase text-white/30 mb-2.5">
                  {MONTHS[m - 1]} {y}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {items.map((c) => (
                    <motion.button
                      key={`${c.habit_id}-${c.user_id}-${c.day}`}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setActive(c)}
                      className="relative aspect-square rounded-xl overflow-hidden bg-white/5"
                    >
                      <img
                        src={c.thumb_url || c.photo_url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <span
                        className="absolute left-1 bottom-1 text-[13px] w-6 h-6 rounded-lg grid place-items-center"
                        style={{ background: "rgba(0,0,0,.55)" }}
                      >
                        {c.habit.icon}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 z-[80] bg-black/93 flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
          >
            <div aria-hidden className="bleed-under bg-black/93" />
            <div className="flex-1 grid place-items-center p-4">
              <img src={active.photo_url} alt="" className="max-w-full max-h-full rounded-2xl" />
            </div>
            <div className="safe-bottom px-5 pb-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <Avatar profile={active.author} size={38} showMood={false} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold truncate">
                    {active.habit.icon} {active.habit.title}
                  </div>
                  <div className="text-[13px] text-white/45">
                    {active.author?.display_name} · {humanDateFull(active.day)}
                  </div>
                </div>
                <button onClick={() => setActive(null)} className="press text-white/40 text-[22px] px-2">×</button>
              </div>
              {active.note && (
                <div className="text-[14px] text-white/70 mt-3 leading-relaxed">{active.note}</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  );
}

function Chip({ active, onClick, label, colorKey = "mint" }) {
  return (
    <button
      onClick={onClick}
      className="press shrink-0 px-3.5 py-2 rounded-full text-[13px] font-semibold max-w-[190px] truncate"
      style={{
        background: active ? rgba(colorKey, 0.22) : "rgba(255,255,255,.06)",
        color: active ? hex(colorKey) : "rgba(255,255,255,.55)",
        border: `1px solid ${active ? rgba(colorKey, 0.4) : "transparent"}`,
      }}
    >
      {label}
    </button>
  );
}
