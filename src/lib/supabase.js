import { createClient } from "@supabase/supabase-js";

const cfg = window.CONFIG || {};

if (!cfg.url || !cfg.key || cfg.url.startsWith("ВСТАВЬТЕ")) {
  console.error("config.js не заполнен: нужны url и key из Supabase");
}

export const supabase = createClient(cfg.url, cfg.key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "nash-treker-auth",
  },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const VAPID_PUBLIC_KEY = cfg.vapidPublicKey || "";
