import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sheet from "../components/Sheet";
import Avatar from "../components/Avatar";
import MonthCalendar from "../components/MonthCalendar";
import StatTile from "../components/StatTile";
import DayCard from "../components/DayCard";
import { Button, CheckCircle, Progress, Row } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { days, humanDateFull, todayISO } from "../lib/date";
import { bestStreak, discipline, goalProgress, scheduleLabel, streak } from "../lib/stats";

export default function HabitDetail({ habitId, onClose, onEdit, onBurst }) {
  const {
    habits, profiles, uid, doneSetFor, freezeSetFor, toggleCheckin, nudge,
    completeHabit, archiveHabit, restoreHabit, deleteHabit, updateHabit,
  } = useStore();

  const habit = habits.find((h) => h.id === habitId);
  const today = todayISO();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [menu, setMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState(uid);

  const participants = useMemo(() => {
    if (!habit) return [];
    return habit.kind === "shared" ? profiles : profiles.filter((p) => p.id === habit.owner_id);
  }, [habit, profiles]);

  const sets = useMemo(() => {
    const out = {};
    if (!habit) return out;
    participants.forEach((p) => { out[p.id] = doneSetFor(habit.id, p.id); });
    return out;
  }, [participants, habit, doneSetFor]);

  const freezeSets = useMemo(() => {
    const out = {};
    if (!habit) return out;
    participants.forEach((p) => { out[p.id] = freezeSetFor(habit.id, p.id); });
    return out;
  }, [participants, habit, freezeSetFor]);

  const combined = useMemo(() => {
    if (participants.length < 2) return null;
    const [a, b] = participants;
    const s = new Set();
    sets[a.id]?.forEach((iso) => { if (sets[b.id]?.has(iso)) s.add(iso); });
    return s;
  }, [participants, sets]);

  // личную привычку партнёра открываем сразу на его календаре
  useEffect(() => {
    if (!habit) return;
    setViewing(habit.kind === "personal" ? habit.owner_id : uid);
  }, [habit?.id, habit?.kind, habit?.owner_id, uid]);

  if (!habit) return null;

  const color = habit.color || "mint";
  const canCheck = habit.kind === "shared" || habit.owner_id === uid;
  const iDid = sets[uid]?.has(today) || false;
  const viewSet = sets[viewing] || new Set();
  const partnerOfView = participants.find((p) => p.id !== viewing);
  const since = (habit.created_at || today).slice(0, 10);

  const mainSet = combined || sets[participants[0]?.id] || new Set();
  const mainFreeze = combined
    ? new Set([...(freezeSets[participants[0]?.id] || []), ...(freezeSets[participants[1]?.id] || [])])
    : freezeSets[participants[0]?.id] || new Set();
  const mainStreak = streak(habit, mainSet, mainFreeze);
  const mainDiscipline = discipline(habit, mainSet, since, mainFreeze);
  const record = bestStreak(habit, mainSet, since, mainFreeze);
  const goal = goalProgress(habit, (sets[uid] || new Set()).size);

  function handleCheck() {
    if (!canCheck) return;
    if (!iDid) onBurst?.(color);
    toggleCheckin(habit);
  }

  function handleDayPick(iso) {
    if (!canCheck) return;
    if (!sets[uid]?.has(iso)) onBurst?.(color);
    toggleCheckin(habit, iso);
  }

  function shiftMonth(delta) {
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  return (
    <Sheet open={Boolean(habitId)} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-2">
          <button
            onClick={() => setMenu((v) => !v)}
            className="press w-9 h-9 rounded-full bg-white/8 grid place-items-center text-[17px] leading-none pb-1"
            aria-label="Меню"
          >
            •••
          </button>
          <CheckCircle done={iDid} onClick={handleCheck} colorKey={color} size={34} disabled={!canCheck} />
        </div>

        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-white/6 border border-white/8 divide-y divide-white/6 my-2">
                <Row icon="✏️" title="Изменить" onClick={() => { setMenu(false); onEdit(habit); }} />
                <Row
                  icon={habit.pinned ? "📌" : "📍"}
                  title={habit.pinned ? "Открепить" : "Закрепить сверху"}
                  onClick={() => { updateHabit(habit.id, { pinned: !habit.pinned }); setMenu(false); }}
                />
                {habit.status === "active" ? (
                  <>
                    <Row icon="🏆" title="Завершить" subtitle="Уйдёт в историю с результатом"
                      onClick={() => { completeHabit(habit); setMenu(false); onClose(); }} />
                    <Row icon="📦" title="В архив" subtitle="Спрятать, но не удалять"
                      onClick={() => { archiveHabit(habit); setMenu(false); onClose(); }} />
                  </>
                ) : (
                  <Row icon="▶️" title="Вернуть в активные"
                    onClick={() => { restoreHabit(habit); setMenu(false); }} />
                )}
                <Row
                  icon="🗑"
                  danger
                  title={confirmDelete ? "Точно удалить? Нажмите ещё раз" : "Удалить"}
                  subtitle={confirmDelete ? "Вся история отметок пропадёт" : undefined}
                  onClick={() => {
                    if (confirmDelete) { deleteHabit(habit.id); onClose(); }
                    else setConfirmDelete(true);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center pt-3 pb-6">
          <div className="text-[46px] leading-none mb-3">{habit.icon}</div>
          <h2 className="text-[24px] font-extrabold tracking-tight leading-tight">{habit.title}</h2>
          <div className="text-[15px] text-white/40 font-medium mt-0.5">{scheduleLabel(habit)}</div>
          {habit.kind === "personal" && (
            <div
              className="inline-block mt-2 px-2.5 py-1 rounded-full text-[11.5px] font-bold"
              style={{ background: rgba(color, 0.16), color: hex(color) }}
            >
              личная{habit.owner_id !== uid ? " — только просмотр" : ""}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 mb-6">
          <StatTile value={days(mainStreak)} label="Подряд" glyph="🔥" colorKey={color} />
          <StatTile value={`${mainDiscipline}%`} label="Дисциплина" glyph="✳️" colorKey={color} />
        </div>

        {goal && (
          <div className="mb-6">
            <div className="flex justify-between text-[13px] font-semibold mb-2">
              <span className="text-white/50">Цель: {days(goal.total)}</span>
              <span style={{ color: hex(color) }}>{goal.done} / {goal.total}</span>
            </div>
            <Progress percent={goal.percent} colorKey={color} />
            {goal.reached && habit.status === "active" && (
              <div className="mt-3">
                <Button colorKey={color} onClick={() => { completeHabit(habit); onClose(); }}>
                  🏆 Цель достигнута — завершить
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="mb-6">
          {participants.length > 1 && (
            <div className="flex gap-2 mb-3">
              {participants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setViewing(p.id)}
                  className="flex-1 py-2 rounded-xl text-[13px] font-bold press flex items-center justify-center gap-1.5"
                  style={{
                    background: viewing === p.id ? rgba(color, 0.2) : "rgba(255,255,255,.05)",
                    border: `1px solid ${viewing === p.id ? rgba(color, 0.38) : "transparent"}`,
                  }}
                >
                  <Avatar profile={p} size={18} />
                  {p.id === uid ? "Я" : p.display_name?.split(" ")[0] || "Партнёр"}
                </button>
              ))}
            </div>
          )}
          <MonthCalendar
            year={ym.y}
            month={ym.m}
            doneSet={viewSet}
            partnerSet={null}
            freezeSet={freezeSets[viewing]}
            colorKey={color}
            onShift={shiftMonth}
            onPick={handleDayPick}
            canEdit={canCheck && viewing === uid}
          />
          {canCheck && viewing === uid && (
            <div className="text-[12px] text-white/25 text-center mt-3">
              Тапните по дню, чтобы отметить задним числом
            </div>
          )}
        </div>

        <DayCard habit={habit} day={today} colorKey={color} canEdit={canCheck} />

        <div className="rounded-2xl bg-white/5 border border-white/8 divide-y divide-white/6 mb-6">
          {participants.map((p) => {
            const s = sets[p.id] || new Set();
            const didToday = s.has(today);
            const isMe = p.id === uid;
            const female = (p.display_name || "").match(/(а|я)$/i);
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                <Avatar profile={p} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold truncate">
                    {p.display_name || (isMe ? "Я" : "Партнёр")}
                  </div>
                  <div className="text-[13px] text-white/40">
                    {didToday
                      ? female ? "Выполнила сегодня" : "Выполнил сегодня"
                      : female ? "Ещё не выполнила" : "Ещё не выполнил"}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[14px] font-bold" style={{ color: hex(color) }}>
                    🔥 {streak(habit, s, freezeSets[p.id])}
                  </span>
                  {!isMe && !didToday && habit.status === "active" && (
                    <button
                      onClick={() => nudge(habit, p.id)}
                      className="press px-3 py-1.5 rounded-full text-[12.5px] font-bold"
                      style={{ background: rgba(color, 0.18), color: hex(color) }}
                    >
                      👋 Подтолкнуть
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[12.5px] text-white/25 space-y-1 px-1">
          <div>Начата {humanDateFull(since)}</div>
          <div>Рекорд: {days(record)} подряд</div>
          <div>Всего отметок: {(sets[uid] || new Set()).size}{partnerOfView ? ` · у партнёра ${(sets[partnerOfView.id] || new Set()).size}` : ""}</div>
        </div>
      </div>
    </Sheet>
  );
}
