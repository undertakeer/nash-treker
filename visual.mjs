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
  // близко к iPhone 13 Pro Max
  defaultViewport: { width: 428, height: 926, deviceScaleFactor: 2 },
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

const shots = [];
async function shot(name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
}

await shot("01-привычки");
for (const [label, name] of [["Сегодня", "02-сегодня"], ["Задачи", "03-задачи"]]) {
  await tap(label);
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
await shot("04-карта");

await tap("Мы");
await shot("05-мы");
await tap("Профиль");
await shot("06-профиль");

await browser.close();
if (server) server.kill();

console.log("скриншоты:", shots.join(", "));
console.log(mapState.ok ? `карта: отрисована ${mapState.w}x${mapState.h}` : `КАРТА НЕ ОТРИСОВАНА: ${mapState.why}`);
if (problems.length) {
  console.log("\nЗАМЕЧАНИЯ:");
  for (const p of [...new Set(problems)].slice(0, 20)) console.log(" •", p);
}
process.exit(mapState.ok && !problems.some((p) => p.startsWith("ОШИБКА JS")) ? 0 : 1);
