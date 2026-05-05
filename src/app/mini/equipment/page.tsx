"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Package, Thermometer } from "lucide-react";

type EquipmentItem = {
  id: string;
  name: string;
  type: string | null;
  areaName: string;
};

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: EquipmentItem[] };

export default function MiniEquipmentPage() {
  const { status } = useSession();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/mini/equipment", { cache: "no-store" })
      .then(async (resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        setState({ kind: "ready", items: data.equipment });
      })
      .catch((err) =>
        setState({ kind: "error", message: err.message || "Ошибка" })
      );
  }, [status]);

  if (state.kind === "loading") {
    return (
      <div
        className="flex flex-1 items-center justify-center text-[14px]"
        style={{ color: "var(--mini-text-muted)" }}
      >
        <Loader2
          className="mr-2 size-4 animate-spin"
          style={{ color: "var(--mini-lime)" }}
        />
        Загружаем…
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div
        className="rounded-2xl px-4 py-4 text-center"
        style={{
          background: "var(--mini-crimson-soft)",
          border: "1px solid rgba(255, 82, 104, 0.24)",
        }}
      >
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--mini-text)" }}
        >
          Ошибка
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--mini-crimson)" }}>
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <header
        className="rounded-3xl px-5 py-5"
        style={{
          background: "var(--mini-card-solid-bg)",
          border: "1px solid var(--mini-divider)",
        }}
      >
        <p
          className="mini-eyebrow"
          style={{ letterSpacing: "0.14em" }}
        >
          Справочник
        </p>
        <h1
          className="mt-1 text-[22px] font-semibold tracking-[-0.02em]"
          style={{ color: "var(--mini-text)" }}
        >
          Оборудование
        </h1>
      </header>

      <section className="space-y-2">
        {state.items.length === 0 ? (
          <div
            className="rounded-3xl px-4 py-7 text-center text-[14px]"
            style={{
              background: "var(--mini-surface-1)",
              border: "1px dashed var(--mini-divider-strong)",
              color: "var(--mini-text-muted)",
            }}
          >
            Пока нет оборудования.
          </div>
        ) : (
          state.items.map((item: EquipmentItem) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{
                background: "var(--mini-card-solid-bg)",
                border: "1px solid var(--mini-divider)",
              }}
            >
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: "var(--mini-lime-soft)",
                  color: "var(--mini-lime)",
                }}
              >
                {item.type?.toLowerCase().includes("темп") ? (
                  <Thermometer className="size-5" />
                ) : (
                  <Package className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className="truncate text-[15px] font-medium"
                  style={{ color: "var(--mini-text)" }}
                >
                  {item.name}
                </p>
                <p
                  className="text-[13px]"
                  style={{ color: "var(--mini-text-muted)" }}
                >
                  {item.type || "—"} · {item.areaName}
                </p>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
