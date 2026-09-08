import { useMemo } from "react";
import { motion } from "framer-motion";
import Avatar from "../components/Avatar";
import { Card, Empty, Progress } from "../components/ui";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { relativeDay, todayISO, weekDays, WEEKDAY_SHORT } from "../lib/date";
import { isScheduled } from "../lib/stats";
import { activeMood, moodAge, moodLabel } from "../lib/moods";
import { goalProgressDays } from "../lib/goals";

const REACTIONS = ["❤️", "🔥", "👏", "😍"];

export default function Together({ onOpen }) {
  const { habits, profiles, checkins, uid, events, react, doneSetFor, points, photos, goals, wishlist } = useStore();
  const today = todayISO();
  const week = weekDays(today);

  const active = useMemo(() => habits.filter((h) => h.status === "active"), [habits]);
  const activeGoals = useMemo(() => goals.filter((g) => !g.completed_at), [goals]);
  const openWishes = useMemo(() => wishlist.filter((w) => w.status !== "got").length, [wishlist]);

  const perPerson = useMemo(() => {
    return profiles.map((p) => {
      const relevant = active.filter((h) => h.kind === "shared" || h.owner_id === p.id);
      let expected = 0;
      let done = 0;
      relevant.forEach((h) => {
        const set = doneSetFor(h.id, p.id);
        week.forEach((iso) => {
          if (iso > today) return;
          if (h.schedule_type === "times_per_week") return;
          if (!isScheduled(h, iso)) return;
          expected++;
          if (set.has(iso)) done++;
        });
        if (h.schedule_type === "times_per_week") {
          expected += h.target_per_week || 7;
          done += week.filter((iso) => set.has(iso)).length;
        }
      });
      const perDay = week.map((iso) => ({
        iso,
        count: relevant.filter((h) => doneSetFor(h.id, p.id).has(iso)).length,
      }));
      return {
        profile: p,
        done,
        expected: Math.max(expected, 1),
        percent: Math.min(100, Math.round((done / Math.max(expected, 1)) * 100)),
        perDay,
      };
    });
  }, [profiles, active, week, doneSetFor, today]);

  const sharedToday = useMemo(() => {
    const shared = active.filter((h) => h.kind === "shared");
    const both = shared.filter((h) => profiles.every((p) => doneSetFor(h.id, p.id).has(today)));
    return { total: shared.length, both: both.length };
  }, [active, profiles, doneSetFor, today]);

  const ranked = perPerson.slice().sort((a, b) => b.percent - a.percent);
  const leader = ranked[0];
  const tie = ranked.length > 1 && ranked.every((r) => r.percent === ranked[0].percent);
  const weekLabel =
    !leader || leader.percent === 0
      ? "неделя только началась"
      : tie
      ? "ничья"
      : `впереди ${leader.profile.display_name || "…"}`;

  const feed = useMemo(() => events.filter((e) => e.type !== "nudge" || e.actor_id === uid), [events, uid]);

  return (
    <div className="px-4 pb-8">
      <header className="safe-top pt-2 pb-5">
        <div className="text-[12px] font-bold tracking-[0.14em] text-white/35 uppercase mb-1">Вместе</div>
        <h1 className="text-[29px] font-extrabold tracking-tight leading-none">Мы</h1>
      </header>

      {/* кнопок стало больше, чем влезает в ряд — прокручиваем вбок */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
        <Tile emoji="📸" label="Галерея"  badge={photos.length}      onClick={() => onOpen("gallery")}  color="violet" />
        <Tile emoji="🎁" label="Вишлист"  badge={openWishes}         onClick={() => onOpen("wishlist")} color="pink" />
        <Tile emoji="🪙" label="Магазин"  badge={points.balance}     onClick={() => onOpen("shop")}     color="amber" />
        <Tile emoji="🎯" label="Цели"     badge={activeGoals.length} onClick={() => onOpen("goals")}    color="mint" />
        <Tile emoji="📊" label="Итоги"    onClick={() => onOpen("summary")} color="sky" />
      </div>

      {activeGoals.length > 0 && (
        <Card className="p-4 mb-3">
          <div className="text-[13px] font-semibold text-white/45 mb-3">Наша цель</div>
          {activeGoals.slice(0, 2).map((g) => {
            const doneDays = goalProgressDays(g, profiles, checkins);
            const habit = habits.find((h) => h.id === g.habit_id);
            const color = habit?.color || "mint";
            return (
              <div key={g.id} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[17px]">{g.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold truncate">{g.title}</div>
                    {g.reward && <div className="text-[12px] text-white/35 truncate">→ {g.reward}</div>}
                  </div>
                  <div className="text-[13px] font-extrabold" style={{ color: hex(color) }}>
                    {doneDays}/{g.target}
                  </div>
                </div>
                <Progress percent={Math.min(100, Math.round((doneDays / g.target) * 100))} colorKey={color} />
              </div>
            );
          })}
        </Card>
      )}

      {profiles.some((p) => activeMood(p)) && (
        <Card className="p-4 mb-3">
          <div className="text-[13px] font-semibold text-white/45 mb-3">Настроение</div>
          <div className="space-y-3">
            {profiles.map((p) => {
              const mood = activeMood(p);
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar profile={p} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-bold truncate">
                      {p.display_name || "Без имени"}
                      {p.id === uid && <span className="text-white/30 font-normal"> · вы</span>}
                    </div>
                    <div className="text-[13px] text-white/45 truncate">
                      {mood ? (
                        <>
                          {moodLabel(p)}
                          {p.mood_text ? ` — ${p.mood_text}` : ""}
                        </>
                      ) : (
                        "настроение не отмечено"
                      )}
                    </div>
                  </div>
                  {mood && <div className="text-[11.5px] text-white/25 shrink-0">{moodAge(p)}</div>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-4 mb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-bold">Эта неделя</div>
          <div className="text-[12.5px] text-white/35">
            {weekLabel}
          </div>
        </div>

        <div className="space-y-4">
          {perPerson.map((row) => (
            <div key={row.profile.id}>
              <div className="flex items-center gap-2.5 mb-2">
                <Avatar profile={row.profile} size={28} />
                <div className="flex-1 text-[14px] font-semibold truncate">
                  {row.profile.display_name || "Без имени"}
                  {row.profile.id === uid && <span className="text-white/30 font-normal"> · вы</span>}
                </div>
                <div className="text-[14px] font-extrabold" style={{ color: hex(row.profile.accent || "mint") }}>
                  {row.percent}%
                </div>
              </div>
              <Progress percent={row.percent} colorKey={row.profile.accent || "mint"} />
              <div className="flex gap-1 mt-2">
                {row.perDay.map((d) => (
                  <div key={d.iso} className="flex-1 text-center">
                    <div
                      className="h-7 rounded-lg grid place-items-center text-[11px] font-bold"
                      style={{
                        background: d.count
                          ? rgba(row.profile.accent || "mint", Math.min(1, 0.25 + d.count * 0.25))
                          : "rgba(255,255,255,.05)",
                        color: d.count ? "#fff" : "rgba(255,255,255,.25)",
                        opacity: d.iso > today ? 0.4 : 1,
                      }}
                    >
                      {d.count || ""}
                    </div>
                    <div className="text-[10px] text-white/25 mt-1">{WEEKDAY_SHORT[week.indexOf(d.iso)]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {sharedToday.total > 0 && (
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="text-[26px]">{sharedToday.both === sharedToday.total ? "🫶" : "⏳"}</div>
            <div className="flex-1">
              <div className="text-[15px] font-bold">
                {sharedToday.both} из {sharedToday.total} общих закрыто вдвоём
              </div>
              <div className="text-[13px] text-white/40">
                {sharedToday.both === sharedToday.total
                  ? "Идеальный день. Так держать."
                  : "День ещё не окончен."}
              </div>
            </div>
          </div>
        </Card>
      )}

      <h2 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30 mb-2.5 px-1">Лента</h2>

      {!feed.length ? (
        <Card>
          <Empty emoji="📭" title="Пока тихо" subtitle="Здесь появятся отметки, достижения и завершённые привычки." />
        </Card>
      ) : (
        <div className="space-y-2">
          {feed.map((e) => {
            const actor = profiles.find((p) => p.id === e.actor_id);
            const female = (actor?.display_name || "").match(/(а|я)$/i);
            const label =
              e.type === "checkin" ? (female ? "выполнила" : "выполнил")
              : e.type === "completed" ? (female ? "завершила привычку" : "завершил привычку")
              : e.type === "nudge" ? "подтолкнул(а)"
              : "получил(а) достижение";
            const mineReactions = e.reactions || [];
            return (
              <motion.div
                key={e.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white/5 border border-white/8 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar profile={actor} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] leading-snug">
                      <span className="font-bold">{actor?.display_name || "Кто-то"}</span>{" "}
                      <span className="text-white/45">{label}</span>{" "}
                      <span className="font-semibold">
                        {e.payload?.icon} {e.payload?.title}
                      </span>
                    </div>
                    <div className="text-[12px] text-white/25">
                      {relativeDay((e.created_at || "").slice(0, 10))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-2 pl-[46px]">
                  {REACTIONS.map((emoji) => {
                    const list = mineReactions.filter((r) => r.emoji === emoji);
                    const active = list.some((r) => r.user_id === uid);
                    if (!list.length && e.actor_id === uid) return null;
                    return (
                      <button
                        key={emoji}
                        onClick={() => react(e.id, emoji)}
                        className="press px-2 py-1 rounded-full text-[12.5px] flex items-center gap-1"
                        style={{
                          background: active ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.05)",
                          border: `1px solid ${active ? "rgba(255,255,255,.2)" : "transparent"}`,
                        }}
                      >
                        {emoji}
                        {list.length > 0 && <span className="font-bold">{list.length}</span>}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({ emoji, label, badge, onClick, color = "mint" }) {
  return (
    <button
      onClick={onClick}
      className="press shrink-0 w-[84px] rounded-2xl py-3 flex flex-col items-center gap-1"
      style={{ background: rgba(color, 0.12), border: `1px solid ${rgba(color, 0.16)}` }}
    >
      <span className="text-[20px] leading-none">{emoji}</span>
      <span className="text-[11.5px] font-semibold text-white/60">{label}</span>
      {badge !== undefined && badge !== null && (
        <span className="text-[11px] font-extrabold" style={{ color: hex(color) }}>{badge}</span>
      )}
    </button>
  );
}
