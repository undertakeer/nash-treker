// Собирается esbuild-ом для units.mjs: браузерные модули с импортами без
// расширений напрямую в Node не подключить. Из stats берём только нужное:
// scheduleLabel есть и там, и в meds, а реэкспорт со звёздочкой такие
// имена молча выбрасывает.
export * from "./src/lib/meds.js";
export { freezesLeftInWeek } from "./src/lib/stats.js";
export * as fin from "./src/lib/finance.js";
