import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";

const dist = process.argv[2];
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const errors = [];

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;

// заглушки того, чего в jsdom нет
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
window.scrollTo = () => {};
window.fetch = async () => { throw new Error("offline in smoke test"); };
Object.defineProperty(window.navigator, "serviceWorker", {
  configurable: true,
  value: {
    register: async () => ({ scope: "/" }),
    getRegistration: async () => undefined,
    ready: new Promise(() => {}),
    addEventListener() {},
  },
});
Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
class FakeWS {
  constructor() { this.readyState = 0; }
  send() {} close() {} addEventListener() {} removeEventListener() {}
}
FakeWS.CONNECTING = 0; FakeWS.OPEN = 1; FakeWS.CLOSING = 2; FakeWS.CLOSED = 3;
window.WebSocket = FakeWS;
globalThis.WebSocket = FakeWS;

window.onerror = (msg) => errors.push(String(msg));
window.addEventListener("error", (e) => errors.push(String(e.message || e.error)));
window.addEventListener("unhandledrejection", () => {});

const g = window;
for (const key of ["window", "document", "navigator", "location", "localStorage", "HTMLElement", "Element", "Node", "CustomEvent", "Event", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "MutationObserver", "ResizeObserver", "IntersectionObserver"]) {
  if (g[key] !== undefined) globalThis[key] = g[key];
}
globalThis.self = g;

// режим «внутри приложения»: подкладываем сессию, экраны рисуются на кэше
if (process.argv[3] === "auth") {
  const uid = "00000000-0000-4000-8000-000000000001";
  const pid = "00000000-0000-4000-8000-000000000002";
  const future = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
  window.localStorage.setItem("nash-treker-auth", JSON.stringify({
    access_token: "smoke", token_type: "bearer", expires_at: future, expires_in: 31536000,
    refresh_token: "smoke",
    user: { id: uid, email: "izzat@nashtreker.app", aud: "authenticated", role: "authenticated" },
  }));
  const put = (k, v) => window.localStorage.setItem("nt:" + k, JSON.stringify(v));
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
  put("tasks", [
    { id: "t1", title: "Купить корм коту", emoji: "🛒", color: "sky", done: false, due_date: today, due_time: "18:00", assignee_id: null, priority: 1, position: 0, created_at: new Date().toISOString() },
    { id: "t2", title: "Записаться к врачу", emoji: "🏥", color: "rose", done: false, due_date: null, assignee_id: uid, priority: 0, position: 1, created_at: new Date().toISOString() },
    { id: "t3", title: "Оплатить интернет", emoji: "💳", color: "mint", done: true, done_at: new Date().toISOString(), done_by: pid, due_date: today, assignee_id: pid, priority: 0, position: 2, created_at: new Date().toISOString() },
  ]);
}

// config.js
const cfg = fs.readFileSync(path.join(dist, "config.js"), "utf8");
new Function("window", cfg)(g);

const assetDir = path.join(dist, "assets");
const js = fs.readdirSync(assetDir).find((f) => f.endsWith(".js"));
const code = fs.readFileSync(path.join(assetDir, js), "utf8");

try {
  new Function("window", "document", "self", "globalThis", code)(g, g.document, g, globalThis);
} catch (e) {
  errors.push("THROW: " + e.message);
}

await new Promise((r) => setTimeout(r, 900));

const root = g.document.getElementById("root");
const mounted = root && root.innerHTML.trim().length > 0;

// прощёлкиваем экраны и шторки — большинство падений живёт именно там
const steps = [];
if (mounted && process.argv[3] === "auth") {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = async (label, { exact = false } = {}) => {
    const nodes = [...g.document.querySelectorAll('button, [role="button"]')];
    const hit = nodes.find((n) => {
      const t = (n.textContent || "").replace(/\s+/g, " ").trim();
      return exact ? t === label : t.includes(label);
    });
    if (!hit) { steps.push(`НЕ НАЙДЕНО: ${label}`); return false; }
    const before = errors.length;
    hit.dispatchEvent(new g.MouseEvent("click", { bubbles: true, cancelable: true }));
    await sleep(450);
    const text = (g.document.getElementById("root").textContent || "").replace(/\s+/g, " ").trim();
    steps.push(`${errors.length > before ? "УПАЛО" : "ок"}: ${label} → ${text.slice(-70)}`);
    return true;
  };

  await click("Сегодня");
  await click("Задачи");
  await click("Купить корм");   await click("Отмена");
  await click("Карта");
  steps.push(
    g.document.querySelector(".leaflet-container")
      ? "ок: карта поднялась"
      : "УПАЛО: контейнер карты не создан"
  );
  await click("Список");
  await click("Скамейка у Ц-1");
  await click("Изменить");
  await click("Отмена");
  await click("Мы");
  await click("Галерея");   await click("Закрыть");
  await click("Вишлист");
  await click("Кроссовки");  await click("Отмена");
  await click("Закрыть");
  await click("Магазин");   await click("Закрыть");
  await click("Цели");      await click("Закрыть");
  await click("Итоги");     await click("Закрыть");
  await click("Профиль");
  await click("Сменить пароль"); await click("Отмена");
  await click("Уведомления");    await click("Закрыть");
  await click("Привычки");
  await click("Ходить в зал");
  await click("•••", { exact: true });
  await click("Изменить");
  await click("Свой смайлик");   await click("Ок", { exact: true });
  await click("своё", { exact: true });
  await click("Отмена");
}

console.log("смонтировано:", mounted ? "да" : "НЕТ");
console.log("узлов в #root:", root ? root.querySelectorAll("*").length : 0);
if (mounted) {
  const text = root.textContent.replace(/\s+/g, " ").trim().slice(0, 160);
  console.log("текст на экране:", text || "(пусто)");
}
if (steps.length) {
  console.log("\nПРОХОД ПО ЭКРАНАМ:");
  steps.forEach((x) => console.log("  " + x));
}
if (errors.length) {
  console.log("\nОШИБКИ:");
  errors.slice(0, 6).forEach((e) => console.log(" •", e));
}
process.exit(mounted && !errors.length ? 0 : 1);
