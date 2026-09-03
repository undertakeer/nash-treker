import { useEffect, useMemo, useState } from "react";
import Avatar from "../components/Avatar";
import { Button, Card, Empty, Row } from "../components/ui";
import MoodPicker from "../components/MoodPicker";
import Password from "./Password";
import EditProfile from "./EditProfile";
import { emailToLogin } from "../lib/auth";
import { useStore } from "../lib/store";
import { hex, rgba } from "../lib/theme";
import { addDays, days, humanDateFull, isoWeekday, todayISO } from "../lib/date";
import { bestStreak, streak } from "../lib/stats";

const BADGES = {
  streak_7:   { emoji: "🌱", title: "7 дней подряд" },
  streak_30:  { emoji: "🔥", title: "30 дней подряд" },
  streak_100: { emoji: "💎", title: "100 дней подряд" },
  streak_365: { emoji: "👑", title: "Год подряд" },
};

export default function Profile({ onOpenNotifications, onOpen }) {
  const {
    me, uid, habits, checkins, achievements, doneSetFor, freezeSetFor,
    updateProfile, signOut, showToast, restoreHabit, points, photos, session, loadStorageUsage,
  } = useStore();
  const [usage, setUsage] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const mine = useMemo(() => checkins.filter((c) => c.user_id === uid), [checkins, uid]);

  const stats = useMemo(() => {
    const visible = habits.filter((h) => h.kind === "shared" || h.owner_id === uid);
    const active = visible.filter((h) => h.status === "active");
    const completed = visible.filter((h) => h.status === "completed");
    const archived = visible.filter((h) => h.status === "archived");

    let best = 0;
    let currentTotal = 0;
    active.forEach((h) => {
      const s = doneSetFor(h.id, uid);
      const fz = freezeSetFor(h.id, uid);
      best = Math.max(best, bestStreak(h, s, (h.created_at || todayISO()).slice(0, 10), fz));
      currentTotal = Math.max(currentTotal, streak(h, s, fz));
    });

    const firstDay = mine.reduce((min, c) => (!min || c.day < min ? c.day : min), null);
    const daysWithUs = firstDay
      ? Math.max(1, Math.round((new Date(todayISO()) - new Date(firstDay)) / 86400000) + 1)
      : 1;

    return {
      total: visible.length,
      active: active.length,
      completed,
      archived,
      checkins: mine.length,
      best,
      currentTotal,
      daysWithUs,
    };
  }, [habits, uid, doneSetFor, freezeSetFor, mine]);

  const [heatYear, setHeatYear] = useState(new Date().getFullYear());

  const heat = useMemo(() => {
    const counts = new Map();
    mine.forEach((c) => counts.set(c.day, (counts.get(c.day) || 0) + 1));
    const out = [];
    const start = `${heatYear}-01-01`;
    const end = heatYear === new Date().getFullYear() ? todayISO() : `${heatYear}-12-31`;
    let iso = start;
    // выравниваем начало на понедельник, чтобы сетка была ровной
    while (isoWeekday(iso) !== 1) iso = addDays(iso, -1);
    while (iso <= end) {
      out.push({ iso, count: counts.get(iso) || 0, inYear: iso.startsWith(String(heatYear)) });
      iso = addDays(iso, 1);
    }
    return out;
  }, [mine, heatYear]);

  const years = useMemo(() => {
    const first = mine.reduce((min, c) => (!min || c.day < min ? c.day : min), null);
    const from = first ? Number(first.slice(0, 4)) : new Date().getFullYear();
    const to = new Date().getFullYear();
    return Array.from({ length: to - from + 1 }, (_, i) => to - i);
  }, [mine]);

  useEffect(() => {
    let alive = true;
    loadStorageUsage().then((u) => { if (alive) setUsage(u); });
    return () => { alive = false; };
  }, [loadStorageUsage, photos.length]);

  const accent = me?.accent || "mint";

  return (
    <div className="px-4 pb-32">
      <header className="safe-top pt-2 pb-5">
        <h1 className="text-[29px] font-extrabold tracking-tight">Профиль</h1>
      </header>

      <div className="flex items-center gap-4 mb-7">
        <button onClick={() => setEditOpen(true)} className="press relative shrink-0">
          <Avatar profile={me} size={78} ring />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full grid place-items-center text-[13px]"
            style={{ background: hex(accent), color: "#0A0A0E", boxShadow: "0 0 0 3px #08080B" }}
          >
            ✏️
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[21px] font-extrabold truncate">{me?.display_name || "Без имени"}</div>
          <div className="text-[13.5px] text-white/40">
            {days(stats.daysWithUs)} в трекере · {stats.checkins} отметок
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="press text-[13px] font-semibold mt-1"
            style={{ color: hex(accent) }}
          >
            Редактировать профиль
          </button>
        </div>
      </div>

      <Card className="p-4 mb-3">
        <MoodPicker profile={me} accent={accent} onChange={updateProfile} />
      </Card>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <Stat value={stats.active} label="Активных" glyph="⚡️" accent={accent} />
        <Stat value={stats.completed.length} label="Завершено" glyph="🏆" accent={accent} />
        <Stat value={stats.currentTotal} label="Лучший стрик сейчас" glyph="🔥" accent={accent} />
        <Stat value={stats.best} label="Рекорд за всё время" glyph="💎" accent={accent} />
      </div>

      <Card className="p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold text-white/45">Год в квадратиках</div>
          {years.length > 1 && (
            <div className="flex gap-1">
              {years.slice(0, 4).map((y) => (
                <button
                  key={y}
                  onClick={() => setHeatYear(y)}
                  className="press px-2 py-0.5 rounded-lg text-[12px] font-bold"
                  style={{
                    background: heatYear === y ? rgba(accent, 0.24) : "rgba(255,255,255,.05)",
                    color: heatYear === y ? hex(accent) : "rgba(255,255,255,.4)",
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <div
            className="grid grid-flow-col gap-[3px]"
            style={{ gridTemplateRows: "repeat(7, 10px)" }}
          >
            {heat.map((d) => (
              <span
                key={d.iso}
                title={`${d.iso}: ${d.count}`}
                className="rounded-[2.5px]"
                style={{
                  width: 10,
                  height: 10,
                  background: !d.inYear
                    ? "transparent"
                    : d.count
                    ? rgba(accent, Math.min(1, 0.35 + d.count * 0.22))
                    : "rgba(255,255,255,.06)",
                }}
              />
            ))}
          </div>
        </div>
        <div className="text-[12px] text-white/25 mt-2.5">
          {mine.filter((c) => c.day.startsWith(String(heatYear))).length} отметок за {heatYear}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <Quick emoji="🪙" value={points.balance} label="Баллы" onClick={() => onOpen("shop")} color="amber" />
        <Quick emoji="📸" value={photos.length} label="Фото" onClick={() => onOpen("gallery")} color="violet" />
        <Quick emoji="📊" value="" label="Итоги" onClick={() => onOpen("summary")} color="sky" />
      </div>

      {usage && (
        <Section title="Место в облаке">
          <Card className="p-4">
            <div className="flex items-baseline justify-between mb-2.5">
              <div className="text-[15px] font-bold">
                {formatMB(usage.bytes)} <span className="text-white/30 font-medium">из 1024 МБ</span>
              </div>
              <div className="text-[13px] font-bold" style={{ color: usageColor(usage.bytes) }}>
                {Math.min(100, Math.round((usage.bytes / (1024 * 1024 * 1024)) * 100))}%
              </div>
            </div>
            <div className="h-2 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (usage.bytes / (1024 * 1024 * 1024)) * 100)}%`,
                  background: usageColor(usage.bytes),
                }}
              />
            </div>
            <div className="text-[12.5px] text-white/35 mt-2.5 leading-relaxed">
              {usage.files} файлов · {photos.length} фотоотчётов.
              {usage.bytes > 0 && (
                <> Хватит примерно ещё на {Math.max(0, Math.round(
                  (1024 * 1024 * 1024 - usage.bytes) / Math.max(1, usage.bytes / Math.max(1, usage.files))
                ))} снимков.</>
              )}
            </div>
          </Card>
        </Section>
      )}

      <Section title="Настройки">
        <Card className="divide-y divide-white/6">
          <Row
            icon="👤"
            title="Редактировать профиль"
            subtitle="Фото, имя, цвет"
            onClick={() => setEditOpen(true)}
            right={<span className="text-white/25">›</span>}
          />
          <Row
            icon="🔔"
            title="Уведомления"
            subtitle="Напоминания и пуши"
            onClick={onOpenNotifications}
            right={<span className="text-white/25">›</span>}
          />
          <Row
            icon="🔑"
            title="Сменить пароль"
            subtitle={`Логин: ${emailToLogin(session?.user?.email)}`}
            onClick={() => setPasswordOpen(true)}
            right={<span className="text-white/25">›</span>}
          />
        </Card>
      </Section>

      <Section title={`Завершённые${stats.completed.length ? ` · ${stats.completed.length}` : ""}`}>
        {stats.completed.length ? (
          <Card className="divide-y divide-white/6">
            {stats.completed.map((h) => {
              const s = doneSetFor(h.id, uid);
              return (
                <Row
                  key={h.id}
                  icon={h.icon}
                  title={h.title}
                  subtitle={`${h.completed_at ? humanDateFull(h.completed_at.slice(0, 10)) : ""} · ${s.size} отметок · рекорд ${bestStreak(h, s, (h.created_at || todayISO()).slice(0, 10))}`}
                  right={<span className="text-[15px]">🏆</span>}
                />
              );
            })}
          </Card>
        ) : (
          <Card>
            <Empty emoji="🏁" title="Пока ничего не завершено" subtitle="Задайте привычке цель — и она попадёт сюда, когда цель будет достигнута." />
          </Card>
        )}
      </Section>

      {stats.archived.length > 0 && (
        <Section title={`Архив · ${stats.archived.length}`}>
          <Card className="divide-y divide-white/6">
            {stats.archived.map((h) => (
              <Row
                key={h.id}
                icon={h.icon}
                title={h.title}
                subtitle="в архиве"
                onClick={() => restoreHabit(h)}
                right={<span className="text-[12.5px] text-white/35">вернуть</span>}
              />
            ))}
          </Card>
        </Section>
      )}

      <Section title="Достижения">
        {achievements.filter((a) => a.user_id === uid).length ? (
          <div className="grid grid-cols-2 gap-2.5">
            {achievements
              .filter((a) => a.user_id === uid)
              .map((a) => {
                const b = BADGES[a.code] || { emoji: "🎖", title: a.code };
                const h = habits.find((x) => x.id === a.habit_id);
                return (
                  <div key={a.id} className="rounded-2xl bg-white/5 border border-white/8 p-3.5">
                    <div className="text-[24px] mb-1.5">{b.emoji}</div>
                    <div className="text-[14px] font-bold leading-tight">{b.title}</div>
                    <div className="text-[12px] text-white/35 truncate">{h?.title || ""}</div>
                  </div>
                );
              })}
          </div>
        ) : (
          <Card>
            <Empty emoji="🎖" title="Достижений пока нет" subtitle="Первое прилетит на седьмой день подряд." />
          </Card>
        )}
      </Section>

      <div className="mt-8">
        <Button variant="danger" onClick={signOut}>Выйти</Button>
      </div>

      <EditProfile open={editOpen} onClose={() => setEditOpen(false)} />
      <Password open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}

function Stat({ value, label, glyph, accent }) {
  return (
    <div
      className="rounded-2xl px-4 py-3.5"
      style={{ background: rgba(accent, 0.1), border: `1px solid ${rgba(accent, 0.14)}` }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[24px] font-extrabold leading-none">{value}</div>
        <div className="text-[16px] opacity-70">{glyph}</div>
      </div>
      <div className="text-[12.5px] text-white/40 font-medium mt-1.5 leading-tight">{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="text-[13px] font-bold tracking-[0.1em] uppercase text-white/30 mb-2.5 px-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Quick({ emoji, value, label, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className="press rounded-2xl py-3 flex flex-col items-center gap-0.5"
      style={{ background: rgba(color, 0.12), border: `1px solid ${rgba(color, 0.16)}` }}
    >
      <span className="text-[19px] leading-none">{emoji}</span>
      {value !== "" && (
        <span className="text-[15px] font-extrabold" style={{ color: hex(color) }}>{value}</span>
      )}
      <span className="text-[11.5px] font-semibold text-white/50">{label}</span>
    </button>
  );
}

function formatMB(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb < 10 ? `${mb.toFixed(1)} МБ` : `${Math.round(mb)} МБ`;
}

function usageColor(bytes) {
  const share = bytes / (1024 * 1024 * 1024);
  if (share > 0.9) return hex("rose");
  if (share > 0.7) return hex("amber");
  return hex("mint");
}
