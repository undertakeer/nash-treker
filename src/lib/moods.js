export const MOODS = [
  { key: "love",    emoji: "🥰", label: "Влюблён",  labelF: "Влюблена" },
  { key: "great",   emoji: "😄", label: "Отлично",  labelF: "Отлично" },
  { key: "fire",    emoji: "🔥", label: "В ударе",  labelF: "В ударе" },
  { key: "ok",      emoji: "🙂", label: "Нормально", labelF: "Нормально" },
  { key: "meh",     emoji: "😐", label: "Так себе", labelF: "Так себе" },
  { key: "tired",   emoji: "😴", label: "Устал",    labelF: "Устала" },
  { key: "sad",     emoji: "😔", label: "Грустно",  labelF: "Грустно" },
  { key: "angry",   emoji: "😤", label: "Злюсь",    labelF: "Злюсь" },
  { key: "sick",    emoji: "🤒", label: "Болею",    labelF: "Болею" },
  { key: "miss",    emoji: "🥺", label: "Скучаю",   labelF: "Скучаю" },
  { key: "busy",    emoji: "🤯", label: "Завал",    labelF: "Завал" },
  { key: "chill",   emoji: "😌", label: "Спокойно", labelF: "Спокойно" },
];

export const MOOD_BY_KEY = Object.fromEntries(MOODS.map((m) => [m.key, m]));

/** Настроение живёт сутки: старое не показываем */
export const MOOD_TTL_MS = 24 * 60 * 60 * 1000;

export function activeMood(profile) {
  if (!profile?.mood) return null;
  const mood = MOOD_BY_KEY[profile.mood];
  if (!mood) return null;
  if (profile.mood_at && Date.now() - new Date(profile.mood_at).getTime() > MOOD_TTL_MS) return null;
  return mood;
}

export function moodLabel(profile) {
  const mood = activeMood(profile);
  if (!mood) return null;
  const female = /(а|я)$/i.test(profile.display_name || "");
  return female ? mood.labelF : mood.label;
}

export function moodAge(profile) {
  if (!profile?.mood_at) return "";
  const mins = Math.round((Date.now() - new Date(profile.mood_at).getTime()) / 60000);
  if (mins < 2) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const h = Math.round(mins / 60);
  return `${h} ч назад`;
}
