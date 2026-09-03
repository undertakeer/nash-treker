import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { Button, Field, TextInput } from "../components/ui";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(
        error.message.includes("Invalid login")
          ? "Неверная почта или пароль"
          : error.message.includes("Email not confirmed")
          ? "Аккаунт не подтверждён. В Supabase включите Auto Confirm для пользователя."
          : error.message
      );
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col justify-center px-6 py-12 max-w-[440px] mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-[40px] mb-4">🎰</div>
        <h1 className="text-[30px] font-extrabold leading-tight tracking-tight mb-1.5">
          Наш трекер
        </h1>
        <p className="text-white/40 text-[15px] mb-9">Привычки на двоих</p>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Почта">
            <TextInput
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>
          <Field label="Пароль">
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          {error && (
            <div className="text-[13px] px-4 py-3 rounded-2xl bg-rose-500/12 text-rose-300 leading-relaxed">
              {error}
            </div>
          )}

          <Button type="submit" disabled={busy || !email || !password}>
            {busy ? "Входим…" : "Войти"}
          </Button>
        </form>

        <p className="text-[12.5px] text-white/25 mt-7 leading-relaxed">
          Регистрация закрыта. Аккаунты создаются вручную в панели Supabase.
        </p>
      </motion.div>
    </div>
  );
}
