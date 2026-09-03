// Общая часть для обеих функций: отправка web-push и работа со временем.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

export const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
export const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
export const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

/** Клиент с полными правами: сначала новый secret-ключ, потом стандартный service_role */
export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key =
    Deno.env.get("SERVICE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Локальное время пользователя в его часовом поясе */
export function localParts(timezone: string, at = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const weekdayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(hour) * 60 + Number(parts.minute),
    isoWeekday: weekdayMap[parts.weekday] ?? 1,
  };
}

export function hhmmToMinutes(value: string | null | undefined, fallback = 0) {
  if (!value) return fallback;
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Тихие часы могут переходить через полночь */
export function inQuietHours(nowMin: number, from?: string, to?: string) {
  const f = hhmmToMinutes(from, 23 * 60);
  const t = hhmmToMinutes(to, 8 * 60);
  return f <= t ? nowMin >= f && nowMin < t : nowMin >= f || nowMin < t;
}

type Payload = { title: string; body: string; tag?: string; url?: string; habitId?: string };

/** Отправка на все устройства пользователя. Мёртвые подписки удаляются. */
export async function sendToUser(admin: ReturnType<typeof adminClient>, userId: string, payload: Payload) {
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subs?.length) return 0;
  let sent = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 3600, urgency: "normal" },
      );
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("push failed", code, (err as Error).message);
      }
    }
  }
  return sent;
}

/** true, если такое уведомление ещё не отправляли */
export async function claim(admin: ReturnType<typeof adminClient>, userId: string, kind: string, key: string) {
  const { error } = await admin.from("notification_log").insert({ user_id: userId, kind, key });
  return !error;
}

export function shortName(name?: string | null) {
  return (name || "").split(" ")[0] || "Партнёр";
}

export function verb(name: string | null | undefined, male: string, female: string) {
  return /(а|я)$/i.test(name || "") ? female : male;
}
