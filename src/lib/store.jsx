import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { supabase } from "./supabase";
import { readCache, writeCache } from "./cache";
import { todayISO } from "./date";
import { streak } from "./stats";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const ckKey = (habitId, userId, day) => `${habitId}|${userId}|${day}`;

/** Достижения, которые выдаём на клиенте после отметки */
const STREAK_BADGES = [
  { code: "streak_7", days: 7 },
  { code: "streak_30", days: 30 },
  { code: "streak_100", days: 100 },
  { code: "streak_365", days: 365 },
];

export function StoreProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = ещё проверяем
  const [profiles, setProfiles] = useState(() => readCache("profiles", []));
  const [habits, setHabits] = useState(() => readCache("habits", []));
  const [checkins, setCheckins] = useState(() => readCache("checkins", []));
  const [events, setEvents] = useState(() => readCache("events", []));
  const [achievements, setAchievements] = useState(() => readCache("achievements", []));
  const [prefs, setPrefs] = useState(() => readCache("prefs", null));
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState(() => readCache("queue", []));
  const [toast, setToast] = useState(null);

  const uid = session?.user?.id || null;
  const queueRef = useRef(queue);
  queueRef.current = queue;

  // ---------- сессия ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---------- сеть ----------
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // ---------- кэш ----------
  useEffect(() => writeCache("profiles", profiles), [profiles]);
  useEffect(() => writeCache("habits", habits), [habits]);
  useEffect(() => writeCache("checkins", checkins), [checkins]);
  useEffect(() => writeCache("events", events), [events]);
  useEffect(() => writeCache("achievements", achievements), [achievements]);
  useEffect(() => writeCache("prefs", prefs), [prefs]);
  useEffect(() => writeCache("queue", queue), [queue]);

  // ---------- загрузка ----------
  const loadAll = useCallback(async () => {
    if (!uid) return;
    const [p, h, c, e, a, pr] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("habits").select("*").order("position").order("created_at"),
      supabase.from("checkins").select("*"),
      supabase.from("events").select("*, reactions(*)").order("created_at", { ascending: false }).limit(80),
      supabase.from("achievements").select("*").order("earned_at", { ascending: false }),
      supabase.from("notification_prefs").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    if (!p.error) setProfiles(p.data || []);
    if (!h.error) setHabits(h.data || []);
    if (!c.error) setCheckins(c.data || []);
    if (!e.error) setEvents(e.data || []);
    if (!a.error) setAchievements(a.data || []);
    if (!pr.error && pr.data) setPrefs(pr.data);
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadAll();
  }, [session, loadAll]);

  // ---------- realtime ----------
  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel("nt-live")
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        const { table, eventType, new: row, old } = payload;
        const apply = (setter, idKey = "id") => {
          setter((prev) => {
            if (eventType === "DELETE") {
              return prev.filter((x) => x[idKey] !== old[idKey]);
            }
            const i = prev.findIndex((x) => x[idKey] === row[idKey]);
            if (i === -1) return [...prev, row];
            const next = prev.slice();
            next[i] = { ...next[i], ...row };
            return next;
          });
        };
        if (table === "habits") apply(setHabits);
        else if (table === "profiles") apply(setProfiles);
        else if (table === "achievements") apply(setAchievements);
        else if (table === "events") {
          setEvents((prev) => {
            if (eventType === "DELETE") return prev.filter((x) => x.id !== old.id);
            if (prev.some((x) => x.id === row.id)) return prev;
            return [{ ...row, reactions: [] }, ...prev].slice(0, 80);
          });
        } else if (table === "checkins") {
          setCheckins((prev) => {
            const key = (x) => ckKey(x.habit_id, x.user_id, x.day);
            if (eventType === "DELETE") return prev.filter((x) => key(x) !== key(old));
            if (prev.some((x) => key(x) === key(row))) return prev;
            return [...prev, row];
          });
        } else if (table === "reactions") {
          setEvents((prev) =>
            prev.map((ev) => {
              if (eventType === "DELETE") {
                return ev.id === old.event_id
                  ? { ...ev, reactions: (ev.reactions || []).filter((r) => r.id !== old.id) }
                  : ev;
              }
              if (ev.id !== row.event_id) return ev;
              if ((ev.reactions || []).some((r) => r.id === row.id)) return ev;
              return { ...ev, reactions: [...(ev.reactions || []), row] };
            })
          );
        }
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [uid]);

  // ---------- очередь офлайн-отметок ----------
  const flushQueue = useCallback(async () => {
    const pending = queueRef.current;
    if (!pending.length || !navigator.onLine || !uid) return;
    const rest = [];
    for (const job of pending) {
      try {
        if (job.op === "add") {
          const { error } = await supabase
            .from("checkins")
            .upsert({ habit_id: job.habit_id, user_id: uid, day: job.day });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("checkins")
            .delete()
            .match({ habit_id: job.habit_id, user_id: uid, day: job.day });
          if (error) throw error;
        }
      } catch {
        rest.push(job);
      }
    }
    setQueue(rest);
  }, [uid]);

  useEffect(() => {
    if (online) flushQueue();
  }, [online, queue.length, flushQueue]);

  // ---------- производные ----------
  const me = useMemo(() => profiles.find((p) => p.id === uid) || null, [profiles, uid]);
  const partner = useMemo(() => profiles.find((p) => p.id !== uid) || null, [profiles, uid]);

  const doneIndex = useMemo(() => {
    const m = new Set();
    checkins.forEach((c) => m.add(ckKey(c.habit_id, c.user_id, c.day)));
    return m;
  }, [checkins]);

  const doneSetFor = useCallback(
    (habitId, userId) => {
      const s = new Set();
      checkins.forEach((c) => {
        if (c.habit_id === habitId && c.user_id === userId) s.add(c.day);
      });
      return s;
    },
    [checkins]
  );

  const isDone = useCallback(
    (habitId, userId, day) => doneIndex.has(ckKey(habitId, userId, day)),
    [doneIndex]
  );

  // ---------- действия ----------
  const showToast = useCallback((text, emoji) => {
    setToast({ text, emoji, id: Math.random().toString(36).slice(2) });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const awardBadges = useCallback(
    async (habit) => {
      const s = streak(habit, doneSetFor(habit.id, uid));
      const hit = STREAK_BADGES.filter((b) => s === b.days);
      for (const b of hit) {
        const row = { user_id: uid, habit_id: habit.id, code: b.code };
        const { data } = await supabase.from("achievements").upsert(row, {
          onConflict: "user_id,habit_id,code",
          ignoreDuplicates: true,
        }).select();
        if (data && data.length) showToast(`${b.days} дней подряд — «${habit.title}»`, "🏅");
      }
    },
    [doneSetFor, uid, showToast]
  );

  const toggleCheckin = useCallback(
    async (habit, day = todayISO()) => {
      if (!uid) return;
      const has = isDone(habit.id, uid, day);
      const key = ckKey(habit.id, uid, day);

      // оптимистично
      setCheckins((prev) =>
        has
          ? prev.filter((c) => ckKey(c.habit_id, c.user_id, c.day) !== key)
          : [...prev, { habit_id: habit.id, user_id: uid, day, created_at: new Date().toISOString() }]
      );

      if (!navigator.onLine) {
        setQueue((q) => [...q.filter((j) => !(j.habit_id === habit.id && j.day === day)),
          { op: has ? "del" : "add", habit_id: habit.id, day }]);
        return;
      }

      try {
        if (has) {
          await supabase.from("checkins").delete().match({ habit_id: habit.id, user_id: uid, day });
        } else {
          await supabase.from("checkins").upsert({ habit_id: habit.id, user_id: uid, day });
          if (day === todayISO()) {
            supabase.from("events").insert({
              type: "checkin", actor_id: uid, habit_id: habit.id,
              payload: { title: habit.title, icon: habit.icon, day },
            }).then(() => {});
            notifyPartner(habit);
          }
          setTimeout(() => awardBadges(habit), 200);
        }
      } catch {
        setQueue((q) => [...q, { op: has ? "del" : "add", habit_id: habit.id, day }]);
      }
    },
    [uid, isDone, awardBadges]
  );

  const notifyPartner = useCallback((habit) => {
    supabase.functions
      .invoke("notify", { body: { kind: "partner_checkin", habit_id: habit.id } })
      .catch(() => {});
  }, []);

  const nudge = useCallback(
    async (habit, targetId) => {
      if (!uid || !targetId) return;
      await supabase.from("events").insert({
        type: "nudge", actor_id: uid, target_id: targetId, habit_id: habit.id,
        payload: { title: habit.title, icon: habit.icon },
      });
      supabase.functions
        .invoke("notify", { body: { kind: "nudge", habit_id: habit.id, target_id: targetId } })
        .catch(() => {});
      showToast("Подтолкнули", "👋");
    },
    [uid, showToast]
  );

  const createHabit = useCallback(
    async (draft) => {
      const maxPos = habits.reduce((m, h) => Math.max(m, h.position || 0), 0);
      const row = { ...draft, created_by: uid, position: maxPos + 1 };
      if (row.kind === "personal") row.owner_id = uid;
      else row.owner_id = null;
      const { data, error } = await supabase.from("habits").insert(row).select().single();
      if (error) throw error;
      setHabits((prev) => (prev.some((h) => h.id === data.id) ? prev : [...prev, data]));
      showToast("Привычка создана", data.icon);
      return data;
    },
    [habits, uid, showToast]
  );

  const updateHabit = useCallback(
    async (id, patch) => {
      setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
      const { error } = await supabase.from("habits").update(patch).eq("id", id);
      if (error) {
        showToast("Не удалось сохранить", "⚠️");
        loadAll();
      }
    },
    [showToast, loadAll]
  );

  const deleteHabit = useCallback(
    async (id) => {
      setHabits((prev) => prev.filter((h) => h.id !== id));
      setCheckins((prev) => prev.filter((c) => c.habit_id !== id));
      await supabase.from("habits").delete().eq("id", id);
      showToast("Привычка удалена", "🗑");
    },
    [showToast]
  );

  const completeHabit = useCallback(
    async (habit) => {
      await updateHabit(habit.id, { status: "completed", completed_at: new Date().toISOString() });
      await supabase.from("events").insert({
        type: "completed", actor_id: uid, habit_id: habit.id,
        payload: { title: habit.title, icon: habit.icon },
      });
      showToast(`«${habit.title}» завершена`, "🏆");
    },
    [updateHabit, uid, showToast]
  );

  const archiveHabit = useCallback(
    async (habit) => {
      await updateHabit(habit.id, { status: "archived", archived_at: new Date().toISOString() });
      showToast("В архиве", "📦");
    },
    [updateHabit, showToast]
  );

  const restoreHabit = useCallback(
    async (habit) => {
      await updateHabit(habit.id, { status: "active", archived_at: null, completed_at: null });
      showToast("Снова активна", "▶️");
    },
    [updateHabit, showToast]
  );

  const reorderHabits = useCallback(
    async (orderedIds) => {
      setHabits((prev) => {
        const pos = new Map(orderedIds.map((id, i) => [id, i]));
        return prev.map((h) => (pos.has(h.id) ? { ...h, position: pos.get(h.id) } : h));
      });
      await Promise.all(
        orderedIds.map((id, i) => supabase.from("habits").update({ position: i }).eq("id", id))
      );
    },
    []
  );

  const updateProfile = useCallback(
    async (patch) => {
      setProfiles((prev) => prev.map((p) => (p.id === uid ? { ...p, ...patch } : p)));
      const { error } = await supabase.from("profiles").update(patch).eq("id", uid);
      if (error) showToast("Не удалось сохранить профиль", "⚠️");
    },
    [uid, showToast]
  );

  const updatePrefs = useCallback(
    async (patch) => {
      setPrefs((p) => ({ ...(p || {}), ...patch }));
      await supabase.from("notification_prefs").upsert({ user_id: uid, ...(prefs || {}), ...patch });
    },
    [uid, prefs]
  );

  const react = useCallback(
    async (eventId, emoji) => {
      const mine = events
        .find((e) => e.id === eventId)
        ?.reactions?.find((r) => r.user_id === uid && r.emoji === emoji);
      if (mine) {
        setEvents((prev) => prev.map((e) => e.id === eventId
          ? { ...e, reactions: e.reactions.filter((r) => r.id !== mine.id) } : e));
        await supabase.from("reactions").delete().eq("id", mine.id);
      } else {
        await supabase.from("reactions").insert({ event_id: eventId, user_id: uid, emoji });
      }
    },
    [events, uid]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setHabits([]); setCheckins([]); setEvents([]); setAchievements([]); setProfiles([]);
  }, []);

  const value = {
    session, uid, me, partner, profiles,
    habits, checkins, events, achievements, prefs,
    loading, online, pendingCount: queue.length, toast,
    isDone, doneSetFor,
    toggleCheckin, nudge, react,
    createHabit, updateHabit, deleteHabit, completeHabit, archiveHabit, restoreHabit, reorderHabits,
    updateProfile, updatePrefs, signOut, reload: loadAll, showToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
