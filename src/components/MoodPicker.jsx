import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MOODS, activeMood, moodAge } from "../lib/moods";
import { hex, rgba } from "../lib/theme";
import { TextInput } from "./ui";

export default function MoodPicker({ profile, onChange, accent = "mint" }) {
  const current = activeMood(profile);
  const [text, setText] = useState(profile?.mood_text || "");

  // подтягиваем чужие правки, пока поле не в фокусе
  useEffect(() => {
    setText(profile?.mood_text || "");
  }, [profile?.mood_text, profile?.mood]);

  function pick(key) {
    if (profile?.mood === key && current) {
      onChange({ mood: null, mood_text: null, mood_at: null });
    } else {
      onChange({ mood: key, mood_at: new Date().toISOString() });
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="text-[13px] font-semibold text-white/45">Настроение</div>
        {current && <div className="text-[12px] text-white/25">{moodAge(profile)}</div>}
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {MOODS.map((m) => {
          const on = current?.key === m.key;
          return (
            <motion.button
              key={m.key}
              whileTap={{ scale: 0.9 }}
              onClick={() => pick(m.key)}
              className="shrink-0 w-[62px] py-2.5 rounded-2xl flex flex-col items-center gap-1"
              style={{
                background: on ? rgba(accent, 0.22) : "rgba(255,255,255,.05)",
                border: `1px solid ${on ? rgba(accent, 0.45) : "transparent"}`,
              }}
            >
              <span className="text-[22px] leading-none">{m.emoji}</span>
              <span
                className="text-[10.5px] font-semibold leading-none"
                style={{ color: on ? hex(accent) : "rgba(255,255,255,.4)" }}
              >
                {m.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {current && (
        <div className="mt-3">
          <TextInput
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 60))}
            onBlur={() => {
              const next = text.trim();
              if (next !== (profile?.mood_text || "")) onChange({ mood_text: next || null });
            }}
            placeholder="Пара слов — увидит партнёр"
            maxLength={60}
          />
        </div>
      )}

      <div className="text-[12px] text-white/25 mt-2">
        Настроение видно партнёру и сбрасывается через сутки.
      </div>
    </div>
  );
}
