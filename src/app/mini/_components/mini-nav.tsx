"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
    <nav
      className="mini-nav-rail fixed inset-x-3 z-50 rounded-3xl"
      style={{
        bottom: "max(12px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto flex w-full max-w-lg items-stretch gap-1 overflow-x-auto px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const isActive =
            item.href === "/mini"
              ? pathname === "/mini"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className="mini-press relative flex min-w-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2"
              style={{
                color: isActive ? "var(--mini-bg)" : "var(--mini-text-muted)",
                background: isActive ? "var(--mini-lime)" : "transparent",
                fontSize: 10,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.02em",
                transition: "background 0.18s, color 0.18s",
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
