"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type MiniTheme = "dark" | "light";

/**
 * Shared with the site (`SiteThemeProvider`) — both providers read/write
 * the same localStorage key, so toggling theme in Mini App propagates to
 * any open `wesetup.ru/dashboard` tab and vice versa via the storage
 * event. DB column `User.themePreference` is the cross-device source of
 * truth, hydrated server-side into `initialTheme` on every layout render.
 */
const STORAGE_KEY = "wesetup-app-theme";
const ATTRIBUTE = "data-theme";
const APP_SHELL_ATTRIBUTE = "data-app-theme";
const MINI_ROOT_ID = "mini-root";
const CUSTOM_EVENT = "wesetup-theme-change";

/** Legacy key — only read for one-time migration. */
const LEGACY_MINI_KEY = "wesetup-mini-theme";

type Ctx = {
  theme: MiniTheme;
  setTheme: (t: MiniTheme) => void;
  toggle: () => void;
};

const MiniThemeContext = createContext<Ctx | null>(null);

function readInitialThemeFromStorage(fallback: MiniTheme): MiniTheme {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    const legacy = window.localStorage.getItem(LEGACY_MINI_KEY);
    if (legacy === "light" || legacy === "dark") return legacy;
    const attr = document
      .getElementById(MINI_ROOT_ID)
      ?.getAttribute(ATTRIBUTE);
    if (attr === "light" || attr === "dark") return attr;
    // D6 — следуем Telegram colorScheme если нет ни сохранённого
    // выбора, ни server-injected initialTheme. У Telegram WebApp
    // есть `colorScheme: "dark" | "light"` — тогда Mini App
    // выглядит как «родная» в Telegram'е.
    const tgScheme = (
      window as unknown as {
        Telegram?: { WebApp?: { colorScheme?: string } };
      }
    ).Telegram?.WebApp?.colorScheme;
    if (tgScheme === "light" || tgScheme === "dark") return tgScheme;
  } catch {
    /* sessionStorage/localStorage blocked */
  }
  return fallback;
}

export function MiniThemeProvider({
  children,
  initialTheme = "dark",
}: {
  children: ReactNode;
  /** Server-loaded `User.themePreference`; used as the seed when
      localStorage is empty (first visit on this device). */
  initialTheme?: MiniTheme;
}) {
  const [theme, setThemeState] = useState<MiniTheme>(initialTheme);

  useEffect(() => {
    // localStorage > server. Once the user picks a theme on this
    // device, that choice survives reload until they explicitly change
    // it. Server NEVER overrides local — иначе сетевой сбой при persist
    // приводил бы к откату темы при reload.
    const fromStorage = readInitialThemeFromStorage(initialTheme);
    setThemeState(fromStorage);
    applyThemeToDOM(fromStorage);

    if (typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === null) {
          window.localStorage.setItem(STORAGE_KEY, fromStorage);
        }
      } catch {
        /* storage blocked */
      }
    }
  }, [initialTheme]);

  useEffect(() => {
    function onCustom(e: Event) {
      const next = (e as CustomEvent<MiniTheme>).detail;
      if (next === "light" || next === "dark") {
        setThemeState(next);
        applyThemeToDOM(next);
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        setThemeState(e.newValue);
        applyThemeToDOM(e.newValue);
      }
    }
    window.addEventListener(CUSTOM_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CUSTOM_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((next: MiniTheme) => {
    setThemeState(next);
    applyThemeToDOM(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(
        new CustomEvent<MiniTheme>(CUSTOM_EVENT, { detail: next })
      );
    } catch {
      /* ignore */
    }
    // Best-effort cross-device sync. Source of truth — localStorage.
    void persistThemeToServer(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return (
    <MiniThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </MiniThemeContext.Provider>
  );
}

export function useMiniTheme(): Ctx {
  const ctx = useContext(MiniThemeContext);
  if (!ctx) {
    return {
      theme: "dark",
      setTheme: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

function applyThemeToDOM(theme: MiniTheme) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(MINI_ROOT_ID);
  if (el) {
    // Mini App уровень — для всех Mini-card/Mini-pill/Mini-btn компонентов.
    el.setAttribute(ATTRIBUTE, theme);
    // App-shell уровень — для site-компонентов, встроенных в Mini App
    // (например site-редактор документа в /mini/documents/[id]). Без
    // этого встроенные `bg-white` карточки сайта оставались белыми,
    // когда Mini App в dark — некрасиво и плохо читаемо.
    el.setAttribute(APP_SHELL_ATTRIBUTE, theme);
  }

  // Sync Telegram WebApp chrome.
  const tg = (
    window as unknown as {
      Telegram?: { WebApp?: TelegramWebAppChrome };
    }
  ).Telegram?.WebApp;
  if (tg) {
    const chrome = theme === "dark" ? "#0a0b0f" : "#fafbff";
    try {
      tg.setHeaderColor?.(chrome);
      tg.setBackgroundColor?.(chrome);
    } catch {
      /* old client — silent */
    }
  }
}

async function persistThemeToServer(theme: MiniTheme): Promise<void> {
  try {
    await fetch("/api/me/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

type TelegramWebAppChrome = {
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

/**
 * Renders a `<script>` that runs before React hydrates and applies the
 * user's saved theme to `#mini-root`. Prevents a dark↔light flash on
 * first paint.
 */
export function MiniThemeBootstrap() {
  const code = `(function(){try{var k=${JSON.stringify(
    STORAGE_KEY
  )};var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=localStorage.getItem(${JSON.stringify(
    LEGACY_MINI_KEY
  )});}if(t==='light'||t==='dark'){var el=document.getElementById(${JSON.stringify(
    MINI_ROOT_ID
  )});if(el){el.setAttribute(${JSON.stringify(
    ATTRIBUTE
  )},t);el.setAttribute(${JSON.stringify(APP_SHELL_ATTRIBUTE)},t);}}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
