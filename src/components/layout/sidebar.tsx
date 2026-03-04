"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Settings,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Дашборд",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Журналы",
    href: "/journals",
    icon: ClipboardList,
  },
  {
    label: "Отчёты",
    href: "/reports",
    icon: FileText,
  },
  {
    label: "СанПиН",
    href: "/sanpin",
    icon: BookOpen,
  },
  {
    label: "Настройки",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-white fixed left-0 top-0 z-30">
      <div className="flex h-14 items-center border-b px-6">
        <Link
          href="/dashboard"
          className="text-lg font-bold text-primary"
        >
          HACCP-Online
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-14 items-center border-b px-6">
        <Link
          href="/dashboard"
          className="text-lg font-bold text-primary"
        >
          HACCP-Online
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
