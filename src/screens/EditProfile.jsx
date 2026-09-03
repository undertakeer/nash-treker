import { useEffect, useState } from "react";
import Sheet from "../components/Sheet";
import Avatar from "../components/Avatar";
import { Button, Field, TextInput } from "../components/ui";
import { useStore } from "../lib/store";
import { useAvatarUpload } from "../lib/useAvatarUpload";
import { COLORS, COLOR_KEYS, hex, rgba } from "../lib/theme";
import { pathFromPublicUrl } from "../lib/image";
import { supabase } from "../lib/supabase";

const EMOJI = ["🙂","😎","🥰","😇","🤓","🦊","🐻","🐱","🐼","🦁","🐧","🐸","🌚","👻","🤖","🐯"];

export default function EditProfile({ open, onClose }) {
  const { me, updateProfile, showToast } = useStore();
  const { pick, input, uploading } = useAvatarUpload();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(me?.display_name || "");
  }, [open, me?.display_name]);

  const accent = me?.accent || "mint";

  function save() {
    const next = name.trim();
    if (next && next !== (me?.display_name || "")) updateProfile({ display_name: next });
    onClose();
  }

  async function dropAvatar() {
    const path = pathFromPublicUrl(me?.avatar_url, "avatars");
    await updateProfile({ avatar_url: null });
    if (path) supabase.storage.from("avatars").remove([path]);
    showToast("Фото убрано", "🗑");
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="px-5 pb-12">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">Профиль</div>
          <button
            onClick={save}
            disabled={!name.trim()}
            className="press text-[15px] font-bold disabled:opacity-30"
            style={{ color: hex(accent) }}
          >
            Готово
          </button>
        </div>

        <div className="flex flex-col items-center py-5">
          <button onClick={pick} className="press relative">
            <Avatar profile={me} size={96} showMood={false} ring />
            <span
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full grid place-items-center text-[14px]"
              style={{ background: hex(accent), color: "#0A0A0E", boxShadow: "0 0 0 3px #111116" }}
            >
              {uploading ? "…" : "📷"}
            </span>
          </button>
          {input}
          <div className="flex gap-4 mt-3">
            <button onClick={pick} className="press text-[13px] font-semibold" style={{ color: hex(accent) }}>
              Выбрать из галереи
            </button>
            {me?.avatar_url && (
              <button onClick={dropAvatar} className="press text-[13px] font-semibold text-white/35">
                Убрать
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Field label="Имя" hint="Так вас видит партнёр">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как вас зовут"
              maxLength={30}
            />
          </Field>

          <Field label="Запасная аватарка" hint="Показывается, пока нет фотографии">
            <div className="grid grid-cols-8 gap-1.5">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  onClick={() => updateProfile({ emoji: e })}
                  className="aspect-square rounded-xl grid place-items-center text-[19px] press"
                  style={{
                    background: me?.emoji === e ? rgba(accent, 0.26) : "rgba(255,255,255,.05)",
                    border: `1px solid ${me?.emoji === e ? rgba(accent, 0.45) : "transparent"}`,
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Мой цвет" hint="Им подсвечены ваши полоски в статистике">
            <div className="flex flex-wrap gap-2.5">
              {COLOR_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => updateProfile({ accent: k })}
                  className="w-9 h-9 rounded-full press"
                  style={{
                    background: hex(k),
                    boxShadow: accent === k ? `0 0 0 2.5px #111116, 0 0 0 4.5px ${hex(k)}` : "none",
                  }}
                  aria-label={COLORS[k].label}
                />
              ))}
            </div>
          </Field>

          <Button onClick={save} disabled={!name.trim()} colorKey={accent}>Готово</Button>
        </div>
      </div>
    </Sheet>
  );
}
