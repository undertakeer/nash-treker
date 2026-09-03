import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Avatar from "../components/Avatar";
import { Card, CheckCircle, Empty, Flame, Progress } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { MONTHS_GEN, WEEKDAY_LONG, isoWeekday, todayISO } from "../lib/date";
import { isScheduled, scheduleLabel, streak } from "../lib/stats";

export default function Today({ onOpenHabit, onBurst }) {
  const { habits, uid, partner, doneSetFor, freezeSetFor, toggleCheckin } = useStore();
  const today = todayISO();
  const [showDone, setShowDone] = useState(false);

  const rows = useMemo(() => {
    return habits
      .filter((h) => h.status === "active")
      .filter((h) => h.kind === "shared" || h.owner_id === uid)
      .filter((h) => isScheduled(h, today))
      .map((h) => {
        const set = doneSetFor(h.id, uid);
        return {
          habit: h,
          done: set.has(today),
          streak: streak(h, set, freezeSetFor(h.id, uid)),
          partnerDone: partner ? doneSetFor(h.id, partner.id).has(today) : false,
        };
      })
      .sort((a, b) => Number(a.done) - Number(b.done) || (a.habit.position || 0) - (b.habit.position || 0));
  }, [habits, uid, today, doneSetFor, freezeSetFor, partner]);

  const left = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done);
  const percent = rows.length ? Math.round((done.length / rows.length) * 100) : 0;

  const d = new Date();
  const dateLine = `${WEEKDAY_LONG[isoWeekday(today) - 1]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;

  function handle(r) {
    if (!r.done) onBurst?.(r.habit.color);
    toggleCheckin(r.habit);
  }

  return (
    <div className="px-4 pb-32">
      <header className="safe-top pt-2 pb-5">
        <div className="text-[12px] font-bold tracking-[0.14em] text-white/35 uppercase mb-1">
          {dateLine}
        </div>
        <h1 className="text-[29px] font-extrabold tracking-tight leading-none">Сегодня</h1>
      </header>

      {rows.length > 0 && (
        <Card className="p-4 mb-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="text-[27px] font-extrabold leading-none">
                {done.length}
                <span className="text-white/30 text-[18px]"> / {rows.length}</span>
              </div>
              <div className="text-[13px] text-white/40 mt-1">
                {percent === 100 ? "День закрыт полностью 🎉" : `Осталось ${left.length}`}
              </div>
            </div>
            <div className="text-[30px] font-extrabold" style={{ color: hex("mint") }}>
              {percent}%
            </div>
          </div>
          <Progress percent={percent} colorKey="mint" />

          {partner && (
            <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-white/6">
              <Avatar profile={partner} size={26} showMood={false} />
              <div className="text-[13px] text-white/45 flex-1 truncate">
                {partner.display_name?.split(" ")[0]}: {rows.filter((r) => r.partnerDone).length} из{" "}
                {rows.filter((r) => r.habit.kind === "shared").length} общих
              </div>
            </div>
          )}
        </Card>
      )}

      {!rows.length ? (
        <Empty
          emoji="🌤"
          title="На сегодня ничего не запланировано"
          subtitle="Все привычки либо выполнены, либо сегодня не по расписанию."
        />
      ) : (
        <>
          <AnimatePresence initial={false}>
            {left.map((r) => (
              <Line key={r.habit.id} row={r} partner={partner} onOpen={() => onOpenHabit(r.habit.id)} onToggle={() => handle(r)} />
            ))}
          </AnimatePresence>

          {left.length === 0 && (
            <div className="py-10 text-center">
              <div className="text-[40px] mb-2">🎉</div>
              <div className="text-[17px] font-bold">Всё на сегодня сделано</div>
              <div className="text-[13.5px] text-white/40 mt-1">Отдыхайте с чистой совестью.</div>
            </div>
          )}

          {done.length > 0 && (
            <div className="mt-5">
              <button
                onClick={() => setShowDone((v) => !v)}
                className="press text-[13px] font-bold tracking-[0.08em] uppercase text-white/30 px-1 mb-2.5 flex items-center gap-1.5"
              >
                Выполнено · {done.length}
                <span className="text-[11px]">{showDone ? "▲" : "▼"}</span>
              </button>
              <AnimatePresence initial={false}>
                {showDone &&
                  done.map((r) => (
                    <Line key={r.habit.id} row={r} partner={partner} onOpen={() => onOpenHabit(r.habit.id)} onToggle={() => handle(r)} />
                  ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Line({ row, partner, onOpen, onToggle }) {
  const { habit, done } = row;
  const color = habit.color || "mint";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="mb-2"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
        className="press flex items-center gap-3 px-3.5 py-3 rounded-2xl cursor-pointer"
        style={{
          background: done ? "rgba(255,255,255,.04)" : rgba(color, 0.1),
          border: `1px solid ${done ? "rgba(255,255,255,.06)" : rgba(color, 0.16)}`,
          opacity: done ? 0.6 : 1,
        }}
      >
        <span className="text-[21px] leading-none shrink-0">{habit.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold truncate">{habit.title}</div>
          <div className="text-[12.5px] text-white/40 flex items-center gap-2">
            <span className="truncate">{scheduleLabel(habit)}</span>
            {row.streak > 0 && <Flame value={row.streak} size={11} />}
          </div>
        </div>
        {habit.kind === "shared" && partner && (
          <Avatar profile={partner} size={22} showMood={false} dim={!row.partnerDone} />
        )}
        <CheckCircle done={done} colorKey={color} size={30} onClick={onToggle} />
      </div>
    </motion.div>
  );
}
