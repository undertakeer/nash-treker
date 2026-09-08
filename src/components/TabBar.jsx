import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const TABS = [
  { id: "home", label: "Привычки", glyph: "◎" },
  { id: "today", label: "Сегодня", glyph: "✓" },
  { id: "tasks", label: "Задачи", glyph: "☑" },
  { id: "map", label: "Карта", glyph: "🗺" },
  { id: "together", label: "Мы", glyph: "❤" },
  { id: "profile", label: "Профиль", glyph: "☺" },
];

export default function TabBar({ tab, onChange }) {
  const scroller = useRef(null);

  // подвозим активную вкладку в видимую часть — вкладок больше, чем влезает
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector(`[data-tab="${tab}"]`);
    if (!box || !el) return;
    const left = Math.max(0, el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2);
    if (typeof box.scrollTo === "function") box.scrollTo({ left, behavior: "smooth" });
    else box.scrollLeft = left;
  }, [tab]);

  return (
    <nav className="relative shrink-0" style={{ background: "var(--color-ink)" }}>
      {/* контент растворяется в фоне, а не обрывается о таб-бар */}
      <div
        aria-hidden
        className="edge-fade-bottom pointer-events-none absolute inset-x-0 bottom-full h-10"
      />
      <div className="px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-1">
        <div className="rounded-[22px] bg-[#16161C] border border-white/10 p-1.5">
          <div ref={scroller} className="flex overflow-x-auto no-scrollbar scroll-smooth">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  data-tab={t.id}
                  onClick={() => onChange(t.id)}
                  className="relative shrink-0 grow basis-0 min-w-[64px] py-2 rounded-[16px] flex flex-col items-center gap-0.5"
                  style={{ color: active ? "#fff" : "rgba(255,255,255,.38)" }}
                >
                  {active && (
                    <motion.span
                      layoutId="tabpill"
                      className="absolute inset-0 rounded-[16px] bg-white/10"
                      transition={{ type: "spring", damping: 30, stiffness: 420 }}
                    />
                  )}
                  <span className="relative text-[15px] leading-none">{t.glyph}</span>
                  <span className="relative text-[10.5px] font-semibold whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
