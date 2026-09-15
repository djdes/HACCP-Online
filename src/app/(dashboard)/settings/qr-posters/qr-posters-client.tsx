"use client";

import Link from "next/link";
import { Printer, QrCode, Refrigerator, Warehouse } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export type QrPoster = {
  id: string;
  kind: "room" | "equipment";
  title: string;
  subtitle: string;
  norms: string[];
  url: string;
  svg: string;
  /** ISO-дата, до которой код принимается. */
  expiresAt: string | null;
};

const STEPS = [
  "Наведите камеру телефона на код.",
  "Выберите своё имя и введите показания.",
  "Нажмите «Сохранить» — запись попадёт в журнал за сегодня.",
];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("ru-RU");
}

export function QrPostersClient({
  kind,
  posters,
  origin,
  documentTitle,
  documentId,
}: {
  kind: "rooms" | "equipment";
  posters: QrPoster[];
  origin: string;
  documentTitle: string | null;
  documentId: string | null;
}) {
  const tabs = [
    { kind: "rooms" as const, label: "Склады и помещения", icon: Warehouse },
    { kind: "equipment" as const, label: "Холодильники и оборудование", icon: Refrigerator },
  ];

  return (
    <div className="space-y-5 print:space-y-0">
      <div className="space-y-5 print:hidden">
        <PageHeader
          title="QR-плакаты"
          description={
            documentTitle
              ? `Плакаты для объектов документа «${documentTitle}». По одному на лист A4.`
              : "Плакат A4 с QR-кодом на каждый склад или холодильник. Сотрудник сканирует код и вносит показание без входа в кабинет."
          }
          actions={
            <button
              type="button"
              onClick={() => window.print()}
              disabled={posters.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors duration-150 hover:bg-[#4a5bf0] disabled:bg-[#c8cbe0] disabled:shadow-none"
            >
              <Printer className="size-4" />
              Распечатать
            </button>
          }
        />

        {documentId ? null : (
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.kind === kind;
              return (
                <Link
                  key={tab.kind}
                  href={`/settings/qr-posters?kind=${tab.kind}`}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-[14px] font-medium transition-colors duration-150",
                    active
                      ? "border-[#5566f6] bg-[#eef1ff] text-[#3848c7]"
                      : "border-[#dcdfed] bg-white text-[#0b1024] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                  )}
                >
                  <Icon className="size-4 text-[#5566f6]" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 text-[13px] leading-[1.55] text-[#3c4053]">
          <b className="font-semibold text-[#0b1024]">Как это работает.</b> Распечатайте плакаты и повесьте у входа в
          помещение или на дверцу холодильника. Показание ложится в активный журнал за сегодня — в ближайший срок
          контроля. Если на сегодня журнала нет, телефон попросит сначала создать документ. Под каждым кодом указано, до
          какого числа он действует; перед этой датой распечатайте плакаты заново.
          <span className="mt-1 block text-[12px] text-[#9b9fb3]">Домен ссылок: {origin.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>

      {posters.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center print:hidden">
          <div className="text-[15px] font-medium text-[#0b1024]">
            {documentTitle
              ? kind === "rooms"
                ? "В документе нет помещений из «Точек и помещений»"
                : "В документе нет оборудования из «Оборудования»"
              : kind === "rooms"
                ? "Помещений пока нет"
                : "Оборудования пока нет"}
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-[#6f7282]">
            {documentTitle ? (
              // Плакаты открыты из журнала: список ограничен строками документа,
              // а объекты в справочнике при этом могут быть.
              <>
                Плакаты открыты из документа «{documentTitle}»: показываются только его строки, связанные со
                справочником, а таких нет. Добавьте объект в документ из справочника или{" "}
                <Link
                  href={`/settings/qr-posters?kind=${kind}`}
                  className="font-medium text-[#3848c7] underline underline-offset-2"
                >
                  {kind === "rooms" ? "откройте плакаты всех помещений" : "откройте плакаты всего оборудования"}
                </Link>
                .
              </>
            ) : kind === "rooms" ? (
              <>
                Добавьте склады и цеха в{" "}
                <Link href="/settings/buildings" className="font-medium text-[#3848c7] underline underline-offset-2">
                  «Точки и помещения»
                </Link>
                — плакаты появятся здесь.
              </>
            ) : (
              <>
                Добавьте холодильники в{" "}
                <Link href="/settings/equipment" className="font-medium text-[#3848c7] underline underline-offset-2">
                  «Оборудование»
                </Link>
                — плакаты появятся здесь.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="qr-posters-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {posters.map((poster) => {
            const expires = formatDate(poster.expiresAt);
            return (
              <article
                key={poster.id}
                data-qr-poster=""
                data-qr-url={poster.url}
                data-qr-kind={poster.kind}
                data-qr-id={poster.id}
                className="qr-poster flex flex-col items-center rounded-3xl border border-[#ececf4] bg-white p-6 text-center shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
              >
                <div className="qr-poster-eyebrow inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                  <QrCode className="size-3.5 text-[#5566f6]" />
                  {poster.kind === "room" ? "Температура и влажность" : "Температура"}
                </div>
                <h2 className="qr-poster-title mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#0b1024]">
                  {poster.title}
                </h2>
                <div className="qr-poster-subtitle mt-1 text-[13px] text-[#6f7282]">
                  {poster.subtitle}
                  {poster.norms.length > 0 ? ` · норма ${poster.norms.join(", ")}` : ""}
                </div>
                <div
                  className="qr-box mx-auto mt-4 w-full max-w-[220px] rounded-2xl border border-[#ececf4] bg-white p-2"
                  // SVG собран на сервере библиотекой qrcode — безопасно встраивать.
                  dangerouslySetInnerHTML={{ __html: poster.svg }}
                />
                <ol className="qr-poster-steps mt-4 w-full space-y-1 text-left text-[13px] leading-[1.5] text-[#3c4053]">
                  {STEPS.map((step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="font-semibold tabular-nums text-[#3848c7]">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                {expires ? (
                  <div className="qr-poster-expires mt-3 text-[11px] text-[#9b9fb3]">Код действует до {expires}</div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        .qr-box svg { display: block; width: 100%; height: auto; }
        @media print {
          @page { size: A4 portrait; margin: 14mm; }
          html, body { background: #fff !important; }
          header, nav, footer, .screen-only { display: none !important; }
          main { padding: 0 !important; }
          .qr-posters-grid { display: block !important; }
          .qr-poster {
            box-sizing: border-box;
            min-height: calc(297mm - 28mm - 4mm);
            justify-content: center;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            break-inside: avoid;
            page-break-inside: avoid;
            break-after: page;
            page-break-after: always;
          }
          .qr-poster:last-child { break-after: auto; page-break-after: auto; }
          .qr-poster-eyebrow { font-size: 12pt; }
          .qr-poster-title { font-size: 30pt; margin-top: 6mm; }
          .qr-poster-subtitle { font-size: 14pt; margin-top: 3mm; }
          .qr-box { width: 110mm !important; max-width: none !important; border: 0 !important; margin-top: 10mm; }
          .qr-poster-steps { font-size: 15pt; width: 150mm; margin-top: 10mm; }
          .qr-poster-expires { font-size: 10pt; margin-top: 6mm; }
        }
      `}</style>
    </div>
  );
}
