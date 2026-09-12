"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Cpu,
  FileText,
  Home,
  Package,
  ShieldCheck,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { visibleNavItems } from "@/app/mini/_lib/nav-items";
import { haptic } from "./use-haptic";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  requires?: string[];
};

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/mini", label: "Главная", icon: Home },
  { href: "/mini/staff", label: "Сотрудники", icon: Users, requires: ["staff.view"] },
  { href: "/mini/equipment", label: "Оборуд.", icon: Package, requires: ["equipment.view"] },
  { href: "/mini/reports", label: "Отчёты", icon: FileText, requires: ["reports.view"] },
  { href: "/mini/audit", label: "Аудит", icon: ShieldCheck, requires: ["dashboard.view"] },
  { href: "/mini/iot", label: "IoT", icon: Cpu, requires: ["equipment.view"] },
  { href: "/mini/shift-handover", label: "Смены", icon: ClipboardList },
  { href: "/mini/me", label: "Профиль", icon: UserRound },
];

/**
 * Последний ответ `/api/mini/session`. Нужен только чтобы первый кадр
 * показал тот же набор вкладок, что и предыдущий запуск.
 *
 * Права из кэша НЕ дают доступа: каждый маршрут проверяет их на сервере
 * (`role-access.ts`). Если права отозвали, человек увидит лишнюю вкладку
 * на долю секунды и упрётся в отказ — это лучше, чем отсутствие
 * навигации на каждой загрузке.
 */
const CACHE_KEY = "wesetup.mini.nav";

type NavCache = { permissions: string[]; mode: string };

function readCache(): NavCache | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NavCache;
    return Array.isArray(parsed?.permissions) && typeof parsed?.mode === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function MiniNav() {
  const pathname = usePathname();
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Кэш читаем после монтирования, а не в инициализаторе состояния:
    // компонент рендерится и на сервере, где localStorage нет, и
    // расхождение разметки дало бы ошибку гидратации.
    const cached = readCache();
    if (cached) {
      setPerms(new Set(cached.permissions));
      setMode(cached.mode);
    }

    fetch("/api/mini/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.permissions) return;
        setPerms(new Set(data.permissions));
        setMode(data.mode);
        try {
          window.localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ permissions: data.permissions, mode: data.mode })
          );
        } catch {
          /* приватный режим — просто не кэшируем */
        }
      })
      .catch(() => {
        /* silent */
      });
  }, []);

  const isManager = mode === "manager";

  // Раньше здесь стоял `if (!perms || !mode) return null` — навигации не
  // было до ответа сервера, и каждая загрузка начиналась с прыжка
  // содержимого. Теперь до ответа показываем вкладки, доступные всем,
  // а остальные достраиваются. Правило вынесено в `_lib/nav-items.ts`
  // и покрыто тестом: ошибка здесь либо прячет навигацию совсем, либо
  // показывает вкладку без прав.
  const visibleItems = visibleNavItems(ALL_NAV_ITEMS, perms, mode);

  // Линейному сотруднику «Главная» — это список журналов.
  const items = visibleItems.map((item) => ({
    ...item,
    label: item.href === "/mini" && perms && !isManager ? "Журналы" : item.label,
  }));

  const activeHref = items.find((item) =>
    item.href === "/mini" ? pathname === "/mini" : pathname.startsWith(item.href)
  )?.href;

  useEffect(() => {
    // Вкладок до восьми, на узком экране активная может оказаться за
    // краем — тогда человек не видит, где находится.
    const rail = railRef.current;
    if (!rail || !activeHref) return;
    const link = rail.querySelector<HTMLElement>(`[data-nav-href="${activeHref}"]`);
    link?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeHref]);

  return (
    <nav
      className="mini-nav-rail fixed inset-x-3 rounded-3xl"
      style={{
        bottom: "var(--mini-safe-b)",
        zIndex: "var(--mini-z-nav)",
      }}
    >
      <div
        ref={railRef}
        className="mx-auto flex w-full max-w-lg items-stretch gap-1 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const isActive = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-nav-href={item.href}
              aria-current={isActive ? "page" : undefined}
              onClick={() => {
                if (!isActive) haptic("selection");
              }}
              className="mini-press relative flex min-w-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2"
              style={{
                color: isActive ? "var(--mini-bg)" : "var(--mini-text-muted)",
                background: isActive ? "var(--mini-lime)" : "transparent",
                fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.02em",
                transition:
                  "background var(--mini-dur-fast) var(--mini-ease), color var(--mini-dur-fast) var(--mini-ease)",
              }}
            >
              <Icon className="size-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
