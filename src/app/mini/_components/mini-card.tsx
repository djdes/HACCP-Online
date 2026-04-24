import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Reusable list-style card for Mini App home + journal entries.
 *
 * Large tap target (64–88 px tall), single-row layout, optional status pill
 * on the right. Deliberately not tied to the dashboard's glossy card style —
 * Mini App lives inside TG's own chrome and needs to feel like a list, not
 * a dashboard widget.
 */
export function MiniCard({
  href,
  title,
  subtitle,
  status,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  status?: { kind: "todo" | "done" | "idle"; label: string };
}) {
  const statusColors =
    status?.kind === "todo"
      ? "bg-[#fff4f2] text-[#a13a32] ring-[#ffd9d3]"
      : status?.kind === "done"
        ? "bg-[#ecfdf5] text-[#116b2a] ring-[#c5f7da]"
        : "bg-[#f5f6ff] text-[#3848c7] ring-[#dcdfed]";

  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-3.5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition active:scale-[0.98] sm:items-center"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium leading-5 text-[#0b1024]">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-1 text-[12px] leading-4 text-[#6f7282]">
            {subtitle}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-start gap-2 self-stretch sm:items-center">
        {status ? (
          <span
            className={`max-w-[110px] rounded-full px-2 py-0.5 text-right text-[11px] font-medium leading-4 ring-1 ${statusColors}`}
          >
            {status.label}
          </span>
        ) : null}
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#9b9fb3] transition group-active:translate-x-0.5 sm:mt-0" />
      </div>
    </Link>
  );
}
