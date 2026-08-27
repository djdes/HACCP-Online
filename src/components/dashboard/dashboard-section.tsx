import { ChevronDown, type LucideIcon } from "lucide-react";

type Props = {
  /** Уникальный ключ для localStorage. Inline-скрипт в dashboard
   *  layout читает все [data-storage-key] и подменяет open. */
  storageKey: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    tone?: "default" | "ok" | "warn" | "danger";
  };
  defaultOpen?: boolean;
  /**
   * Действия в шапке секции — встают справа от заголовка, перед
   * стрелкой. Занимают уже существующую пустую строку вместо того,
   * чтобы заводить под себя новую.
   *
   * Клик по ним не должен сворачивать секцию: элемент лежит внутри
   * <summary>, поэтому содержимое обязано само гасить событие.
   */
  actions?: React.ReactNode;
  children: React.ReactNode;
};

const TONE_CLS: Record<NonNullable<Props["badge"]>["tone"] & string, string> = {
  default: "bg-[#eef1ff] text-[#3848c7]",
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
};

/**
 * Раскрывающаяся секция дашборда. Server-component с native
 * `<details>` — работает с любыми children (включая async
 * server-components), не требует client JS bundle, лёгкий SSR.
 *
 * Persist в localStorage реализован через inline-скрипт в
 * dashboard layout (см. <DashboardSectionPersistScript />): он
 * читает все [data-storage-key] и устанавливает initial open
 * state, и на toggle event пишет обратно в localStorage.
 */
export function DashboardSection({
  storageKey,
  title,
  subtitle,
  icon: Icon,
  badge,
  defaultOpen = false,
  actions,
  children,
}: Props) {
  return (
    <details
      // open — нужно прокинуть как boolean prop (не через open={false})
      // т.к. в JSX для native HTML element атрибут принимается как
      // boolean (presence/absence). Используем conditional spread.
      {...(defaultOpen ? { open: true } : {})}
      data-storage-key={storageKey}
      className="group overflow-hidden rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
    >
      {/* items-center: иконка 40px и заголовок выравниваются друг по
          другу. При items-start однострочный заголовок прижимался к
          верху и стоял выше центра иконки. */}
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition-colors hover:bg-[#fafbff] sm:p-5">
        {/* Иконка входит В левую группу: снаружи она делала левую
            сторону шире правой на свою ширину плюс отступ. */}
        <div className="flex min-w-0 items-center gap-3 sm:w-[430px] sm:shrink-0">
          {Icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
              <Icon className="size-5" />
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024] sm:text-[16px]">
                {title}
              </h3>
              {badge ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE_CLS[badge.tone ?? "default"]}`}
                >
                  {badge.text}
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-0.5 text-[12px] leading-snug text-[#6f7282] sm:text-[13px]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>

        {/* Распорка между группами: слева и справа по 430px, всё лишнее
            место уходит сюда — заголовок и действия оказываются на
            одинаковом расстоянии от краёв. */}
        <div className="hidden flex-1 sm:block" />

        {/* Стрелка входит В правую группу, а не стоит за ней: иначе
            правая сторона была шире левой ровно на её ширину плюс
            отступ, и симметрия ломалась. */}
        <div className="flex shrink-0 items-center justify-end gap-3 sm:w-[430px]">
          {actions}
          <ChevronDown
            className="size-5 shrink-0 text-[#9b9fb3] transition-transform group-open:rotate-180 group-open:text-[#5566f6]"
            aria-hidden
          />
        </div>
      </summary>
      <div className="border-t border-[#ececf4] p-4 sm:p-5">{children}</div>
    </details>
  );
}

/**
 * Inline-скрипт для localStorage persist. Размещается ОДИН раз в
 * dashboard layout / page. Читает все [data-storage-key] на mount,
 * устанавливает open state из localStorage; на toggle — пишет
 * обратно. Без зависимости от React — работает даже если client JS
 * ещё не загрузился.
 */
export function DashboardSectionPersistScript() {
  const script = `
(function(){
  try {
    var prefix = 'wesetup.dashboard.section.';
    function apply() {
      document.querySelectorAll('details[data-storage-key]').forEach(function(d){
        if (d.__persistAttached) return;
        d.__persistAttached = true;
        var key = prefix + d.dataset.storageKey;
        var saved = null;
        try { saved = localStorage.getItem(key); } catch(e) {}
        if (saved === '1') d.open = true;
        else if (saved === '0') d.open = false;
        d.addEventListener('toggle', function(){
          try { localStorage.setItem(key, d.open ? '1' : '0'); } catch(e) {}
        });
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      apply();
    }
    // Re-apply при router-navigation внутри Next (SPA), иначе attach не
    // случится при F5 на другую страницу + back.
    document.addEventListener('visibilitychange', apply);
  } catch (e) { /* fail silently */ }
})();`;
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
