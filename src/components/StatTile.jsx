import { rgba } from "../lib/theme";

export default function StatTile({ value, label, glyph, colorKey = "mint" }) {
  return (
    <div
      className="flex-1 rounded-2xl px-4 py-3.5 flex items-center justify-between gap-2"
      style={{ background: rgba(colorKey, 0.12), border: `1px solid ${rgba(colorKey, 0.16)}` }}
    >
      <div className="min-w-0">
        <div className="text-[20px] font-extrabold leading-tight truncate">{value}</div>
        <div className="text-[13px] text-white/45 font-medium truncate">{label}</div>
      </div>
      <div className="text-[20px] opacity-80 shrink-0">{glyph}</div>
    </div>
  );
}
