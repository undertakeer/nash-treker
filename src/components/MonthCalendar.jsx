import { motion } from "framer-motion";
import { MONTHS, monthGrid, todayISO } from "../lib/date";
import { hex, rgba } from "../lib/theme";

export default function MonthCalendar({
  year, month, doneSet, partnerSet, colorKey = "mint", onPick, onShift, canEdit = true,
}) {
  const cells = monthGrid(year, month);
  const today = todayISO();

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => onShift(-1)} className="press w-9 h-9 grid place-items-center rounded-full bg-white/6 text-white/60">
          ‹
        </button>
        <div className="text-[15px] font-bold">
          {MONTHS[month]} {year !== new Date().getFullYear() ? year : ""}
        </div>
        <button
          onClick={() => onShift(1)}
          disabled={year > new Date().getFullYear() || (year === new Date().getFullYear() && month >= new Date().getMonth())}
          className="press w-9 h-9 grid place-items-center rounded-full bg-white/6 text-white/60 disabled:opacity-25"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <div key={d} className="text-center text-[12px] font-semibold text-white/28">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c) => {
          const mine = doneSet.has(c.iso);
          const theirs = partnerSet?.has(c.iso);
          const future = c.iso > today;
          const both = mine && theirs;
          const some = mine || theirs;

          return (
            <motion.button
              key={c.iso}
              whileTap={canEdit && !future && c.inMonth ? { scale: 0.88 } : undefined}
              onClick={() => canEdit && !future && c.inMonth && onPick?.(c.iso)}
              disabled={!c.inMonth || future || !canEdit}
              className="relative aspect-square rounded-xl grid place-items-center text-[14px] font-semibold"
              style={{
                background: !c.inMonth
                  ? "transparent"
                  : both || (mine && !partnerSet)
                  ? hex(colorKey)
                  : some
                  ? rgba(colorKey, 0.34)
                  : "rgba(255,255,255,.05)",
                color: !c.inMonth
                  ? "transparent"
                  : both || (mine && !partnerSet)
                  ? "#0A0A0E"
                  : future
                  ? "rgba(255,255,255,.22)"
                  : "rgba(255,255,255,.7)",
                opacity: future ? 0.5 : 1,
              }}
            >
              {c.day}
              {c.iso === today && (
                <span
                  className="absolute bottom-1 w-1 h-1 rounded-full"
                  style={{ background: both || mine ? "#0A0A0E" : hex(colorKey) }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
