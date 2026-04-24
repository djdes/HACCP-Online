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

const STORAGE_KEY = "wesetup-mini-theme";
const ATTRIBUTE = "data-theme";
const MINI_ROOT_ID = "mini-root";
const CUSTOM_EVENT = "mini-theme-change";

type Ctx = {
  theme: MiniTheme;
  setTheme: (t: MiniTheme) => void;
  toggle: () => void;
};

const MiniThemeContext = createContext<Ctx | null>(null);

function readInitialTheme(): MiniTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    const attr = document
      .getElementById(MINI_ROOT_ID)
      ?.getAttribute(ATTRIBUTE);
    if (attr === "light" || attr === "dark") return attr;
  } catch {
    // sessionStorage/localStorage blocked (private mode) — fall back
  }
  return "dark";
}

export function MiniThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<MiniTheme>("dark");

  // On mount, read the theme that the pre-hydration script already applied
  // to `#mini-root`. This keeps React state synced with whatever the
  // inline bootstrap picked (no flash).
  useEffect(() => {
    const initial = readInitialTheme();
    setThemeState(initial);
    applyThemeToDOM(initial);
  }, []);

  // Cross-tab / cross-component sync — if another instance flips the
  // theme (or the user opens Mini App in two tabs), react to it.
  useEffect(() => {
    function onCustom(e: Event) {
      const next = (e as CustomEvent<MiniTheme>).detail;
      if (next === "light" || next === "dark") setThemeState(next);
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
      // ignore write failures
    }
    try {
      window.dispatchEvent(
        new CustomEvent<MiniTheme>(CUSTOM_EVENT, { detail: next })
      );
    } catch {
      // ignore
    }
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
    // Fallback — provider missing; return a no-op so call sites don't crash
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
  if (el) el.setAttribute(ATTRIBUTE, theme);

  // Sync Telegram WebApp chrome so header/background don't flash
  // through the wrong colour when switching themes.
  const tg = (window as unknown as {
    Telegram?: { WebApp?: TelegramWebAppChrome };
  }).Telegram?.WebApp;
  if (tg) {
    const header = theme === "dark" ? "#0a0b0f" : "#fafbff";
    const bg = theme === "dark" ? "#0a0b0f" : "#fafbff";
    try {
      tg.setHeaderColor?.(header);
      tg.setBackgroundColor?.(bg);
    } catch {
      // older Telegram clients don't expose these
    }
  }
}

type TelegramWebAppChrome = {
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
};

/**
 * Renders a `<script>` that runs before React hydrates and applies the
 * user's saved theme to `#mini-root`. Prevents a dark→light flash on
 * first paint for users who picked light mode. Safe to inline: the
 * script is ~220 bytes and only reads `localStorage`.
 */
export function MiniThemeBootstrap() {
  const code = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    STORAGE_KEY
  )});if(t==='light'||t==='dark'){var el=document.getElementById(${JSON.stringify(
    MINI_ROOT_ID
  )});if(el){el.setAttribute(${JSON.stringify(
    ATTRIBUTE
  )},t);}}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
