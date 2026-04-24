/**
 * Minimal typed surface for `window.Telegram.WebApp`.
 *
 * Not using `@twa-dev/sdk` to keep the dependency graph small for Stage 1;
 * if richer SDK features are needed later (haptics, main button, etc.) we
 * can swap this out for the official wrapper.
 */

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: {
    user?: { id: number; first_name?: string; last_name?: string };
  };
  ready(): void;
  expand(): void;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  close?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  showScanQrPopup(params: { text?: string }, callback: (text: string) => void | true): void;
  closeScanQrPopup(): void;
  showPopup(params: {
    title?: string;
    message: string;
    buttons?: Array<{ id?: string; type?: "default" | "ok" | "close" | "cancel" | "destructive"; text: string }>;
  }, callback?: (buttonId: string) => void): void;
  showConfirm(message: string, callback: (confirmed: boolean) => void): void;
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
  };
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}
