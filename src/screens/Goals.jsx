import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sheet from "../components/Sheet";
import { Button, Card, Empty, Field, Progress, TextInput } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { days, humanDate } from "../lib/date";
import { goalProgressDays } from "../lib/goals";

const GOAL_EMOJI = ["🎯","🏖","🍽","🎬","🛍","✈️","💍","🏆","🎂","🚗"];

export default function Goals({ open, onClose }) {
  const { goals, habits, profiles, checkins, createGoal, completeGoal, deleteGoal } = useStore();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", emoji: "🎯", reward: "", habit_id: null, target: 30 });

  const active = goals.filter((g) => !g.completed_at);
  const finished = goals.filter((g) => g.completed_at);
  const sharedHabits = useMemo(
    () => habits.filter((h) => h.kind === "shared" && h.status === "active"),
    [habits]
  );

  async function submit() {
    if (!draft.title.trim()) return;
    await createGoal({
      title: draft.title.trim(),
      emoji: draft.emoji,
      reward: draft.reward.trim() || null,
      habit_id: draft.habit_id,
      target: Number(draft.target) || 30,
    });
    setDraft({ title: "", emoji: "🎯", reward: "", habit_id: null, target: 30 });
    setAdding(false);
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
          <div className="text-[15px] font-bold">Совместные цели</div>
          <span className="w-14" />
        </div>

        <div className="text-[12.5px] text-white/35 mb-4 leading-relaxed px-1">
          Общая цель на двоих с наградой в конце. День засчитывается, только когда отметились оба.
        </div>

        {active.map((g) => (
          <GoalCard
            key={g.id}
            goal={g}
            habit={habits.find((h) => h.id === g.habit_id)}
            done={goalProgressDays(g, profiles, checkins)}
            onComplete={() => completeGoal(g)}
            onDelete={() => deleteGoal(g.id)}
          />
        ))}

        {!active.length && !adding && (
          <Empty emoji="🎯" title="Целей пока нет" subtitle="Например: 30 дней зала вдвоём → ужин в ресторане." />
        )}

        <AnimatePresence>
          {adding ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <Card className="p-4 mt-2 space-y-4">
                <Field label="Цель">
                  <TextInput
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder="30 дней зала вдвоём"
                    maxLength={60}
                  />
                </Field>
                <Field label="Награда" hint="Что будет, когда дойдёте">
                  <TextInput
                    value={draft.reward}
                    onChange={(e) => setDraft({ ...draft, reward: e.target.value })}
                    placeholder="Ужин в ресторане"
                    maxLength={60}
                  />
                </Field>
                <Field label="Иконка">
                  <div className="flex flex-wrap gap-1.5">
                    {GOAL_EMOJI.map((e) => (
                      <button
                        key={e}
                        onClick={() => setDraft({ ...draft, emoji: e })}
                        className="w-10 h-10 rounded-xl grid place-items-center text-[19px] press"
                        style={{
                          background: draft.emoji === e ? rgba("mint", 0.24) : "rgba(255,255,255,.05)",
                          border: `1px solid ${draft.emoji === e ? rgba("mint", 0.45) : "transparent"}`,
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Привычка" hint="Или считаем любые общие отметки">
                  <div className="flex flex-wrap gap-2">
                    <Pill active={!draft.habit_id} onClick={() => setDraft({ ...draft, habit_id: null })} label="Любая" />
                    {sharedHabits.map((h) => (
                      <Pill
                        key={h.id}
                        active={draft.habit_id === h.id}
                        onClick={() => setDraft({ ...draft, habit_id: h.id })}
                        label={`${h.icon} ${h.title}`}
                        colorKey={h.color}
                      />
                    ))}
                  </div>
                </Field>
                <Field label="Сколько дней">
                  <div className="flex gap-2">
                    {[7, 14, 30, 60, 100].map((v) => (
                      <button
                        key={v}
                        onClick={() => setDraft({ ...draft, target: v })}
                        className="flex-1 py-2.5 rounded-xl text-[13px] font-bold press"
                        style={{
                          background: Number(draft.target) === v ? hex("mint") : "rgba(255,255,255,.06)",
                          color: Number(draft.target) === v ? "#0A0A0E" : "rgba(255,255,255,.55)",
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setAdding(false)}>Отмена</Button>
                  <Button onClick={submit} disabled={!draft.title.trim()}>Поставить цель</Button>
                </div>
              </Card>
            </motion.div>
          ) : (
            <Button variant="ghost" className="mt-3" onClick={() => setAdding(true)}>+ Новая цель</Button>
          )}
        </AnimatePresence>

        {finished.length > 0 && (
          <div className="mt-7">
            <div className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30 mb-2.5 px-1">
              Достигнутые
            </div>
            {finished.map((g) => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/8 mb-2">
                <span className="text-[22px]">{g.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-bold truncate">{g.title}</div>
                  <div className="text-[12.5px] text-white/40 truncate">
                    {g.reward ? `${g.reward} · ` : ""}
                    {humanDate((g.completed_at || "").slice(0, 10))}
                  </div>
                </div>
                <span className="text-[16px]">🏆</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function GoalCard({ goal, habit, done, onComplete, onDelete }) {
  const color = habit?.color || "mint";
  const percent = Math.min(100, Math.round((done / goal.target) * 100));
  const reached = done >= goal.target;
  const [confirm, setConfirm] = useState(false);

  return (
    <div
      className="rounded-3xl p-4 mb-2.5"
      style={{
        background: `linear-gradient(168deg, ${rgba(color, 0.1)} 0%, ${rgba(color, 0.36)} 100%), #0F0F14`,
        border: `1px solid ${rgba(color, 0.16)}`,
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-[24px] leading-none">{goal.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold leading-snug">{goal.title}</div>
          {goal.reward && (
            <div className="text-[13px] text-white/50">Награда: {goal.reward}</div>
          )}
          {habit && <div className="text-[12.5px] text-white/35">{habit.icon} {habit.title}</div>}
        </div>
        <button
          onClick={() => { if (confirm) onDelete(); else setConfirm(true); }}
          onBlur={() => setConfirm(false)}
          className="press text-white/25 text-[15px] px-1"
        >
          {confirm ? "точно?" : "×"}
        </button>
      </div>

      <div className="flex justify-between text-[13px] font-bold mb-2">
        <span className="text-white/50">{days(done)} вдвоём</span>
        <span style={{ color: hex(color) }}>{done} / {goal.target}</span>
      </div>
      <Progress percent={percent} colorKey={color} />

      {reached && (
        <button
          onClick={onComplete}
          className="press w-full mt-3 py-2.5 rounded-xl text-[13.5px] font-bold"
          style={{ background: hex(color), color: "#0A0A0E" }}
        >
          🏆 Цель достигнута — забрать награду
        </button>
      )}
    </div>
  );
}

function Pill({ active, onClick, label, colorKey = "mint" }) {
  return (
    <button
      onClick={onClick}
      className="press px-3 py-2 rounded-xl text-[13px] font-semibold max-w-[180px] truncate"
      style={{
        background: active ? rgba(colorKey, 0.22) : "rgba(255,255,255,.05)",
        color: active ? hex(colorKey) : "rgba(255,255,255,.55)",
        border: `1px solid ${active ? rgba(colorKey, 0.4) : "transparent"}`,
      }}
    >
      {label}
    </button>
  );
}
