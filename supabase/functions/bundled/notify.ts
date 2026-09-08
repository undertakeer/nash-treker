// notify — собрано из notify/index.ts и _shared/push.ts.
// Файл сгенерирован: npm run bundle:functions. Править нужно исходники.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

// ────────── _shared/push.ts ──────────

// Общая часть для обеих функций: отправка web-push и работа со временем.


const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

/** Клиент с полными правами: сначала новый secret-ключ, потом стандартный service_role */
function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key =
    Deno.env.get("SERVICE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Локальное время пользователя в его часовом поясе */
function localParts(timezone: string, at = new Date()) {
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

function hhmmToMinutes(value: string | null | undefined, fallback = 0) {
  if (!value) return fallback;
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Тихие часы могут переходить через полночь */
function inQuietHours(nowMin: number, from?: string, to?: string) {
  const f = hhmmToMinutes(from, 23 * 60);
  const t = hhmmToMinutes(to, 8 * 60);
  return f <= t ? nowMin >= f && nowMin < t : nowMin >= f || nowMin < t;
}

type Payload = { title: string; body: string; tag?: string; url?: string; habitId?: string };

/** Отправка на все устройства пользователя. Мёртвые подписки удаляются. */
async function sendToUser(admin: ReturnType<typeof adminClient>, userId: string, payload: Payload) {
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
async function claim(admin: ReturnType<typeof adminClient>, userId: string, kind: string, key: string) {
  const { error } = await admin.from("notification_log").insert({ user_id: userId, kind, key });
  return !error;
}

function shortName(name?: string | null) {
  return (name || "").split(" ")[0] || "Партнёр";
}

function verb(name: string | null | undefined, male: string, female: string) {
  return /(а|я)$/i.test(name || "") ? female : male;
}

// ────────── notify/index.ts ──────────

// Мгновенные пуши: партнёр отметился / подтолкнул.
// Вызывается из приложения: supabase.functions.invoke("notify", { body: {...} })


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { data: userData } = await anon.auth.getUser();
    const actorId = userData?.user?.id;
    if (!actorId) return json({ error: "unauthorized" }, 401);

    const { kind, habit_id, target_id, purchase_id, place_id } = await req.json();
    const admin = adminClient();

    // проверка связи: пуш самому себе, чтобы видеть, где рвётся цепочка
    if (kind === "test") {
      const sent = await sendToUser(admin, actorId, {
        title: "🔔 Проверка связи",
        body: "Уведомления работают. Примерно так они и будут выглядеть.",
        tag: "test",
      });
      return json({ ok: true, sent });
    }

    // покупка желания: партнёру прилетает заказ на исполнение
    if (kind === "purchase") {
      const { data: purchase } = await admin
        .from("purchases").select("*").eq("id", purchase_id).maybeSingle();
      if (!purchase) return json({ error: "purchase not found" }, 404);

      const { data: people } = await admin.from("profiles").select("*");
      const buyer = people?.find((p) => p.id === purchase.buyer_id);
      const others = people?.filter((p) => p.id !== purchase.buyer_id) ?? [];
      let done = 0;
      for (const person of others) {
        done += await sendToUser(admin, person.id, {
          title: `${purchase.emoji} ${purchase.title}`,
          body: `${shortName(buyer?.display_name)} ${verb(buyer?.display_name, "потратил", "потратила")} ${purchase.price} баллов — пора исполнять`,
          tag: `purchase-${purchase.id}`,
        });
      }
      return json({ ok: true, sent: done });
    }

    // новое место на карте: партнёру прилетает, что и где отметили
    if (kind === "place") {
      const { data: place } = await admin
        .from("places").select("*").eq("id", place_id).maybeSingle();
      if (!place) return json({ error: "place not found" }, 404);

      const { data: people } = await admin.from("profiles").select("*");
      const author = people?.find((p) => p.id === place.created_by);
      const others = people?.filter((p) => p.id !== place.created_by) ?? [];
      let done = 0;
      for (const person of others) {
        const { data: prefs } = await admin
          .from("notification_prefs").select("*").eq("user_id", person.id).maybeSingle();
        if (prefs?.places === false) continue;
        const { minutes } = localParts(person.timezone || "UTC");
        if (inQuietHours(minutes, prefs?.quiet_from, prefs?.quiet_to)) continue;

        done += await sendToUser(admin, person.id, {
          title: `${place.emoji} ${place.title}`,
          body: `${shortName(author?.display_name)} ${verb(author?.display_name, "отметил", "отметила")} место на карте`,
          tag: `place-${place.id}`,
        });
      }
      return json({ ok: true, sent: done });
    }

    const [{ data: habit }, { data: profiles }] = await Promise.all([
      admin.from("habits").select("*").eq("id", habit_id).maybeSingle(),
      admin.from("profiles").select("*"),
    ]);
    if (!habit) return json({ error: "habit not found" }, 404);

    const actor = profiles?.find((p) => p.id === actorId);
    const actorName = shortName(actor?.display_name);

    const recipients = (target_id
      ? profiles?.filter((p) => p.id === target_id)
      : profiles?.filter((p) => p.id !== actorId)) ?? [];

    let sent = 0;

    for (const person of recipients) {
      const { data: prefs } = await admin
        .from("notification_prefs").select("*").eq("user_id", person.id).maybeSingle();

      if (kind === "partner_checkin" && prefs?.partner_checkins === false) continue;
      if (kind === "nudge" && prefs?.nudges === false) continue;

      // личные привычки чужого человека не поводом для пуша
      if (kind === "partner_checkin" && habit.kind !== "shared") continue;

      const { minutes, date } = localParts(person.timezone || "UTC");
      // подталкивание проходит даже в тихие часы — это осознанное действие человека
      if (kind !== "nudge" && inQuietHours(minutes, prefs?.quiet_from, prefs?.quiet_to)) continue;

      const key = `${kind}:${habit.id}:${actorId}:${date}`;
      if (kind === "partner_checkin" && !(await claim(admin, person.id, kind, key))) continue;

      const payload = kind === "nudge"
        ? {
            title: `${habit.icon} ${habit.title}`,
            body: `${actorName} напоминает 👋`,
            tag: `nudge-${habit.id}`,
            habitId: habit.id,
          }
        : {
            title: `${habit.icon} ${habit.title}`,
            body: `${actorName} ${verb(actor?.display_name, "выполнил", "выполнила")} — ваша очередь`,
            tag: `checkin-${habit.id}`,
            habitId: habit.id,
          };

      sent += await sendToUser(admin, person.id, payload);
    }

    return json({ ok: true, sent });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});
