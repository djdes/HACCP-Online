/**
 * Звук входящего сообщения — короткий двухтоновый «у-оу» в духе ICQ,
 * синтезируется Web Audio, файла и лицензии не требует.
 *
 * Браузер разрешает звук только после жеста пользователя, поэтому
 * `primeNotificationSound()` вешает одноразовый слушатель на первый
 * клик/клавишу и поднимает AudioContext. Если звук всё ещё заблокирован —
 * молча пропускаем: всплывашка покажется в любом случае.
 */

const MUTE_KEY = "wesetup.support.sound";

let context: AudioContext | null = null;
let primed = false;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  return context;
}

export function primeNotificationSound(): void {
  if (primed || typeof window === "undefined") return;
  primed = true;
  const unlock = () => {
    const ctx = getContext();
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
  };
  window.addEventListener("pointerdown", unlock, { once: true, capture: true });
  window.addEventListener("keydown", unlock, { once: true, capture: true });
}

export function isNotificationSoundMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "off";
  } catch {
    return false;
  }
}

export function setNotificationSoundMuted(muted: boolean): void {
  try {
    if (muted) window.localStorage.setItem(MUTE_KEY, "off");
    else window.localStorage.removeItem(MUTE_KEY);
  } catch {
    /* приватный режим — не запоминаем */
  }
}

function tone(
  ctx: AudioContext,
  at: number,
  fromHz: number,
  toHz: number,
  durationSec: number,
  peak: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(fromHz, at);
  osc.frequency.exponentialRampToValueAtTime(toHz, at + durationSec);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + durationSec + 0.02);
}

/** «У-оу»: два коротких нисходящих слога. Никогда не бросает. */
export function playIncomingChirp(): void {
  if (isNotificationSoundMuted()) return;
  const ctx = getContext();
  if (!ctx || ctx.state !== "running") return;
  try {
    const now = ctx.currentTime + 0.01;
    tone(ctx, now, 780, 620, 0.16, 0.14);
    tone(ctx, now + 0.2, 560, 380, 0.24, 0.14);
  } catch {
    /* звук — не повод ломать страницу */
  }
}
