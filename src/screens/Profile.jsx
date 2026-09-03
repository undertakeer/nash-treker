import { useMemo, useRef, useState } from "react";
import Avatar from "../components/Avatar";
import { Button, Card, Empty, Field, Row, TextInput } from "../components/ui";
import MoodPicker from "../components/MoodPicker";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { squareThumb } from "../lib/image";
import { COLOR_KEYS, COLORS, hex, rgba } from "../lib/theme";
import { addDays, days, humanDateFull, todayISO } from "../lib/date";
import { bestStreak, streak } from "../lib/stats";

const BADGES = {
  streak_7:   { emoji: "🌱", title: "7 дней подряд" },
  streak_30:  { emoji: "🔥", title: "30 дней подряд" },
  streak_100: { emoji: "💎", title: "100 дней подряд" },
  streak_365: { emoji: "👑", title: "Год подряд" },
};

export default function Profile({ onOpenNotifications }) {
  const {
    me, uid, habits, checkins, achievements, doneSetFor, updateProfile, signOut, showToast, restoreHabit,
  } = useStore();
  const fileRef = useRef(null);
  const [name, setName] = useState(me?.display_name || "");
  const [uploading, setUploading] = useState(false);

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
      best = Math.max(best, bestStreak(h, s, (h.created_at || todayISO()).slice(0, 10)));
      currentTotal = Math.max(currentTotal, streak(h, s));
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
  }, [habits, uid, doneSetFor, mine]);

  const heat = useMemo(() => {
    const set = new Set(mine.map((c) => c.day));
    const out = [];
    for (let i = 118; i >= 0; i--) {
      const iso = addDays(todayISO(), -i);
      out.push({ iso, on: set.has(iso) });
    }
    return out;
  }, [mine]);

  async function pickAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const blob = await squareThumb(file);
      const path = `${uid}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile({ avatar_url: data.publicUrl });
      showToast("Аватарка обновлена", "📸");
    } catch (err) {
      showToast(err.message || "Не удалось загрузить фото", "⚠️");
    } finally {
      setUploading(false);
    }
  }

  const accent = me?.accent || "mint";

  return (
    <div className="px-4 pb-32">
      <header className="safe-top pt-2 pb-5">
        <h1 className="text-[29px] font-extrabold tracking-tight">Профиль</h1>
      </header>

      <div className="flex items-center gap-4 mb-7">
        <button onClick={() => fileRef.current?.click()} className="press relative shrink-0">
          <Avatar profile={me} size={78} ring />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full grid place-items-center text-[13px]"
            style={{ background: hex(accent), color: "#0A0A0E", boxShadow: "0 0 0 3px #08080B" }}
          >
            {uploading ? "…" : "📷"}
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickAvatar} className="hidden" />
        <div className="min-w-0 flex-1">
          <div className="text-[21px] font-extrabold truncate">{me?.display_name || "Без имени"}</div>
          <div className="text-[13.5px] text-white/40">
            {days(stats.daysWithUs)} в трекере · {stats.checkins} отметок
          </div>
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

      <Card className="p-4 mb-6">
        <div className="text-[13px] font-semibold text-white/45 mb-3">Активность за 4 месяца</div>
        <div className="flex flex-wrap gap-[3px]">
          {heat.map((d) => (
            <span
              key={d.iso}
              title={d.iso}
              className="rounded-[3px]"
              style={{
                width: 11, height: 11,
                background: d.on ? hex(accent) : "rgba(255,255,255,.06)",
              }}
            />
          ))}
        </div>
      </Card>

      <Section title="Настройки">
        <Card className="divide-y divide-white/6">
          <div className="px-4 py-3.5">
            <Field label="Имя">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() !== me?.display_name && updateProfile({ display_name: name.trim() })}
                placeholder="Как вас зовут"
                maxLength={30}
              />
            </Field>
          </div>
          <div className="px-4 py-3.5">
            <div className="text-[13px] font-semibold text-white/45 mb-2.5">Запасная аватарка</div>
            <div className="flex flex-wrap gap-2">
              {["🙂","😎","🥰","🦊","🐻","🐱","🐼","🦁","🌚","👻","🤖","🐧"].map((e) => (
                <button
                  key={e}
                  onClick={() => updateProfile({ emoji: e })}
                  className="w-10 h-10 rounded-xl grid place-items-center text-[19px] press"
                  style={{
                    background: me?.emoji === e ? rgba(accent, 0.26) : "rgba(255,255,255,.05)",
                    border: `1px solid ${me?.emoji === e ? rgba(accent, 0.45) : "transparent"}`,
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-3.5">
            <div className="text-[13px] font-semibold text-white/45 mb-2.5">Мой цвет</div>
            <div className="flex flex-wrap gap-2.5">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => updateProfile({ accent: k })}
                  className="w-8 h-8 rounded-full press"
                  style={{
                    background: hex(k),
                    boxShadow: accent === k ? `0 0 0 2.5px #08080B, 0 0 0 4.5px ${hex(k)}` : "none",
                  }}
                  aria-label={COLORS[k].label}
                />
              ))}
            </div>
          </div>
          <Row icon="🔔" title="Уведомления" subtitle="Напоминания и пуши" onClick={onOpenNotifications} right={<span className="text-white/25">›</span>} />
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
