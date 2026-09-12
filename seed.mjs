// Тестовые данные для обоих прогонов: jsdom-смоук и браузерный visual.mjs.
// Ключи те же, что пишет приложение, поэтому экраны рисуются на «кэше».
export function authSeed() {
  const out = {};
  const set = (k, v) => { out[k] = v; };

  const uid = "00000000-0000-4000-8000-000000000001";
  const pid = "00000000-0000-4000-8000-000000000002";
  const future = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
  set("nash-treker-auth", JSON.stringify({
    access_token: "smoke", token_type: "bearer", expires_at: future, expires_in: 31536000,
    refresh_token: "smoke",
    user: { id: uid, email: "izzat@nashtreker.app", aud: "authenticated", role: "authenticated" },
  }));
  const put = (k, v) => set("nt:" + k, JSON.stringify(v));
  put("profiles", [
    { id: uid, display_name: "Иззат", accent: "mint", emoji: "🙂", mood: "fire", mood_at: new Date().toISOString(), timezone: "Asia/Tashkent", created_at: "2026-01-01T00:00:00Z" },
    { id: pid, display_name: "Лера", accent: "pink", emoji: "🥰", mood: "love", mood_text: "жду вечера", mood_at: new Date().toISOString(), timezone: "Asia/Tashkent", created_at: "2026-01-01T00:00:00Z" },
  ]);
  const today = new Date().toISOString().slice(0, 10);
  put("habits", [
    { id: "h1", title: "Ходить в зал", icon: "🏋️", color: "mint", kind: "shared", schedule_type: "daily", target_per_week: 7, weekdays: [1,2,3,4,5,6,7], status: "active", pinned: true, position: 0, goal_days: 30, created_at: "2026-06-01T00:00:00Z" },
    { id: "h2", title: "Читать", icon: "📚", color: "violet", kind: "personal", owner_id: uid, schedule_type: "times_per_week", target_per_week: 5, weekdays: [1,2,3,4,5,6,7], status: "active", position: 1, created_at: "2026-06-01T00:00:00Z" },
    { id: "h3", title: "Йога", icon: "🧘", color: "pink", kind: "personal", owner_id: pid, schedule_type: "daily", target_per_week: 7, weekdays: [1,2,3,4,5,6,7], status: "completed", position: 2, completed_at: "2026-08-01T00:00:00Z", created_at: "2026-05-01T00:00:00Z" },
  ]);
  put("checkins", [
    { habit_id: "h1", user_id: uid, day: today, created_at: new Date().toISOString(), photo_url: "http://x/p.jpg", thumb_url: "http://x/t.jpg", note: "тяжело" },
    { habit_id: "h1", user_id: pid, day: today, created_at: new Date().toISOString() },
    { habit_id: "h2", user_id: uid, day: today, created_at: new Date().toISOString() },
  ]);
  put("events", [{ id: "e1", type: "checkin", actor_id: pid, habit_id: "h1", payload: { title: "Ходить в зал", icon: "🏋️" }, created_at: new Date().toISOString(), reactions: [] }]);
  put("achievements", [{ id: "a1", user_id: uid, habit_id: "h1", code: "streak_7", earned_at: new Date().toISOString() }]);
  put("freezes", [{ id: "f1", user_id: uid, habit_id: "h1", day: "2026-08-20" }]);
  put("wishes", [{ id: "w1", owner_id: uid, title: "Массаж", emoji: "💆", price: 100, active: true, position: 0 }]);
  put("purchases", [{ id: "pu1", buyer_id: pid, title: "Кино", emoji: "🎬", price: 50, status: "pending", created_at: new Date().toISOString() }]);
  put("goals", [{ id: "g1", title: "30 дней зала", emoji: "🎯", reward: "Ужин", habit_id: "h1", target: 30, created_at: "2026-08-01T00:00:00Z" }]);
  put("prefs", { user_id: uid, reminders: true });
  put("places", [
    { id: "pl1", title: "Скамейка у Ц-1", emoji: "🪑", color: "lime", category: "bench", note: "в тени, спиной к дороге", lat: 41.3162, lng: 69.2797, status: "want", created_by: uid, created_at: new Date().toISOString() },
    { id: "pl2", title: "Чайхана на Навои", emoji: "☕️", color: "sand", category: "cafe", lat: 41.3211, lng: 69.2497, status: "visited", visited_at: today, created_by: pid, created_at: new Date().toISOString() },
  ]);
  put("wishlist", [
    { id: "wl1", owner_id: uid, title: "Кроссовки New Balance 530", emoji: "👟", color: "violet", price: 1200000, currency: "сум", url: "https://asaxiy.uz/product/nb530", note: "размер 42, серые", priority: 1, status: "want", position: 1, created_by: uid, created_at: new Date().toISOString() },
    { id: "wl2", owner_id: pid, title: "Наушники", emoji: "🎧", color: "pink", price: 90, currency: "$", status: "want", position: 2, created_by: pid, created_at: new Date().toISOString() },
  ]);
  const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  put("meds", [
    { id: "m1", owner_id: uid, title: "Роаккутан", emoji: "💊", color: "teal", dose: "1 капсула 20 мг после еды", schedule_type: "daily", target_per_week: 7, weekdays: [1,2,3,4,5,6,7], every_n_days: 2, times: ["09:00", "21:00"], start_date: plusDays(-20), end_date: plusDays(100), reminder: true, status: "active", position: 1, created_at: new Date().toISOString() },
    { id: "m2", owner_id: uid, title: "Дифферин", emoji: "🧴", color: "violet", dose: "тонким слоем на ночь", schedule_type: "times_per_week", target_per_week: 4, weekdays: [1,2,3,4,5,6,7], every_n_days: 2, times: ["22:30"], start_date: plusDays(-10), end_date: null, reminder: true, status: "active", position: 2, created_at: new Date().toISOString() },
    { id: "m3", owner_id: uid, title: "Закупка на месяц", emoji: "🛒", color: "amber", schedule_type: "monthly", target_per_week: 7, weekdays: [1,2,3,4,5,6,7], every_n_days: 2, day_of_month: 5, times: ["12:00"], start_date: plusDays(-20), end_date: null, reminder: true, status: "active", position: 3, created_at: new Date().toISOString() },
  ]);
  put("medTakes", [
    { med_id: "m1", user_id: uid, day: today, slot: "09:00", taken_at: new Date().toISOString() },
  ]);
  put("medEvents", [
    { id: "ev1", owner_id: uid, title: "Сдать биохимию крови", emoji: "🧪", kind: "analysis", date: plusDays(38), note: "натощак", done: false, remind_days_before: 3, created_at: new Date().toISOString() },
    { id: "ev2", owner_id: uid, title: "Повторная консультация", emoji: "🩺", kind: "consult", date: plusDays(-2), done: false, remind_days_before: 1, created_at: new Date().toISOString() },
  ]);
  put("tasks", [
    { id: "t1", title: "Купить корм коту", emoji: "🛒", color: "sky", done: false, due_date: today, due_time: "18:00", assignee_id: null, priority: 1, position: 0, created_at: new Date().toISOString() },
    { id: "t2", title: "Записаться к врачу", emoji: "🏥", color: "rose", done: false, due_date: null, assignee_id: uid, priority: 0, position: 1, created_at: new Date().toISOString() },
    { id: "t3", title: "Оплатить интернет", emoji: "💳", color: "mint", done: true, done_at: new Date().toISOString(), done_by: pid, due_date: today, assignee_id: pid, priority: 0, position: 2, created_at: new Date().toISOString() },
  ]);
  return out;
}
