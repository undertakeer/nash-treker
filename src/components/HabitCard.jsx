import { motion } from "framer-motion";
import { AvatarStack } from "./Avatar";
import WeekStrip from "./WeekStrip";
import { CheckCircle, Flame } from "./ui";
import { cardStyle, hex } from "../lib/theme";
import { isScheduled, scheduleLabel, streak } from "../lib/stats";
import { todayISO, weekDays } from "../lib/date";

export default function HabitCard({
  habit, featured = false, participants, doneSets, freezeSets = {}, myId, canCheck, onOpen, onToggle,
}) {
  const today = todayISO();
  const color = habit.color || "mint";

  const marks = weekDays(today).map((iso) => {
    const total = participants.length || 1;
    const hits = participants.filter((p) => doneSets[p.id]?.has(iso)).length;
    return {
      iso,
      ratio: hits / total,
      scheduled: isScheduled(habit, iso),
      future: iso > today,
      isToday: iso === today,
    };
  });

  // Стрик: у общей привычки — совместный (день засчитан, когда отметились оба)
  const combinedSet = new Set();
  if (participants.length > 1) {
    const [a, b] = participants;
    doneSets[a.id]?.forEach((iso) => { if (doneSets[b.id]?.has(iso)) combinedSet.add(iso); });
  }
  const streakSet = participants.length > 1 ? combinedSet : doneSets[participants[0]?.id] || new Set();
  const freezeSet =
    participants.length > 1
      ? new Set(participants.flatMap((p) => [...(freezeSets[p.id] || [])]))
      : freezeSets[participants[0]?.id] || new Set();
  const value = streak(habit, streakSet, freezeSet);

  const iDid = myId ? doneSets[myId]?.has(today) : false;
  const doneIds = participants.filter((p) => doneSets[p.id]?.has(today)).map((p) => p.id);

  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(); } }}
      whileTap={{ scale: 0.985 }}
      className="relative w-full h-full flex flex-col text-left rounded-[26px] overflow-hidden press cursor-pointer"
      style={{
        ...cardStyle(color, { strong: featured }),
        padding: featured ? 18 : 15,
        minHeight: featured ? 168 : 134,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span style={{ fontSize: featured ? 25 : 21 }} className="leading-none">{habit.icon}</span>
        <div className="flex items-center gap-2">
          <AvatarStack profiles={participants} size={featured ? 25 : 22} doneIds={doneIds} />
          <CheckCircle
            done={iDid}
            colorKey={color}
            size={featured ? 33 : 29}
            disabled={!canCheck}
            onClick={onToggle}
          />
        </div>
      </div>

      {/* прижимаем текст и полоску к низу — тогда в сетке карточки выглядят ровно,
          как бы ни переносилось название */}
      <div className="mt-auto" style={{ paddingTop: featured ? 40 : 26 }}>
        <div
          className="font-bold leading-snug line-clamp-2"
          style={{ fontSize: featured ? 19 : 15.5, letterSpacing: "-0.01em" }}
        >
          {habit.title}
        </div>
        <div className="text-white/45 font-medium truncate" style={{ fontSize: featured ? 14 : 12.5 }}>
          {scheduleLabel(habit)}
        </div>
      </div>

      <div className="flex items-center gap-2.5 mt-3">
        <div className="flex-1 min-w-0">
          <WeekStrip marks={marks} colorKey={color} height={featured ? 9 : 8} gap={featured ? 6 : 4} />
        </div>
        {value > 0 && <Flame value={value} size={featured ? 13 : 12} className="shrink-0" />}
      </div>

      {habit.status !== "active" && (
        <div
          className="absolute top-0 right-0 px-2.5 py-1 text-[11px] font-bold rounded-bl-xl"
          style={{ background: hex(color), color: "#0A0A0E" }}
        >
          {habit.status === "completed" ? "завершена" : "архив"}
        </div>
      )}
    </motion.div>
  );
}
