import { api } from "./api.js";

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

export const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function currentSubscription() {
  if (!pushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch { return null; }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("Ta przeglądarka nie obsługuje powiadomień web push.");
  const config = await api("/api/push/public-key");
  if (!config.publicKey) throw new Error("Powiadomienia wymagają jeszcze konfiguracji VAPID w Coolify. Instrukcja znajduje się w README projektu.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Nie przyznano zgody na powiadomienia.");
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.publicKey)
  });
  await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription) });
}

export async function disablePush() {
  const subscription = await currentSubscription();
  if (subscription) {
    await api("/api/push/subscribe", { method: "DELETE", body: JSON.stringify({ endpoint: subscription.endpoint }) });
    await subscription.unsubscribe();
  }
}
