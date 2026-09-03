/** Палитра привычек: ключ → человеческое имя и базовый цвет */
export const COLORS = {
  mint:   { label: "Мята",     hex: "#3ED9A4" },
  teal:   { label: "Бирюза",   hex: "#2FD0D4" },
  sky:    { label: "Небо",     hex: "#4EA8FF" },
  indigo: { label: "Индиго",   hex: "#7C8CFF" },
  violet: { label: "Фиалка",   hex: "#A97BFF" },
  pink:   { label: "Розовый",  hex: "#FF7BC5" },
  rose:   { label: "Роза",     hex: "#FF6B8A" },
  coral:  { label: "Коралл",   hex: "#FF8A5B" },
  amber:  { label: "Янтарь",   hex: "#FFC14E" },
  lime:   { label: "Лайм",     hex: "#B6E24A" },
  sand:   { label: "Песок",    hex: "#D9C58A" },
  slate:  { label: "Сталь",    hex: "#9AA6C0" },
};

export const COLOR_KEYS = Object.keys(COLORS);

export function hex(colorKey) {
  return (COLORS[colorKey] || COLORS.mint).hex;
}

export function rgb(colorKey) {
  const h = hex(colorKey).replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgba(colorKey, a) {
  const [r, g, b] = rgb(colorKey);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Фон карточки: тёмный сверху, цветной снизу — как в макете */
export function cardStyle(colorKey, { strong = false } = {}) {
  return {
    background: `linear-gradient(168deg, ${rgba(colorKey, strong ? 0.16 : 0.1)} 0%, ${rgba(
      colorKey,
      strong ? 0.62 : 0.42
    )} 100%), #0F0F14`,
    border: `1px solid ${rgba(colorKey, 0.16)}`,
  };
}

export function glassStyle(colorKey, a = 0.14) {
  return {
    background: rgba(colorKey, a),
    border: `1px solid ${rgba(colorKey, 0.2)}`,
  };
}
