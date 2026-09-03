import { useMemo, useState } from "react";
import Sheet from "../components/Sheet";
import Avatar from "../components/Avatar";
import { Card } from "../components/ui";
import { useStore, POINTS_PER_CHECKIN } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { MONTHS } from "../lib/date";

export default function MonthSummary({ open, onClose }) {
  const { checkins, habits, profiles, uid, achievements } = useStore();
  const now = new Date();
  const [shift, setShift] = useState(0);

  const cursor = new Date(now.getFullYear(), now.getMonth() - shift, 1);
  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;

  const data = useMemo(() => {
    const rows = checkins.filter((c) => c.day.startsWith(monthKey));
    const perUser = profiles.map((p) => ({
      profile: p,
      count: rows.filter((c) => c.user_id === p.id).length,
    }));

    const perHabit = new Map();
    rows.forEach((c) => perHabit.set(c.habit_id, (perHabit.get(c.habit_id) || 0) + 1));
    const topId = [...perHabit.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const jointDays = new Set();
    const byDay = new Map();
    rows.forEach((c) => {
      if (!byDay.has(c.day)) byDay.set(c.day, new Set());
      byDay.get(c.day).add(c.user_id);
    });
    byDay.forEach((users, day) => {
      if (users.size >= Math.max(1, profiles.length)) jointDays.add(day);
    });

    return {
      total: rows.length,
      perUser,
      top: habits.find((h) => h.id === topId),
      topCount: topId ? perHabit.get(topId) : 0,
      photos: rows.filter((c) => c.photo_url).length,
      activeDays: byDay.size,
      jointDays: jointDays.size,
      badges: achievements.filter((a) => (a.earned_at || "").startsWith(monthKey)).length,
      myPoints: rows.filter((c) => c.user_id === uid).length * POINTS_PER_CHECKIN,
    };
  }, [checkins, monthKey, profiles, habits, achievements, uid]);

  const maxShift = 11;

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Закрыть</button>
          <div className="text-[15px] font-bold">Итоги месяца</div>
          <span className="w-14" />
        </div>

        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => setShift((s) => Math.min(maxShift, s + 1))}
            disabled={shift >= maxShift}
            className="press w-9 h-9 grid place-items-center rounded-full bg-white/6 text-white/60 disabled:opacity-25"
          >
            ‹
          </button>
          <div className="text-[19px] font-extrabold">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <button
            onClick={() => setShift((s) => Math.max(0, s - 1))}
            disabled={shift === 0}
            className="press w-9 h-9 grid place-items-center rounded-full bg-white/6 text-white/60 disabled:opacity-25"
          >
            ›
          </button>
        </div>

        <div
          className="rounded-3xl p-6 mb-4 text-center"
          style={{
            background: `linear-gradient(168deg, ${rgba("mint", 0.14)} 0%, ${rgba("mint", 0.44)} 100%), #0F0F14`,
            border: `1px solid ${rgba("mint", 0.18)}`,
          }}
        >
          <div className="text-[54px] font-extrabold leading-none">{data.total}</div>
          <div className="text-[14px] text-white/55 mt-1.5">отметок за месяц</div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Tile value={data.activeDays} label="Активных дней" glyph="📆" color="sky" />
          <Tile value={data.jointDays} label="Дней вдвоём" glyph="🫶" color="pink" />
          <Tile value={data.photos} label="Фотографий" glyph="📸" color="violet" />
          <Tile value={data.badges} label="Достижений" glyph="🏅" color="amber" />
        </div>

        {data.top && (
          <Card className="p-4 mb-4">
            <div className="text-[13px] font-semibold text-white/45 mb-2">Привычка месяца</div>
            <div className="flex items-center gap-3">
              <span className="text-[28px]">{data.top.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold truncate">{data.top.title}</div>
                <div className="text-[13px] text-white/40">{data.topCount} отметок</div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4 mb-4">
          <div className="text-[13px] font-semibold text-white/45 mb-3">Кто сколько</div>
          <div className="space-y-3">
            {data.perUser.map((r) => {
              const max = Math.max(1, ...data.perUser.map((x) => x.count));
              return (
                <div key={r.profile.id} className="flex items-center gap-3">
                  <Avatar profile={r.profile} size={30} showMood={false} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold truncate mb-1">
                      {r.profile.display_name || "Без имени"}
                    </div>
                    <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(r.count / max) * 100}%`,
                          background: hex(r.profile.accent || "mint"),
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-[15px] font-extrabold w-9 text-right">{r.count}</div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="text-[12.5px] text-white/30 text-center leading-relaxed">
          За этот месяц вы заработали 🪙 {data.myPoints} баллов
        </div>
      </div>
    </Sheet>
  );
}

function Tile({ value, label, glyph, color }) {
  return (
    <div
      className="rounded-2xl px-4 py-3.5"
      style={{ background: rgba(color, 0.1), border: `1px solid ${rgba(color, 0.15)}` }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[24px] font-extrabold leading-none">{value}</div>
        <div className="text-[16px] opacity-75">{glyph}</div>
      </div>
      <div className="text-[12.5px] text-white/40 font-medium mt-1.5">{label}</div>
    </div>
  );
}
