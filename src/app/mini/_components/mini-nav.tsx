"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram
    ?.WebApp;
  return tg || null;
}

type NavItem = {
  href: string;
  label: string;
  requires?: string[];
};

const ALL_NAV_ITEMS: NavItem[] = [
  { href: "/mini", label: "Главная" },
  { href: "/mini/staff", label: "Сотрудники", requires: ["staff.view"] },
  { href: "/mini/equipment", label: "Оборуд.", requires: ["equipment.view"] },
  { href: "/mini/reports", label: "Отчёты", requires: ["reports.view"] },
  { href: "/mini/me", label: "Профиль" },
];

export function MiniNav() {
  const pathname = usePathname();
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const [mode, setMode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mini/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.permissions) {
          setPerms(new Set(data.permissions));
          setMode(data.mode);
        }
      })
      .catch(() => {
        /* silent */
      });
  }, []);

  if (!perms || !mode) return null;

  const isManager = mode === "manager";

  const visibleItems = ALL_NAV_ITEMS.filter((item) => {
    if (!item.requires) return true;
    // Managers see everything; staff only what they have permission for
    if (isManager) return true;
    return item.requires.some((r) => perms.has(r));
  });

  // For staff without manager permissions, rename "Главная" to "Журналы"
  const items = visibleItems.map((item) => ({
    ...item,
    label:
      item.href === "/mini" && !isManager ? "Журналы" : item.label,
  }));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-lg justify-around border-t border-slate-200 bg-white/95 px-2 py-3 backdrop-blur">
      {items.map((item) => {
        const isActive =
          item.href === "/mini"
            ? pathname === "/mini"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[11px] font-medium transition-colors ${
              isActive ? "text-slate-900" : "text-slate-500"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
