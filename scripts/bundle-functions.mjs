// Склеивает _shared/push.ts с каждой функцией в один файл: редактор Edge Functions
// в браузере разворачивает одну функцию за раз, соседняя папка ему недоступна.
import fs from "node:fs";
import path from "node:path";

const ROOT = "supabase/functions";
const OUT = path.join(ROOT, "bundled");

const IMPORT_RE = /^import\s[\s\S]*?from\s+"[^"]+";\s*$/gm;

function importsOf(src) {
  return (src.match(IMPORT_RE) || [])
    .map((l) => l.trim())
    .filter((l) => !l.includes("_shared/push.ts"));
}
function stripImports(src) {
  return src.replace(IMPORT_RE, "").replace(/^\s*\n/, "");
}

const shared = fs.readFileSync(path.join(ROOT, "_shared/push.ts"), "utf8");
const sharedBody = stripImports(shared).replace(/^export /gm, "");

fs.mkdirSync(OUT, { recursive: true });

for (const name of ["notify", "cron-reminders"]) {
  const src = fs.readFileSync(path.join(ROOT, name, "index.ts"), "utf8");

  const imports = [...new Set([...importsOf(shared), ...importsOf(src)])];
  const out = [
    `// ${name} — собрано из ${name}/index.ts и _shared/push.ts.`,
    "// Файл сгенерирован: npm run bundle:functions. Править нужно исходники.",
    "",
    imports.join("\n"),
    "",
    "// ────────── _shared/push.ts ──────────",
    "",
    sharedBody.trim(),
    "",
    `// ────────── ${name}/index.ts ──────────`,
    "",
    stripImports(src).trim(),
    "",
  ].join("\n");

  const file = path.join(OUT, `${name}.ts`);
  fs.writeFileSync(file, out);
  console.log(`${file} — ${out.split("\n").length} строк`);
}
