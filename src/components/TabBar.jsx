import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  IconHabits, IconMap, IconMeds, IconMoney, IconProfile, IconTasks, IconToday, IconUs,
} from "./Icons";
import { ALL_TABS } from "../lib/tabs";

const ICONS = {
  home: IconHabits,
  today: IconToday,
  tasks: IconTasks,
  meds: IconMeds,
  money: IconMoney,
  map: IconMap,
  together: IconUs,
  profile: IconProfile,
};

const LABELS = Object.fromEntries(ALL_TABS.map((t) => [t.id, t.label]));

/** Сколько вкладок помещается в ряд одновременно, остальные — прокруткой */
const VISIBLE = 4;

/** Вертикальный сдвиг плашки. Отрицательное — опускаем за нижний край экрана
    и возвращаем это место контенту. Высоту в минус CSS не пускает, это её замена.
    Под плашкой остаётся SAFE_TRIM-вычет плюс SHIFT, сейчас это ~5px: ровно
    столько, чтобы не налезть на домашний индикатор. */
const SHIFT = -15;

/** Отступ под домашним индикатором: сколько срезаем от системных 34pt */
const SAFE_TRIM = 14;

/** Минимум для телефонов без индикатора, где системный отступ нулевой */
const SAFE_MIN = 12;

export default function TabBar({ tab, onChange, ids }) {
  const scroller = useRef(null);

  // активная вкладка сама подъезжает в видимую часть
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector(`[data-tab="${tab}"]`);
    if (!box || !el) return;
    const left = Math.max(0, el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2);
    if (typeof box.scrollTo === "function") box.scrollTo({ left, behavior: "smooth" });
    else box.scrollLeft = left;
  }, [tab]);

  return (
    <nav
      className="relative shrink-0"
      style={{ background: "var(--color-ink)", marginBottom: SHIFT }}
    >
      {/* контент растворяется в фоне, а не обрывается о таб-бар */}
      <div
        aria-hidden
        className="edge-fade-bottom pointer-events-none absolute inset-x-0 bottom-full h-10"
      />
      <div
        className="px-4 pt-0.5"
        style={{
          paddingBottom: `max(calc(env(safe-area-inset-bottom) - ${SAFE_TRIM}px), ${SAFE_MIN}px)`,
        }}
      >
        <div className="rounded-[20px] bg-[#16161C] border border-white/10 p-1">
          <div ref={scroller} className="flex overflow-x-auto no-scrollbar scroll-smooth">
            {ids.map((id) => {
              const Icon = ICONS[id];
              const active = tab === id;
              return (
                <button
                  key={id}
                  data-tab={id}
                  onClick={() => onChange(id)}
                  className="relative py-1.5 rounded-[15px] flex flex-col items-center gap-[3px]"
                  style={{
                    flex: `0 0 ${100 / Math.min(VISIBLE, ids.length)}%`,
                    color: active ? "#fff" : "rgba(255,255,255,.4)",
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="tabpill"
                      className="absolute inset-0 rounded-[15px] bg-white/10"
                      transition={{ type: "spring", damping: 30, stiffness: 420 }}
                    />
                  )}
                  <Icon className="relative" />
                  <span className="relative text-[10.5px] font-semibold whitespace-nowrap">{LABELS[id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
