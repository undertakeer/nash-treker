/* Настоящий браузер вместо jsdom: только так видно, что карта реально
   отрисовалась. Нужен установленный Chrome. Запуск:
     npm run visual              — по собранной версии (vite preview)
     npm run visual -- <url>     — по любому адресу, например dev-серверу   */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { authSeed } from "./seed.mjs";

const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
].find((p) => fs.existsSync(p));

if (!CHROME) {
  console.log("Chrome не найден — визуальный прогон пропущен");
  process.exit(0);
}

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  console.log("puppeteer-core не установлен — визуальный прогон пропущен");
  process.exit(0);
}

const OUT = "screenshots";
const argUrl = process.argv[2];
let server;
let base = argUrl;

if (!base) {
  server = spawn("npx", ["vite", "preview", "--port", "4173"], { stdio: "ignore" });
  base = "http://localhost:4173";
  await new Promise((r) => setTimeout(r, 3000));
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--hide-scrollbars", "--no-first-run"],
  // близко к iPhone 13 Pro Max, с касаниями — иначе жесты не проверить
  defaultViewport: { width: 428, height: 926, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
});

const page = await browser.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("ОШИБКА JS: " + e.message));
page.on("requestfailed", (r) => {
  const u = r.url();
  if (u.includes("supabase") || u.startsWith("data:")) return; // сеть базы в тесте недоступна
  problems.push(`ЗАПРОС НЕ УДАЛСЯ: ${r.failure()?.errorText} ${u.slice(0, 90)}`);
});
page.on("response", (r) => {
  const u = r.url();
  if (r.status() >= 400 && !u.includes("supabase")) problems.push(`ОТВЕТ ${r.status()}: ${u.slice(0, 110)}`);
});
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("supabase")) problems.push("КОНСОЛЬ: " + m.text().slice(0, 160));
});

const seed = authSeed();
await page.evaluateOnNewDocument((s) => {
  for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
}, seed);

await page.goto(base + "/", { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200));

/** Жмём кнопку по её тексту */
async function tap(label) {
  const ok = await page.evaluate((text) => {
    const nodes = [...document.querySelectorAll('button, [role="button"], a')];
    const hit = nodes.find((n) => (n.textContent || "").replace(/\s+/g, " ").trim().includes(text));
    if (!hit) return false;
    hit.click();
    return true;
  }, label);
  if (!ok) problems.push(`КНОПКА НЕ НАЙДЕНА: ${label}`);
  await new Promise((r) => setTimeout(r, 700));
  return ok;
}

// Содержимое шторки не должно вылезать по горизонтали: иначе её можно
// тянуть влево-вправо и вёрстка съезжает.
async function checkSheetWidth(name) {
  const bad = await page.evaluate(() => {
    const box = document.querySelector("[data-sheet]");
    if (!box) return { missing: true };
    if (box.scrollWidth <= box.clientWidth + 1) return null;
    const wide = [...box.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > box.getBoundingClientRect().right + 1)
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);
    return { over: box.scrollWidth - box.clientWidth, wide };
  });
  if (bad?.missing) problems.push(`ШТОРКА НЕ ОТКРЫЛАСЬ, проверка пропущена: ${name}`);
  else if (bad) problems.push(`ШТОРКА ШИРЕ ЭКРАНА (${name}): на ${bad.over}px, виновники: ${bad.wide.join(", ") || "?"}`);
}

const shots = [];
async function shot(name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
}

// Таб-бар обязан стоять у нижнего края экрана. Он уже дважды уезжал:
// сначала из-за position: fixed, потом из-за прокрутки на html.
async function checkTabBar(where) {
  const r = await page.evaluate(() => {
    const nav = document.querySelector("nav");
    if (!nav) return { missing: true };
    const b = nav.getBoundingClientRect();
    const h = document.documentElement;
    const oy = [getComputedStyle(h).overflowY, getComputedStyle(document.body).overflowY];
    return {
      gap: Math.round(window.innerHeight - b.bottom),
      oy: oy.join("/"),
      pageScrolls: oy.some((v) => v === "auto" || v === "scroll"),
    };
  });
  if (r.missing) problems.push(`ТАБ-БАР НЕ НАЙДЕН (${where})`);
  else if (r.gap > 2) problems.push(`ТАБ-БАР НЕ У НИЗА (${where}): ${r.gap}px до края`);
  // Сама страница прокручиваться не должна: прокрутка живёт внутри main.
  // Иначе на iOS, где 100dvh больше height: 100%, таб-бар уедет под край.
  if (r.pageScrolls) problems.push(`СТРАНИЦА ПРОКРУЧИВАЕТСЯ (${where}): html/body overflow-y = ${r.oy}`);
}

