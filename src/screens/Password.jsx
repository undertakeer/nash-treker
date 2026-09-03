import { useEffect, useState } from "react";
import Sheet from "../components/Sheet";
import { Button, Field, TextInput } from "../components/ui";
import { supabase } from "../lib/supabase";
import { useStore } from "../lib/store";

export default function Password({ open, onClose }) {
  const { showToast } = useStore();
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setNext(""); setRepeat(""); setError(""); }
  }, [open]);

  const tooShort = next.length > 0 && next.length < 6;
  const mismatch = repeat.length > 0 && next !== repeat;
  const ready = next.length >= 6 && next === repeat;

  async function save() {
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) {
      setError(
        error.message.includes("should be different")
          ? "Новый пароль совпадает со старым"
          : error.message
      );
      return;
    }
    showToast("Пароль изменён", "🔑");
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-10">
        <div className="flex items-center justify-between py-3">
          <button onClick={onClose} className="press text-[15px] text-white/50 font-medium">Отмена</button>
          <div className="text-[15px] font-bold">Смена пароля</div>
          <span className="w-14" />
        </div>

        <div className="space-y-4 mt-2">
          <Field label="Новый пароль" hint="Минимум 6 символов">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          <Field label="Ещё раз">
            <TextInput
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {(tooShort || mismatch || error) && (
            <div className="text-[13px] px-4 py-3 rounded-2xl bg-rose-500/12 text-rose-300 leading-relaxed">
              {error || (tooShort ? "Пароль короче шести символов" : "Пароли не совпадают")}
            </div>
          )}

          <div className="text-[12.5px] text-white/30 leading-relaxed">
            Почты у аккаунта нет, восстановить пароль письмом не получится.
            Если забудете — новый задаётся в панели Supabase: Authentication → Users → ⋮ → Reset password.
          </div>

          <Button onClick={save} disabled={!ready || busy}>
            {busy ? "Сохраняем…" : "Сменить пароль"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
