"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type SiteTheme = "dark" | "light";

/**
 * Single shared localStorage key — site, Mini App and any future surface
 * read/write the same value, so toggling the theme in any one of them
 * propagates across tabs/instances on the same device immediately
 * (storage event). The DB column `User.themePreference` syncs across
 * devices on every page-load via the layout's `initialTheme` prop.
 */
const STORAGE_KEY = "wesetup-app-theme";
const ATTRIBUTE = "data-app-theme";
const CUSTOM_EVENT = "wesetup-theme-change";

/** Legacy key used briefly by the Mini App; we read it once for migration. */
const LEGACY_MINI_KEY = "wesetup-mini-theme";

type Ctx = {
  theme: SiteTheme;
  setTheme: (t: SiteTheme) => void;
  toggle: () => void;
};

const SiteThemeContext = createContext<Ctx | null>(null);

function readInitialThemeFromStorage(fallback: SiteTheme): SiteTheme {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
    const legacy = window.localStorage.getItem(LEGACY_MINI_KEY);
    if (legacy === "light" || legacy === "dark") return legacy;
  } catch {
    /* storage blocked */
  }
  return fallback;
}

export function SiteThemeProvider({
  children,
  initialTheme = "light",
}: {
  children: ReactNode;
  /** Server-loaded `User.themePreference`; used as fallback when localStorage is empty. */
  initialTheme?: SiteTheme;
}) {
  const [theme, setThemeState] = useState<SiteTheme>(initialTheme);
  // Skip the first POST after hydration (initialTheme already came from DB).
  const skipNextSyncRef = useRef(true);

  useEffect(() => {
    const fromStorage = readInitialThemeFromStorage(initialTheme);
    setThemeState(fromStorage);
    applyThemeToDOM(fromStorage);
    // localStorage may already have a stale value if user changed theme on
    // another device while this tab was closed — server-loaded initialTheme
    // wins for the duration of this session and replaces localStorage.
    if (fromStorage !== initialTheme) {
      try {
        window.localStorage.setItem(STORAGE_KEY, initialTheme);
      } catch {
        /* ignore */
      }
      setThemeState(initialTheme);
      applyThemeToDOM(initialTheme);
    }
  }, [initialTheme]);

  // Cross-tab/cross-instance sync. If user toggles theme in another tab or
  // in the embedded Mini App, this tab follows.
  useEffect(() => {
    function onCustom(e: Event) {
      const next = (e as CustomEvent<SiteTheme>).detail;
      if (next === "light" || next === "dark") {
        skipNextSyncRef.current = true;
        setThemeState(next);
        applyThemeToDOM(next);
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      if (e.newValue === "light" || e.newValue === "dark") {
        skipNextSyncRef.current = true;
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
    // Persist to DB so other devices pick this up on next page load.
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
    } else {
      void persistThemeToServer(next);
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
  const shells = document.querySelectorAll<HTMLElement>(".app-shell");
  shells.forEach((el) => el.setAttribute(ATTRIBUTE, theme));

  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? "#0b0d1a" : "#ffffff");
  }
}

async function persistThemeToServer(theme: SiteTheme): Promise<void> {
  try {
    await fetch("/api/me/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
      // No need to wait or surface errors — localStorage already carries
      // the value for this device. Cross-device sync is best-effort.
      keepalive: true,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Inline `<script>` that runs before React hydrates and applies the saved
 * theme to all `.app-shell` containers. Без этого light-default
 * пользователи, выбравшие dark, получали бы вспышку белого при каждой
 * навигации.
 */
export function SiteThemeBootstrap() {
  const code = `(function(){try{var k=${JSON.stringify(
    STORAGE_KEY
  )};var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=localStorage.getItem(${JSON.stringify(
    LEGACY_MINI_KEY
  )});}if(t==='light'||t==='dark'){var els=document.querySelectorAll('.app-shell');for(var i=0;i<els.length;i++){els[i].setAttribute(${JSON.stringify(
    ATTRIBUTE
  )},t);}var m=document.querySelector('meta[name="theme-color"]');if(m&&t==='dark'){m.setAttribute('content','#0b0d1a');}}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
