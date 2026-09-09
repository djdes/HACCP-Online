import { requireRoot } from "@/lib/auth-helpers";
import { readPlatformStatus } from "@/lib/platform-status";

import { StatusClient } from "./status-client";

export const dynamic = "force-dynamic";

export default async function RootStatusPage() {
  await requireRoot();
  const settings = await readPlatformStatus();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">Статус и объявления</h1>
        <p className="mt-1 max-w-[720px] text-[14px] leading-relaxed text-[#6f7282]">
          Баннер видят все в кабинете и в Mini App, пока он включён и попадает в окно показа;
          закрытый баннер не возвращается, пока не сменится текст. Инциденты — на публичной
          странице <a href="/status" className="underline underline-offset-2" target="_blank" rel="noreferrer">/status</a>.
        </p>
      </div>
      <StatusClient initial={settings} />
    </div>
  );
}
