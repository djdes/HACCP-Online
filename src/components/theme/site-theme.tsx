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
  /** Server-loaded `User.themePreference`; used as the seed when
      localStorage is empty (first visit on this device). After that
      localStorage wins and survives reloads/SSR mismatches. */
  initialTheme?: SiteTheme;
}) {
  const [theme, setThemeState] = useState<SiteTheme>(initialTheme);

  useEffect(() => {
    // localStorage > server initialTheme. Если в этом браузере уже был
    // выбор — он живёт до момента, когда пользователь сам переключит
    // тему через настройки. Сервер NEVER overrides local choice — иначе
    // сетевой сбой при persist приводил бы к откату темы при reload
    // (баг 2026-04-25 «при reload тема слетает на светлую»).
    const fromStorage = readInitialThemeFromStorage(initialTheme);
    setThemeState(fromStorage);
    applyThemeToDOM(fromStorage);

    // Seed localStorage из initialTheme на самой первой загрузке (когда
    // ключа ещё нет) — чтобы offline / другие табы видели тот же выбор.
    if (typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === null) {
          window.localStorage.setItem(STORAGE_KEY, fromStorage);
        }
      } catch {
        /* storage blocked — ничего не делаем */
      }
    }
  }, [initialTheme]);

  // Cross-tab/cross-instance sync. If user toggles theme in another tab or
  // in the embedded Mini App, this tab follows.
  useEffect(() => {
    function onCustom(e: Event) {
      const next = (e as CustomEvent<SiteTheme>).detail;
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
    // Persist в БД best-effort — для cross-device sync на новом устройстве.
    // На текущем устройстве источник истины — localStorage, поэтому если
    // fetch упадёт, тема всё равно сохранится локально.
    void persistThemeToServer(next);
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
