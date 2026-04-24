"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type SiteTheme = "dark" | "light";

const STORAGE_KEY = "wesetup-app-theme";
const ATTRIBUTE = "data-app-theme";
const CUSTOM_EVENT = "wesetup-app-theme-change";

type Ctx = {
  theme: SiteTheme;
  setTheme: (t: SiteTheme) => void;
  toggle: () => void;
};

const SiteThemeContext = createContext<Ctx | null>(null);

function readInitialTheme(): SiteTheme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage blocked */
  }
  return "light";
}

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SiteTheme>("light");

  useEffect(() => {
    const initial = readInitialTheme();
    setThemeState(initial);
    applyThemeToDOM(initial);
  }, []);

  // Cross-tab/cross-instance sync. If the user toggles theme in one tab,
  // any other open dashboard tab follows.
  useEffect(() => {
    function onCustom(e: Event) {
      const next = (e as CustomEvent<SiteTheme>).detail;
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

  const setTheme = useCallback((next: SiteTheme) => {
    setThemeState(next);
    applyThemeToDOM(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    try {
      window.dispatchEvent(
        new CustomEvent<SiteTheme>(CUSTOM_EVENT, { detail: next })
      );
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return (
    <SiteThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </SiteThemeContext.Provider>
  );
}

export function useSiteTheme(): Ctx {
  const ctx = useContext(SiteThemeContext);
  if (!ctx) {
    // Fallback — provider отсутствует (например, когда компонент
    // используется вне dashboard). Возвращаем light без операций.
    return {
      theme: "light",
      setTheme: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

function applyThemeToDOM(theme: SiteTheme) {
  if (typeof document === "undefined") return;
  // Apply to all shells in case of multiple (impersonation banner + nested).
  const shells = document.querySelectorAll<HTMLElement>(".app-shell");
  shells.forEach((el) => el.setAttribute(ATTRIBUTE, theme));

  // Keep the browser UI chrome (address bar on mobile) in sync via
  // <meta name="theme-color">. Landing/auth pages render their own meta,
  // so when we switch back to light-only pages the value is re-used.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0b0d1a" : "#ffffff");
  }
}

/**
 * Renders a `<script>` that runs before React hydrates and applies the
 * user's saved theme to all `.app-shell` containers. Без этого light-default
 * пользователи, выбравшие dark, получали бы вспышку белого при каждой
 * навигации — FOUC особенно заметен на медленных сетях.
 */
export function SiteThemeBootstrap() {
  const code = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    STORAGE_KEY
  )});if(t==='light'||t==='dark'){var els=document.querySelectorAll('.app-shell');for(var i=0;i<els.length;i++){els[i].setAttribute(${JSON.stringify(
    ATTRIBUTE
  )},t);}var m=document.querySelector('meta[name="theme-color"]');if(m&&t==='dark'){m.setAttribute('content','#0b0d1a');}}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
