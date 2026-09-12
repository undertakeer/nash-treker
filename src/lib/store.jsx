import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { supabase } from "./supabase";
import { readCache, writeCache } from "./cache";
import { todayISO } from "./date";
import { emailToLogin } from "./auth";
import { pathFromPublicUrl, photoVariants } from "./image";
import { streak } from "./stats";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const ckKey = (habitId, userId, day) => `${habitId}|${userId}|${day}`;

/** 42P01 = undefined_table: миграция не прогнана */
const NO_TABLE = "Таблица не создана — прогоните supabase/apply.sql в SQL Editor";

/** Баллы за активность */
export const POINTS_PER_CHECKIN = 10;
export const POINTS_PER_BADGE = 100;
/** Сколько заморозок стрика доступно в месяц */
export const FREEZE_LIMIT = 2;

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
  const [freezes, setFreezes] = useState(() => readCache("freezes", []));
  const [wishes, setWishes] = useState(() => readCache("wishes", []));
  const [purchases, setPurchases] = useState(() => readCache("purchases", []));
  const [goals, setGoals] = useState(() => readCache("goals", []));
  const [tasks, setTasks] = useState(() => readCache("tasks", []));
  const [places, setPlaces] = useState(() => readCache("places", []));
  const [wishlist, setWishlist] = useState(() => readCache("wishlist", []));
  const [meds, setMeds] = useState(() => readCache("meds", []));
  const [medTakes, setMedTakes] = useState(() => readCache("medTakes", []));
  const [medEvents, setMedEvents] = useState(() => readCache("medEvents", []));
  // таблицы, которых нет в базе: миграция ещё не прогнана
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState(() => readCache("queue", []));
  const [toast, setToast] = useState(null);

  const uid = session?.user?.id || null;
  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

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
  useEffect(() => writeCache("freezes", freezes), [freezes]);
  useEffect(() => writeCache("wishes", wishes), [wishes]);
  useEffect(() => writeCache("purchases", purchases), [purchases]);
  useEffect(() => writeCache("goals", goals), [goals]);
  useEffect(() => writeCache("tasks", tasks), [tasks]);
  useEffect(() => writeCache("places", places), [places]);
  useEffect(() => writeCache("wishlist", wishlist), [wishlist]);
  useEffect(() => writeCache("meds", meds), [meds]);
  useEffect(() => writeCache("medTakes", medTakes), [medTakes]);
  useEffect(() => writeCache("medEvents", medEvents), [medEvents]);

  // ---------- загрузка ----------
  const loadAll = useCallback(async () => {
    if (!uid) return;
    const [p, h, c, e, a, pr, fz, w, pu, g, t, pl, wl, md, mt, me] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("habits").select("*").order("position").order("created_at"),
      supabase.from("checkins").select("*"),
      supabase.from("events").select("*, reactions(*)").order("created_at", { ascending: false }).limit(80),
      supabase.from("achievements").select("*").order("earned_at", { ascending: false }),
      supabase.from("notification_prefs").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("freezes").select("*"),
      supabase.from("wishes").select("*").order("position").order("created_at"),
      supabase.from("purchases").select("*").order("created_at", { ascending: false }).limit(60),
      supabase.from("goals").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").order("position").order("created_at"),
      supabase.from("places").select("*").order("created_at", { ascending: false }),
      supabase.from("wishlist").select("*").order("position").order("created_at"),
      supabase.from("meds").select("*").order("position").order("created_at"),
      supabase.from("med_takes").select("*"),
      supabase.from("med_events").select("*").order("date"),
    ]);
    // при ошибке сети оставляем то, что уже лежит в кэше
    let people = p.error ? null : p.data || [];

    // строки профиля может не быть, если аккаунт завели в обход триггера
    if (people && !people.some((x) => x.id === uid)) {
      const fallback = emailToLogin(session?.user?.email) || "";
      const { data: created } = await supabase
        .from("profiles")
        .upsert({ id: uid, display_name: fallback }, { onConflict: "id" })
        .select()
        .single();
      if (created) people = [...people, created];
      await supabase
        .from("notification_prefs")
        .upsert({ user_id: uid }, { onConflict: "user_id", ignoreDuplicates: true });
    }
    if (people) setProfiles(people);
    if (!h.error) setHabits(h.data || []);
    if (!c.error) setCheckins(c.data || []);
    if (!e.error) setEvents(e.data || []);
    if (!a.error) setAchievements(a.data || []);
    if (!pr.error && pr.data) setPrefs(pr.data);
    if (!fz.error) setFreezes(fz.data || []);
    if (!w.error) setWishes(w.data || []);
    if (!pu.error) setPurchases(pu.data || []);
    if (!g.error) setGoals(g.data || []);
    if (!t.error) setTasks(t.data || []);
    if (!pl.error) setPlaces(pl.data || []);
    if (!wl.error) setWishlist(wl.data || []);
    if (!md.error) setMeds(md.data || []);
    if (!mt.error) setMedTakes(mt.data || []);
    if (!me.error) setMedEvents(me.data || []);

    // 42P01 = undefined_table: понятная подсказка вместо тихой пустоты
    setMissing(
      [["tasks", t], ["places", pl], ["wishlist", wl], ["meds", md], ["meds", mt], ["meds", me]]
        .filter(([, res]) => res.error?.code === "42P01")
        .map(([name]) => name)
    );
    setLoading(false);
  }, [uid, session]);

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
        else if (table === "freezes") apply(setFreezes);
        else if (table === "wishes") apply(setWishes);
        else if (table === "purchases") apply(setPurchases);
        else if (table === "goals") apply(setGoals);
        else if (table === "tasks") apply(setTasks);
        else if (table === "places") apply(setPlaces);
        else if (table === "wishlist") apply(setWishlist);
        else if (table === "meds") apply(setMeds);
        else if (table === "med_events") apply(setMedEvents);
        else if (table === "med_takes") {
          setMedTakes((prev) => {
            const key = (x) => `${x.med_id}|${x.user_id}|${x.day}|${String(x.slot).slice(0, 5)}`;
            if (eventType === "DELETE") return prev.filter((x) => key(x) !== key(old));
            return prev.some((x) => key(x) === key(row)) ? prev : [...prev, row];
          });
        }
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
            const i = prev.findIndex((x) => key(x) === key(row));
            if (i === -1) return [...prev, row];
            const next = prev.slice();
            next[i] = { ...next[i], ...row };
            return next;
          });
        } else if (table === "reactions") {
          setEvents((prev) =>
            prev.map((ev) => {
              if (eventType === "DELETE") {
                // в событии удаления приходит только первичный ключ,
                // поэтому ищем реакцию по её id во всех записях ленты
                const list = ev.reactions || [];
                return list.some((r) => r.id === old.id)
                  ? { ...ev, reactions: list.filter((r) => r.id !== old.id) }
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

  const checkinFor = useCallback(
    (habitId, userId, day) =>
      checkins.find((c) => c.habit_id === habitId && c.user_id === userId && c.day === day) || null,
    [checkins]
  );

  const freezeSetFor = useCallback(
    (habitId, userId) => {
      const s = new Set();
      freezes.forEach((f) => {
        if (f.habit_id === habitId && f.user_id === userId) s.add(f.day);
      });
      return s;
    },
    [freezes]
  );

  const freezesLeft = useMemo(() => {
    const month = todayISO().slice(0, 7);
    const used = freezes.filter((f) => f.user_id === uid && f.day.slice(0, 7) === month).length;
    return Math.max(0, FREEZE_LIMIT - used);
  }, [freezes, uid]);

  const points = useMemo(() => {
    const earned =
      checkins.filter((c) => c.user_id === uid).length * POINTS_PER_CHECKIN +
      achievements.filter((a) => a.user_id === uid).length * POINTS_PER_BADGE;
    const spent = purchases
      .filter((p) => p.buyer_id === uid && p.status !== "cancelled")
      .reduce((sum, p) => sum + (p.price || 0), 0);
    return { earned, spent, balance: earned - spent };
  }, [checkins, achievements, purchases, uid]);

  const photos = useMemo(
    () =>
      checkins
        .filter((c) => c.photo_url)
        .slice()
        .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)),
    [checkins]
  );

  // ---------- действия ----------
  const showToast = useCallback((text, emoji) => {
    setToast({ text, emoji, id: Math.random().toString(36).slice(2) });
    setTimeout(() => setToast(null), 2600);
  }, []);

  /** Удаляет файлы отметки из хранилища, чтобы они не копились мусором */
  const dropPhotoFiles = useCallback(async (row) => {
    const paths = [
      pathFromPublicUrl(row?.photo_url, "moments"),
      pathFromPublicUrl(row?.thumb_url, "moments"),
    ].filter(Boolean);
    if (paths.length) await supabase.storage.from("moments").remove(paths);
  }, []);

  const awardBadges = useCallback(
    async (habit, day) => {
      // на момент вызова состояние ещё без свежей отметки — добавляем её вручную
      const set = new Set(doneSetFor(habit.id, uid));
      if (day) set.add(day);
      const s = streak(habit, set, freezeSetFor(habit.id, uid));
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
    [doneSetFor, freezeSetFor, uid, showToast]
  );

  const notifyPartner = useCallback((habit) => {
    supabase.functions
      .invoke("notify", { body: { kind: "partner_checkin", habit_id: habit.id } })
      .catch(() => {});
  }, []);

  const toggleCheckin = useCallback(
    async (habit, day = todayISO()) => {
      if (!uid) return;
      const has = isDone(habit.id, uid, day);
      const key = ckKey(habit.id, uid, day);
      const existing = checkins.find(
        (c) => c.habit_id === habit.id && c.user_id === uid && c.day === day
      );

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
          if (existing?.photo_url) dropPhotoFiles(existing);
        } else {
          await supabase.from("checkins").upsert({ habit_id: habit.id, user_id: uid, day });
          if (day === todayISO()) {
            supabase.from("events").insert({
              type: "checkin", actor_id: uid, habit_id: habit.id,
              payload: { title: habit.title, icon: habit.icon, day },
            }).then(() => {});
            notifyPartner(habit);
          }
          awardBadges(habit, day);
        }
      } catch {
        setQueue((q) => [...q, { op: has ? "del" : "add", habit_id: habit.id, day }]);
      }
    },
    [uid, isDone, awardBadges, checkins, dropPhotoFiles, notifyPartner]
  );

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
        showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
        loadAll();
      }
    },
    [showToast, loadAll]
  );

  const deleteHabit = useCallback(
    async (id) => {
      const own = checkins.filter((c) => c.habit_id === id && c.user_id === uid && c.photo_url);
      setHabits((prev) => prev.filter((h) => h.id !== id));
      setCheckins((prev) => prev.filter((c) => c.habit_id !== id));
      await supabase.from("habits").delete().eq("id", id);
      for (const row of own) await dropPhotoFiles(row);
      showToast("Привычка удалена", "🗑");
    },
    [checkins, uid, dropPhotoFiles, showToast]
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
      setProfiles((prev) =>
        prev.some((p) => p.id === uid)
          ? prev.map((p) => (p.id === uid ? { ...p, ...patch } : p))
          : [...prev, { id: uid, ...patch }]
      );
      const { data, error } = await supabase
        .from("profiles")
        .upsert({ id: uid, ...patch }, { onConflict: "id" })
        .select()
        .single();
      if (error) {
        showToast("Не удалось сохранить профиль", "⚠️");
        return;
      }
      if (data) setProfiles((prev) => prev.map((p) => (p.id === uid ? { ...p, ...data } : p)));
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

  // ---------- фотоотчёты и заметки ----------
  const attachPhoto = useCallback(
    async (habit, day, file) => {
      if (!uid) return;
      const prev = checkins.find(
        (c) => c.habit_id === habit.id && c.user_id === uid && c.day === day
      );
      const { full, thumb, type, ext } = await photoVariants(file);
      const stamp = Date.now();
      const base = `${uid}/${habit.id}/${day}-${stamp}`;

      const [up1, up2] = await Promise.all([
        supabase.storage.from("moments").upload(`${base}.${ext}`, full, { contentType: type, upsert: true }),
        supabase.storage.from("moments").upload(`${base}-s.${ext}`, thumb, { contentType: type, upsert: true }),
      ]);
      if (up1.error) throw up1.error;
      if (up2.error) throw up2.error;

      const photoUrl = supabase.storage.from("moments").getPublicUrl(`${base}.${ext}`).data.publicUrl;
      const thumbUrl = supabase.storage.from("moments").getPublicUrl(`${base}-s.${ext}`).data.publicUrl;

      const { data: row, error } = await supabase
        .from("checkins")
        .upsert({ habit_id: habit.id, user_id: uid, day, photo_url: photoUrl, thumb_url: thumbUrl })
        .select()
        .single();
      if (error) throw error;

      // старый снимок этого дня больше не нужен
      if (prev?.photo_url) dropPhotoFiles(prev);

      setCheckins((prev) => {
        const key = ckKey(habit.id, uid, day);
        const i = prev.findIndex((c) => ckKey(c.habit_id, c.user_id, c.day) === key);
        if (i === -1) return [...prev, row];
        const next = prev.slice();
        next[i] = { ...next[i], ...row };
        return next;
      });
      showToast("Фото добавлено", "📸");
      return row;
    },
    [uid, checkins, dropPhotoFiles, showToast]
  );

  const removePhoto = useCallback(
    async (habit, day) => {
      const row = checkins.find(
        (c) => c.habit_id === habit.id && c.user_id === uid && c.day === day
      );
      await supabase
        .from("checkins")
        .update({ photo_url: null, thumb_url: null })
        .match({ habit_id: habit.id, user_id: uid, day });
      setCheckins((prev) =>
        prev.map((c) =>
          c.habit_id === habit.id && c.user_id === uid && c.day === day
            ? { ...c, photo_url: null, thumb_url: null }
            : c
        )
      );
      dropPhotoFiles(row);
      showToast("Фото удалено", "🗑");
    },
    [uid, checkins, dropPhotoFiles, showToast]
  );

  /** Заметка только дополняет уже сделанную отметку и никогда её не создаёт:
      иначе печать в поле молча закрывала бы день. */
  const setNote = useCallback(
    async (habit, day, note) => {
      const value = note?.trim() || null;
      const key = ckKey(habit.id, uid, day);
      if (!checkins.some((c) => ckKey(c.habit_id, c.user_id, c.day) === key)) return false;
      setCheckins((prev) =>
        prev.map((c) =>
          ckKey(c.habit_id, c.user_id, c.day) === key ? { ...c, note: value } : c
        )
      );
      await supabase
        .from("checkins")
        .update({ note: value })
        .match({ habit_id: habit.id, user_id: uid, day });
      return true;
    },
    [uid, checkins]
  );

  // ---------- заморозка стрика ----------
  const freezeDay = useCallback(
    async (habit, day, reason) => {
      if (freezesLeft <= 0) {
        showToast(`Заморозки кончились — ${FREEZE_LIMIT} в месяц`, "🧊");
        return false;
      }
      const row = { user_id: uid, habit_id: habit.id, day, reason: reason || null };
      const { data, error } = await supabase.from("freezes").insert(row).select().single();
      if (error) {
        showToast("Не удалось заморозить", "⚠️");
        return false;
      }
      setFreezes((prev) => (prev.some((f) => f.id === data.id) ? prev : [...prev, data]));
      showToast("День заморожен — стрик цел", "🧊");
      return true;
    },
    [uid, freezesLeft, showToast]
  );

  const unfreezeDay = useCallback(
    async (habit, day) => {
      setFreezes((prev) =>
        prev.filter((f) => !(f.habit_id === habit.id && f.user_id === uid && f.day === day))
      );
      await supabase.from("freezes").delete().match({ habit_id: habit.id, user_id: uid, day });
    },
    [uid]
  );

  // ---------- желания и баллы ----------
  const createWish = useCallback(
    async (draft) => {
      const maxPos = wishes.reduce((m, w) => Math.max(m, w.position || 0), 0);
      const { data, error } = await supabase
        .from("wishes")
        .insert({ ...draft, owner_id: uid, position: maxPos + 1 })
        .select()
        .single();
      if (error) throw error;
      setWishes((prev) => (prev.some((w) => w.id === data.id) ? prev : [...prev, data]));
      showToast("Желание добавлено", draft.emoji || "🎁");
    },
    [wishes, uid, showToast]
  );

  const updateWish = useCallback(async (id, patch) => {
    setWishes((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    await supabase.from("wishes").update(patch).eq("id", id);
  }, []);

  const deleteWish = useCallback(
    async (id) => {
      setWishes((prev) => prev.filter((w) => w.id !== id));
      await supabase.from("wishes").delete().eq("id", id);
      showToast("Желание удалено", "🗑");
    },
    [showToast]
  );

  const buyWish = useCallback(
    async (wish) => {
      if (points.balance < wish.price) {
        showToast("Не хватает баллов", "🪙");
        return false;
      }
      const row = {
        wish_id: wish.id,
        buyer_id: uid,
        title: wish.title,
        emoji: wish.emoji,
        price: wish.price,
      };
      const { data, error } = await supabase.from("purchases").insert(row).select().single();
      if (error) {
        showToast("Не удалось купить", "⚠️");
        return false;
      }
      setPurchases((prev) => [data, ...prev]);
      supabase.functions
        .invoke("notify", { body: { kind: "purchase", purchase_id: data.id } })
        .catch(() => {});
      showToast(`Куплено: ${wish.title}`, "🎉");
      return true;
    },
    [points.balance, uid, showToast]
  );

  const markPurchaseDone = useCallback(
    async (purchase) => {
      const patch = { status: "done", done_at: new Date().toISOString(), done_by: uid };
      setPurchases((prev) => prev.map((p) => (p.id === purchase.id ? { ...p, ...patch } : p)));
      await supabase.from("purchases").update(patch).eq("id", purchase.id);
      showToast("Исполнено", "✅");
    },
    [uid, showToast]
  );

  const cancelPurchase = useCallback(
    async (purchase) => {
      const patch = { status: "cancelled" };
      setPurchases((prev) => prev.map((p) => (p.id === purchase.id ? { ...p, ...patch } : p)));
      await supabase.from("purchases").update(patch).eq("id", purchase.id);
      showToast("Отменено, баллы вернулись", "↩️");
    },
    [showToast]
  );

  // ---------- совместные цели ----------
  const createGoal = useCallback(
    async (draft) => {
      const { data, error } = await supabase
        .from("goals")
        .insert({ ...draft, created_by: uid })
        .select()
        .single();
      if (error) throw error;
      setGoals((prev) => (prev.some((g) => g.id === data.id) ? prev : [data, ...prev]));
      showToast("Цель поставлена", draft.emoji || "🎯");
    },
    [uid, showToast]
  );

  const completeGoal = useCallback(
    async (goal) => {
      const patch = { completed_at: new Date().toISOString() };
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, ...patch } : g)));
      await supabase.from("goals").update(patch).eq("id", goal.id);
      showToast("Цель достигнута", "🏆");
    },
    [showToast]
  );

  const deleteGoal = useCallback(async (id) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    await supabase.from("goals").delete().eq("id", id);
  }, []);

  const loadStorageUsage = useCallback(async () => {
    const { data, error } = await supabase.rpc("storage_usage");
    if (error) return null;
    const total = (data || []).reduce(
      (acc, r) => ({ bytes: acc.bytes + Number(r.bytes || 0), files: acc.files + Number(r.files || 0) }),
      { bytes: 0, files: 0 }
    );
    return { ...total, byBucket: data || [] };
  }, []);

  // ---------- задачи ----------
  const createTask = useCallback(
    async (draft) => {
      const maxPos = tasks.reduce((m, t) => Math.max(m, t.position || 0), 0);
      const row = { emoji: "📌", color: "sky", ...draft, created_by: uid, position: maxPos + 1 };
      const { data, error } = await supabase.from("tasks").insert(row).select().single();
      if (error) {
        showToast("Не удалось создать задачу", "⚠️");
        return null;
      }
      setTasks((prev) => (prev.some((t) => t.id === data.id) ? prev : [...prev, data]));
      return data;
    },
    [tasks, uid, showToast]
  );

  const updateTask = useCallback(
    async (id, patch) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
    },
    [showToast]
  );

  const toggleTask = useCallback(
    async (task) => {
      const next = !task.done;
      const patch = {
        done: next,
        done_at: next ? new Date().toISOString() : null,
        done_by: next ? uid : null,
      };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...patch } : t)));
      await supabase.from("tasks").update(patch).eq("id", task.id);
      return next;
    },
    [uid]
  );

  const deleteTask = useCallback(
    async (id) => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await supabase.from("tasks").delete().eq("id", id);
      showToast("Задача удалена", "🗑");
    },
    [showToast]
  );

  const clearDoneTasks = useCallback(async () => {
    const ids = tasks.filter((t) => t.done).map((t) => t.id);
    if (!ids.length) return;
    setTasks((prev) => prev.filter((t) => !t.done));
    await supabase.from("tasks").delete().in("id", ids);
    showToast(`Убрано ${ids.length}`, "🧹");
  }, [tasks, showToast]);

  // ---------- места на карте ----------
  /** Кладёт снимок места в хранилище и возвращает пару ссылок */
  const uploadPhotoFile = useCallback(
    async (file) => {
      const { full, thumb, type, ext } = await photoVariants(file);
      const base = `${uid}/places/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [up1, up2] = await Promise.all([
        supabase.storage.from("moments").upload(`${base}.${ext}`, full, { contentType: type, upsert: true }),
        supabase.storage.from("moments").upload(`${base}-s.${ext}`, thumb, { contentType: type, upsert: true }),
      ]);
      if (up1.error) throw up1.error;
      if (up2.error) throw up2.error;
      return {
        photo_url: supabase.storage.from("moments").getPublicUrl(`${base}.${ext}`).data.publicUrl,
        thumb_url: supabase.storage.from("moments").getPublicUrl(`${base}-s.${ext}`).data.publicUrl,
      };
    },
    [uid]
  );

  const createPlace = useCallback(
    async (fields, file) => {
      if (!uid) return null;
      let shot = {};
      if (file) {
        try {
          shot = await uploadPhotoFile(file);
        } catch {
          showToast("Фото не загрузилось, место сохранили без него", "⚠️");
        }
      }
      const { data, error } = await supabase
        .from("places")
        .insert({ ...fields, ...shot, created_by: uid })
        .select()
        .single();
      if (error) {
        showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить место", "⚠️");
        return null;
      }
      setPlaces((prev) => (prev.some((x) => x.id === data.id) ? prev : [data, ...prev]));
      supabase.functions
        .invoke("notify", { body: { kind: "place", place_id: data.id } })
        .catch(() => {});
      showToast("Место на карте", data.emoji || "📍");
      return data;
    },
    [uid, uploadPhotoFile, showToast]
  );

  const updatePlace = useCallback(
    async (id, patch, file) => {
      const before = places.find((x) => x.id === id);
      let shot = {};
      if (file) {
        try {
          shot = await uploadPhotoFile(file);
        } catch {
          showToast("Фото не загрузилось", "⚠️");
        }
      }
      const next = { ...patch, ...shot };
      setPlaces((prev) => prev.map((x) => (x.id === id ? { ...x, ...next } : x)));
      const { error } = await supabase.from("places").update(next).eq("id", id);
      if (error) {
        showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
        return;
      }
      // старый снимок больше не нужен — иначе он навсегда останется в хранилище
      if (shot.photo_url && before?.photo_url) dropPhotoFiles(before);
    },
    [places, uploadPhotoFile, dropPhotoFiles, showToast]
  );

  const togglePlaceVisited = useCallback(
    async (place) => {
      const visited = place.status === "visited";
      const patch = visited
        ? { status: "want", visited_at: null }
        : { status: "visited", visited_at: todayISO() };
      setPlaces((prev) => prev.map((x) => (x.id === place.id ? { ...x, ...patch } : x)));
      await supabase.from("places").update(patch).eq("id", place.id);
      if (!visited) showToast("Отмечено: были", "✅");
    },
    [showToast]
  );

  const deletePlace = useCallback(
    async (id) => {
      const row = places.find((x) => x.id === id);
      setPlaces((prev) => prev.filter((x) => x.id !== id));
      await supabase.from("places").delete().eq("id", id);
      if (row) dropPhotoFiles(row);
      showToast("Место удалено", "🗑");
    },
    [places, dropPhotoFiles, showToast]
  );

  const attachPlacePhoto = useCallback(
    (place, file) => updatePlace(place.id, {}, file),
    [updatePlace]
  );

  // ---------- вишлист ----------
  const createWishItem = useCallback(
    async (fields, file) => {
      if (!uid) return null;
      let shot = {};
      if (file) {
        try {
          shot = await uploadPhotoFile(file);
        } catch {
          showToast("Фото не загрузилось, сохранили без него", "⚠️");
        }
      }
      const maxPos = wishlist.reduce((m, w) => Math.max(m, w.position || 0), 0);
      const { data, error } = await supabase
        .from("wishlist")
        .insert({ owner_id: uid, ...fields, ...shot, position: maxPos + 1, created_by: uid })
        .select()
        .single();
      if (error) {
        showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
        return null;
      }
      setWishlist((prev) => (prev.some((w) => w.id === data.id) ? prev : [...prev, data]));
      showToast("Добавлено в вишлист", data.emoji || "🎁");
      return data;
    },
    [uid, wishlist, uploadPhotoFile, showToast]
  );

  const updateWishItem = useCallback(
    async (id, patch, file) => {
      const before = wishlist.find((w) => w.id === id);
      let shot = {};
      if (file) {
        try {
          shot = await uploadPhotoFile(file);
        } catch {
          showToast("Фото не загрузилось", "⚠️");
        }
      }
      const next = { ...patch, ...shot };
      setWishlist((prev) => prev.map((w) => (w.id === id ? { ...w, ...next } : w)));
      const { error } = await supabase.from("wishlist").update(next).eq("id", id);
      if (error) {
        showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
        return;
      }
      if (shot.photo_url && before?.photo_url) dropPhotoFiles(before);
    },
    [wishlist, uploadPhotoFile, dropPhotoFiles, showToast]
  );

  const toggleWishItemGot = useCallback(
    async (item) => {
      const got = item.status === "got";
      const patch = got
        ? { status: "want", got_at: null, got_by: null }
        : { status: "got", got_at: todayISO(), got_by: uid };
      setWishlist((prev) => prev.map((w) => (w.id === item.id ? { ...w, ...patch } : w)));
      await supabase.from("wishlist").update(patch).eq("id", item.id);
      if (!got) showToast("Подарено 🎉", item.emoji || "🎁");
    },
    [uid, showToast]
  );

  const deleteWishItem = useCallback(
    async (id) => {
      const row = wishlist.find((w) => w.id === id);
      setWishlist((prev) => prev.filter((w) => w.id !== id));
      await supabase.from("wishlist").delete().eq("id", id);
      if (row) dropPhotoFiles(row);
      showToast("Удалено", "🗑");
    },
    [wishlist, dropPhotoFiles, showToast]
  );

  // ---------- лечение ----------
  /** Быстрая проверка «этот приём отмечен»: med_id|day|slot */
  const takenKeys = useMemo(
    () => new Set(medTakes.map((t) => `${t.med_id}|${t.day}|${String(t.slot).slice(0, 5)}`)),
    [medTakes]
  );

  const createMed = useCallback(
    async (fields) => {
      if (!uid) return null;
      const maxPos = meds.reduce((m, x) => Math.max(m, x.position || 0), 0);
      const { data, error } = await supabase
        .from("meds")
        .insert({ ...fields, owner_id: uid, position: maxPos + 1 })
        .select()
        .single();
      if (error) {
        showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
        return null;
      }
      setMeds((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
      showToast("Добавлено в лечение", data.emoji || "💊");
      return data;
    },
    [uid, meds, showToast]
  );

  const updateMed = useCallback(
    async (id, patch) => {
      setMeds((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      const { error } = await supabase.from("meds").update(patch).eq("id", id);
      if (error) showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
    },
    [showToast]
  );

  const deleteMed = useCallback(
    async (id) => {
      setMeds((prev) => prev.filter((x) => x.id !== id));
      setMedTakes((prev) => prev.filter((t) => t.med_id !== id));
      await supabase.from("meds").delete().eq("id", id);
      showToast("Удалено", "🗑");
    },
    [showToast]
  );

  /** Отметить или снять конкретный приём */
  const toggleDose = useCallback(
    async (med, day, slot) => {
      if (!uid) return;
      const time = String(slot).slice(0, 5);
      const has = takenKeys.has(`${med.id}|${day}|${time}`);
      const same = (t) =>
        t.med_id === med.id && t.user_id === uid && t.day === day && String(t.slot).slice(0, 5) === time;

      if (has) {
        setMedTakes((prev) => prev.filter((t) => !same(t)));
        await supabase.from("med_takes").delete()
          .match({ med_id: med.id, user_id: uid, day, slot: time });
        return false;
      }
      setMedTakes((prev) => [...prev, {
        med_id: med.id, user_id: uid, day, slot: time, taken_at: new Date().toISOString(),
      }]);
      const { error } = await supabase.from("med_takes")
        .upsert({ med_id: med.id, user_id: uid, day, slot: time },
                { onConflict: "med_id,user_id,day,slot", ignoreDuplicates: true });
      if (error) {
        setMedTakes((prev) => prev.filter((t) => !same(t)));
        showToast(error.code === "42P01" ? NO_TABLE : "Не удалось отметить", "⚠️");
        return false;
      }
      return true;
    },
    [uid, takenKeys, showToast]
  );

  const createMedEvent = useCallback(
    async (fields) => {
      if (!uid) return null;
      const { data, error } = await supabase
        .from("med_events").insert({ ...fields, owner_id: uid }).select().single();
      if (error) {
        showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
        return null;
      }
      setMedEvents((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
      showToast("Веха добавлена", data.emoji || "🧪");
      return data;
    },
    [uid, showToast]
  );

  const updateMedEvent = useCallback(
    async (id, patch) => {
      setMedEvents((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      const { error } = await supabase.from("med_events").update(patch).eq("id", id);
      if (error) showToast(error.code === "42P01" ? NO_TABLE : "Не удалось сохранить", "⚠️");
    },
    [showToast]
  );

  const toggleMedEvent = useCallback(
    async (item) => {
      const patch = item.done
        ? { done: false, done_at: null }
        : { done: true, done_at: new Date().toISOString() };
      setMedEvents((prev) => prev.map((x) => (x.id === item.id ? { ...x, ...patch } : x)));
      await supabase.from("med_events").update(patch).eq("id", item.id);
      if (!patch.done) return;
      showToast("Готово", "✅");
    },
    [showToast]
  );

  const deleteMedEvent = useCallback(
    async (id) => {
      setMedEvents((prev) => prev.filter((x) => x.id !== id));
      await supabase.from("med_events").delete().eq("id", id);
      showToast("Удалено", "🗑");
    },
    [showToast]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setHabits([]); setCheckins([]); setEvents([]); setAchievements([]); setProfiles([]);
    setFreezes([]); setWishes([]); setPurchases([]); setGoals([]); setTasks([]); setPlaces([]); setWishlist([]);
    setMeds([]); setMedTakes([]); setMedEvents([]);
  }, []);

  const value = {
    session, uid, me, partner, profiles,
    habits, checkins, events, achievements, prefs,
    freezes, wishes, purchases, goals, tasks, places, wishlist, points, photos, freezesLeft,
    meds, medTakes, medEvents, takenKeys,
    missing,
    loading, online, pendingCount: queue.length, toast,
    isDone, doneSetFor, freezeSetFor, checkinFor,
    toggleCheckin, nudge, react,
    createHabit, updateHabit, deleteHabit, completeHabit, archiveHabit, restoreHabit, reorderHabits,
    attachPhoto, removePhoto, setNote, loadStorageUsage,
    freezeDay, unfreezeDay,
    createWish, updateWish, deleteWish, buyWish, markPurchaseDone, cancelPurchase,
    createGoal, completeGoal, deleteGoal,
    createTask, updateTask, toggleTask, deleteTask, clearDoneTasks,
    createPlace, updatePlace, togglePlaceVisited, deletePlace, attachPlacePhoto,
    createWishItem, updateWishItem, toggleWishItemGot, deleteWishItem,
    createMed, updateMed, deleteMed, toggleDose,
    createMedEvent, updateMedEvent, toggleMedEvent, deleteMedEvent,
    updateProfile, updatePrefs, signOut, reload: loadAll, showToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
