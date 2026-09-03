const PREFIX = "nt:";

export function readCache(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* приватный режим или переполнение — не критично */
  }
}

export function dropCache(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* пусто */
  }
}
