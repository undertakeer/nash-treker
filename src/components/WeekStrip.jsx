import { hex, rgba } from "../lib/theme";

/** marks: [{ iso, ratio 0..1, scheduled, future, isToday }] */
export default function WeekStrip({ marks, colorKey = "mint", height = 9, gap = 5 }) {
  return (
    <div className="flex w-full" style={{ gap }}>
      {marks.map((m) => {
        const bg =
          m.ratio >= 1 ? hex(colorKey)
          : m.ratio > 0 ? rgba(colorKey, 0.55)
          : m.scheduled ? "rgba(255,255,255,.13)"
          : "rgba(255,255,255,.06)";
        return (
          <div
            key={m.iso}
            className="flex-1 rounded-full transition-colors"
            style={{
              height,
              background: bg,
              opacity: m.future ? 0.4 : 1,
              boxShadow: m.isToday && m.ratio === 0 ? `inset 0 0 0 1.5px ${rgba(colorKey, 0.55)}` : "none",
            }}
          />
        );
      })}
    </div>
  );
}
