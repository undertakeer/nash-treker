// Мгновенные пуши: партнёр отметился / подтолкнул.
// Вызывается из приложения: supabase.functions.invoke("notify", { body: {...} })
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import {
  adminClient, claim, cors, inQuietHours, json, localParts, sendToUser, shortName, verb,
} from "../_shared/push.ts";

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

    const { kind, habit_id, target_id, purchase_id } = await req.json();
    const admin = adminClient();

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
