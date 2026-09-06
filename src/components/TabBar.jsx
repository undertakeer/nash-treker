import { motion } from "framer-motion";

const TABS = [
  { id: "home", label: "Привычки", glyph: "◎" },
  { id: "today", label: "Сегодня", glyph: "✓" },
  { id: "tasks", label: "Задачи", glyph: "☑" },
  { id: "together", label: "Мы", glyph: "❤" },
  { id: "profile", label: "Профиль", glyph: "☺" },
];

export default function TabBar({ tab, onChange }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      {/* контент растворяется в фоне, а не обрывается о нижний край экрана */}
      <div aria-hidden className="edge-fade-bottom h-14 -mb-px" />
      <div style={{ background: "var(--color-ink)" }}>
        <div className="max-w-[520px] mx-auto px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-1">
          <div className="pointer-events-auto flex rounded-[22px] bg-[#16161C] border border-white/10 p-1.5">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onChange(t.id)}
                  className="relative flex-1 min-w-0 py-2 rounded-[16px] flex flex-col items-center gap-0.5"
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
                  <span className="relative text-[10.5px] font-semibold">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
