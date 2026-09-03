import { useCallback, useRef, useState } from "react";
import { supabase } from "./supabase";
import { useStore } from "./store";
import { pathFromPublicUrl, squareThumb } from "./image";

/** Общая логика загрузки аватарки: выбор из галереи, обрезка, отправка */
export function useAvatarUpload() {
  const { uid, me, updateProfile, showToast } = useStore();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const onFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setUploading(true);
      try {
        const previous = me?.avatar_url;
        const blob = await squareThumb(file);
        const path = `${uid}/avatar-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        await updateProfile({ avatar_url: data.publicUrl });

        // старый файл больше не нужен
        const old = pathFromPublicUrl(previous, "avatars");
        if (old) supabase.storage.from("avatars").remove([old]);

        showToast("Аватарка обновлена", "📸");
      } catch (err) {
        showToast(err.message || "Не удалось загрузить фото", "⚠️");
      } finally {
        setUploading(false);
      }
    },
    [uid, me, updateProfile, showToast]
  );

  const pick = useCallback(() => inputRef.current?.click(), []);

  const input = (
    <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
  );

  return { pick, input, uploading };
}
