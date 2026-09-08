/** Ташкент — центр карты по умолчанию */
export const TASHKENT = { lat: 41.311081, lng: 69.240562, zoom: 12 };

export const CATEGORIES = [
  { id: "bench",   label: "Скамейка", emoji: "🪑", color: "lime" },
  { id: "cafe",    label: "Кафе",     emoji: "☕️", color: "sand" },
  { id: "food",    label: "Поесть",   emoji: "🍽", color: "amber" },
  { id: "view",    label: "Вид",      emoji: "🌇", color: "coral" },
  { id: "park",    label: "Парк",     emoji: "🌳", color: "mint" },
  { id: "shop",    label: "Магазин",  emoji: "🛍", color: "violet" },
  { id: "event",   label: "Сходить",  emoji: "🎬", color: "indigo" },
  { id: "return",  label: "Вернуться", emoji: "↩️", color: "sky" },
  { id: "other",   label: "Другое",   emoji: "📍", color: "slate" },
];

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES.at(-1);

/** Расстояние по прямой в метрах (формула гаверсинуса) */
export function distanceM(a, b) {
  if (!a || !b) return null;
  const R = 6371e3;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function distanceLabel(m) {
  if (m == null) return "";
  if (m < 950) return `${Math.round(m / 10) * 10} м`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} км`;
}

/** Ссылки в нативные карты — навигацию своими силами делать незачем */
export const yandexUrl = (p) =>
  `https://yandex.uz/maps/?rtext=~${p.lat}%2C${p.lng}&rtt=auto`;
export const googleUrl = (p) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat}%2C${p.lng}`;

export const coordLabel = (p) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