await checkTabBar("привычки");
await shot("01-привычки");
for (const [label, name] of [["Сегодня", "02-сегодня"], ["Задачи", "03-задачи"], ["Лечение", "04-лечение"], ["Деньги", "05-деньги"]]) {
  await tap(label);
  await checkTabBar(name);
  await shot(name);
}

// карта: ждём, пока MapLibre доложит о готовности
await tap("Карта");
const mapState = await page.evaluate(async () => {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (document.body.textContent.includes("Карта не открылась")) return { ok: false, why: "заглушка" };
    const holder = document.querySelector("[data-map]");
    const canvas = document.querySelector(".maplibregl-canvas");
    if (holder?.dataset.map === "ready" && canvas) {
      const c = canvas.getBoundingClientRect();
      const h = holder.getBoundingClientRect();
      // канвас должен занимать весь контейнер: если он 400x300, значит
      // MapLibre снял размер до того, как контейнер его получил
      const fits = Math.abs(c.width - h.width) < 4 && Math.abs(c.height - h.height) < 4;
      await new Promise((r) => setTimeout(r, 2500));
      return fits
        ? { ok: true, w: Math.round(c.width), h: Math.round(c.height) }
        : { ok: false, why: `канвас ${Math.round(c.width)}x${Math.round(c.height)} вместо ${Math.round(h.width)}x${Math.round(h.height)}` };
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return { ok: false, why: "карта не дошла до состояния ready" };
});
await shot("06-карта");

// Жесты: сведение двумя пальцами не должно открывать редактор точки,
// а удержание одним — должно.
const gestures = [];
if (mapState.ok) {
  const cdp = await page.createCDPSession();
  const c = await page.evaluate(() => {
    const r = document.querySelector("[data-map]").getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const editorOpen = () => page.evaluate(() => document.body.textContent.includes("Новое место"));
  const closeEditor = () => tap("Отмена");

  await touch("touchStart", [{ x: c.x - 40, y: c.y, id: 1 }]);
  await pause(40);
  await touch("touchStart", [{ x: c.x - 40, y: c.y, id: 1 }, { x: c.x + 40, y: c.y, id: 2 }]);
  for (let i = 1; i <= 6; i++) {
    await pause(120);
    await touch("touchMove", [
      { x: c.x - 40 - i * 3, y: c.y, id: 1 },
      { x: c.x + 40 + i * 3, y: c.y, id: 2 },
    ]);
  }
  await pause(400);
  await touch("touchEnd", [{ x: c.x - 58, y: c.y, id: 1 }]);
  await touch("touchEnd", []);
  await pause(600);
  if (await editorOpen()) {
    gestures.push("зум двумя пальцами открыл редактор точки");
    await closeEditor();
  }

  await touch("touchStart", [{ x: c.x, y: c.y, id: 1 }]);
  await pause(900);
  await touch("touchEnd", []);
  await pause(700);
  if (await editorOpen()) await closeEditor();
  else gestures.push("удержание одним пальцем не открыло редактор точки");
}

// редакторы проверяем на самом узком айфоне: переполнение по горизонтали
// проявляется там первым
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await new Promise((r) => setTimeout(r, 400));

// прощёлкиваем редакторы: у них больше всего полей и сеток
for (const [open, name] of [
  ["Лечение", "лечение"],
  ["Задачи", "задачи"],
]) {
  await tap(open);
  await tap("+");
  await checkSheetWidth(name === "лечение" ? "новый препарат" : "новая задача");
  await tap("Отмена");
}
await tap("Лечение");
await tap("События");
await tap("+");
await checkSheetWidth("новая событийа");
await tap("Отмена");
await tap("Привычки");
await tap("+");
await checkSheetWidth("новая привычка");
await tap("Отмена");

await page.setViewport({ width: 428, height: 926, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await new Promise((r) => setTimeout(r, 400));

await tap("Мы");
await tap("Вишлист");
await tap("Добавить");
await checkSheetWidth("новая хотелка");
await tap("Отмена");
await tap("Закрыть");
await shot("07-мы");
await tap("Профиль");
await shot("08-профиль");

await browser.close();
if (server) server.kill();

console.log("скриншоты:", shots.join(", "));
console.log(mapState.ok ? `карта: отрисована ${mapState.w}x${mapState.h}` : `КАРТА НЕ ОТРИСОВАНА: ${mapState.why}`);
console.log(gestures.length ? "ЖЕСТЫ: " + gestures.join("; ") : "жесты: зум и удержание разведены");
if (problems.length) {
  console.log("\nЗАМЕЧАНИЯ:");
  for (const p of [...new Set(problems)].slice(0, 20)) console.log(" •", p);
}
const fatal = !mapState.ok || gestures.length || problems.some((p) => p.startsWith("ОШИБКА JS"));
process.exit(fatal ? 1 : 0);
