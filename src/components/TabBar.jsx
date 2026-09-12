import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  IconHabits, IconMap, IconMeds, IconMoney, IconProfile, IconTasks, IconToday, IconUs,
} from "./Icons";
import { ALL_TABS } from "../lib/tabs";
import { useStore } from "../lib/store";

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

export default function TabBar({ tab, onChange, ids }) {
  const scroller = useRef(null);
  // подгоняется в профиле: у разных iPhone край экрана оказывается в разных местах
  const { tabGap } = useStore();

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
      // положительный зазор — отступ внутри окна, отрицательный выдавливает
      // плашку за край: только так она опускается ниже, но режет подписи
      style={{ background: "var(--color-ink)", marginBottom: Math.min(0, tabGap) }}
    >
      {/* контент растворяется в фоне, а не обрывается о таб-бар */}
      <div
        aria-hidden
        className="edge-fade-bottom pointer-events-none absolute inset-x-0 bottom-full h-10"
      />
      <div
        className="px-4 pt-0.5"
        style={{ paddingBottom: Math.max(0, tabGap) }}
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
