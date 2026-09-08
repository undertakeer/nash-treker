import { supabase, VAPID_PUBLIC_KEY } from "./supabase";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

export async function enablePush(userId) {
  if (!pushSupported()) throw new Error("Устройство не поддерживает уведомления");
  if (!VAPID_PUBLIC_KEY) throw new Error("VAPID-ключ не задан в config.js");
  if (isIOS() && !isStandalone()) {
    throw new Error(
      "На iPhone уведомления работают только когда приложение добавлено на экран «Домой» через Safari"
    );
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Уведомления запрещены в настройках");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

/** Сколько устройств этого пользователя лежит в базе */
export async function subscriptionCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return error ? 0 : count || 0;
}

/** Просит сервер прислать пуш самому себе — проверка всей цепочки целиком */
export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke("notify", { body: { kind: "test" } });
  if (!error) return data;

  const status = error.context?.status;
  if (status === undefined) {
    throw new Error("Сервер не отвечает. Функция notify ещё не выложена в Supabase.");
  }
  if (status === 404) {
    throw new Error("Функция notify не найдена — её нужно выложить в Supabase.");
  }
  let detail = "";
  try {
    detail = (await error.context.json())?.error || "";
  } catch {
    /* тело ответа не JSON — покажем что есть */
  }
  throw new Error(detail || error.message || `Сервер ответил ошибкой ${status}`);
}
