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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#ececf4] bg-white/95 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_42px_-34px_rgba(11,16,36,0.75)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-lg gap-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              className={`flex min-w-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 text-[10px] font-medium leading-3 transition active:scale-[0.98] ${
                isActive
                  ? "bg-[#eef1ff] text-[#3848c7]"
                  : "text-[#6f7282] hover:bg-[#fafbff] hover:text-[#0b1024]"
              }`}
            >
              <Icon className="size-4" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
