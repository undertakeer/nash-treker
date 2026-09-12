import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { authSeed } from "./seed.mjs";

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
  for (const [k, v] of Object.entries(authSeed())) window.localStorage.setItem(k, v);
}

// config.js
const cfg = fs.readFileSync(path.join(dist, "config.js"), "utf8");
new Function("window", cfg)(g);

// точку входа берём из index.html: рядом лежат и другие куски сборки
const entry = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
if (!entry) { console.error("в index.html нет модуля-точки входа"); process.exit(1); }
const code = fs.readFileSync(path.join(dist, entry.replace(/^\.?\//, "")), "utf8");

// jsdom не умеет ES-модули, а бандл содержит import.meta (его тянет maplibre)
const shimmed = code.replace(/\bimport\.meta\b/g, "__importMeta");

try {
  new Function("window", "document", "self", "globalThis", "__importMeta", shimmed)(
    g, g.document, g, globalThis, { url: "http://localhost/" },
  );
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
  await click("Лечение");
  await click("Роаккутан");   await click("Отмена");
  await click("Курс");
  await click("События");
  await click("Сдать биохимию"); await click("Отмена");
  await click("Карта");
  // WebGL в jsdom нет, поэтому карта честно уходит в заглушку — проверяем,
  // что экран показал хоть что-то из двух, а не белое пятно
  {
    const t = (g.document.getElementById("root").textContent || "");
    const okMap = g.document.querySelector(".maplibregl-map");
    const okFallback = t.includes("Карта не открылась");
    steps.push(
      okMap || okFallback
        ? `ок: экран карты (${okMap ? "карта" : "заглушка"})`
        : "УПАЛО: экран карты пустой"
    );
  }
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
