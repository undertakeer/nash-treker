export const CURRENCIES = ["сум", "$", "€", "₽"];

const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function formatPrice(price, currency = "сум") {
  if (price == null || price === "") return "";
  const n = Number(price);
  if (!Number.isFinite(n)) return "";
  // у доллара и евро знак принято ставить впереди
  return currency === "$" || currency === "€"
    ? `${currency}${nf.format(n)}`
    : `${nf.format(n)} ${currency}`;
}

/** Складываем только одинаковые валюты — курсов мы не знаем */
export function totalByCurrency(items) {
  const sums = new Map();
  items.forEach((i) => {
    const n = Number(i.price);
    if (!Number.isFinite(n) || n <= 0) return;
    const cur = i.currency || "сум";
    sums.set(cur, (sums.get(cur) || 0) + n);
  });
  return [...sums.entries()].map(([currency, sum]) => formatPrice(sum, currency));
}

/** Домен из ссылки — показываем его вместо простыни урла */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function normalizeUrl(raw) {
  const v = (raw || "").trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
