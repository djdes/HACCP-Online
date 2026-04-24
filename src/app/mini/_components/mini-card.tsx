import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

/**
 * Editorial list-card для Mini App — dark theme, mono-index на левом
 * краю, pill-статус справа, press-haptic scale-down. Использует theme
 * tokens из `mini-theme.css`.
 */
export function MiniCard({
  href,
  title,
  subtitle,
  status,
  index,
}: {
  href: string;
  title: string;
  subtitle?: string | null;
  status?: { kind: "todo" | "done" | "idle"; label: string };
  /** 1-based порядковый номер для mono-префикса слева. */
  index?: number;
}) {
  const tone =
    status?.kind === "todo"
      ? "amber"
      : status?.kind === "done"
        ? "lime"
        : "neutral";

  return (
    <Link
      href={href}
      className="mini-press mini-card group flex items-stretch gap-3 px-3.5 py-3"
    >
      {/* Vertical index numeral — mono */}
      {typeof index === "number" ? (
        <div
          className="flex w-6 shrink-0 items-start pt-0.5"
          style={{
            fontFamily: "var(--mini-font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--mini-text-faint)",
          }}
        >
          {String(index).padStart(2, "0")}
        </div>
      ) : null}

      <div className="min-w-0 flex-1 py-0.5">
        <div
          className="truncate"
          style={{
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.25,
            color: "var(--mini-text)",
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            className="mt-1 line-clamp-2"
            style={{
              fontSize: 12,
              lineHeight: 1.35,
              color: "var(--mini-text-muted)",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2">
        {status ? (
          <span className="mini-pill" data-tone={tone}>
            {status.label}
          </span>
        ) : (
          <span />
        )}
        <ArrowUpRight
          className="size-3.5 transition-transform group-active:translate-x-0.5 group-active:-translate-y-0.5"
          style={{ color: "var(--mini-text-faint)" }}
          strokeWidth={2}
        />
      </div>
    </Link>
  );
}
