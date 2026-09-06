import { useEffect, useRef, useState } from "react";
import { rgba } from "../lib/theme";

const RECENT_KEY = "nt:emoji-recent";
const RECENT_MAX = 8;

// берём последний символ как единое целое: 👨‍👩‍👧 и 🧑🏽‍💻 — это несколько кодовых точек
function lastGrapheme(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const parts = [...new Intl.Segmenter().segment(s)];
    return parts.length ? parts[parts.length - 1].segment : "";
  }
  const arr = Array.from(s);
  return arr.length ? arr[arr.length - 1] : "";
}

function readRecent() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export default function EmojiPicker({ value, onChange, list, colorKey = "mint", cols = 8, size = 20, maxHeight = 168 }) {
  const [recent, setRecent] = useState(readRecent);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (custom) inputRef.current?.focus();
  }, [custom]);

  const extra = [value, ...recent].filter((e) => e && !list.includes(e));
  const items = [...new Set(extra), ...list];

  function remember(emoji) {
    setRecent((r) => {
      const next = [emoji, ...r.filter((x) => x !== emoji)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* приватный режим — просто не запоминаем */
      }
      return next;
    });
  }

  function applyDraft() {
    const emoji = lastGrapheme(draft);
    if (emoji) {
      onChange(emoji);
      remember(emoji);
    }
    setDraft("");
    setCustom(false);
  }

  return (
    <div>
      <div
        className="grid gap-1.5 overflow-y-auto no-scrollbar p-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxHeight }}
      >
        {items.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onChange(e)}
            className="aspect-square rounded-xl grid place-items-center press"
            style={{
              fontSize: size,
              background: value === e ? rgba(colorKey, 0.28) : "rgba(255,255,255,.05)",
              border: `1px solid ${value === e ? rgba(colorKey, 0.5) : "transparent"}`,
            }}
          >
            {e}
          </button>
        ))}
      </div>

      {custom ? (
        <div className="flex items-center gap-2 mt-2 p-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") { ev.preventDefault(); applyDraft(); } }}
            onBlur={applyDraft}
            placeholder="нажмите 🙂 на клавиатуре"
            className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-white/6 border border-white/10 outline-none
                       placeholder:text-white/25 focus:border-white/25 transition-colors"
          />
          <button
            type="button"
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={applyDraft}
            className="press px-4 py-2.5 rounded-xl bg-white/10 text-[14px] font-bold shrink-0"
          >
            Ок
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCustom(true)}
          className="press w-full mt-2 py-2.5 rounded-xl bg-white/5 border border-dashed border-white/15
                     text-[13.5px] font-semibold text-white/55"
        >
          ➕ Свой смайлик с клавиатуры
        </button>
      )}
    </div>
  );
}
