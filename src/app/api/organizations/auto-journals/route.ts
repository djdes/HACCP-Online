import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import {
  parseJournalAutomationJson,
  type JournalAutomationMap,
} from "@/lib/journal-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/organizations/auto-journals
 * Body: { codes: string[] }
 *
 * Сохраняет список templateCode'ов, для которых cron каждый день
 * проверяет наличие активного документа и создаёт новый на текущий
 * месяц если нет. Managed через /settings/auto-journals.
 */
const bodySchema = z.object({
  /** Легаси-формат: только автосоздание. */
  codes: z.array(z.string().min(1)).optional(),
  /**
   * Новый формат: обе половинки автоматики на каждый журнал. Одна
   * таблица в /settings/auto-journals — колонки «автосоздание» и
   * «автозаполнение».
   */
  items: z
    .array(
      z.object({
        code: z.string().min(1),
        autoCreate: z.boolean(),
        /**
         * Необязателен НАМЕРЕННО. Тумблер «создавать журнал на новый
         * период» на странице журнала шлёт только `autoCreate`; передавай
         * он `autoFill: false` — любое его переключение молча выключало бы
         * ежедневное автозаполнение, у которого свой тумблер в документе.
         * Не передан — сохраняем то, что было.
         */
        autoFill: z.boolean().optional(),
      })
    )
    .optional(),
});

/**
 * GET — текущее состояние автоматики по журналам.
 *
 * Нужен переключателю, который стоит в самом документе: он показывается
 * там, где человек работает с журналом, и своего состояния не знает —
 * страница документа про настройки организации ничего не грузит.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const org = await db.organization.findUnique({
    where: { id: getActiveOrgId(session) },
    select: { journalAutomationJson: true },
  });

  return NextResponse.json({
    automation: parseJournalAutomationJson(org?.journalAutomationJson),
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (
    !hasFullWorkspaceAccess({
      role: session.user.role,
      isRoot: session.user.isRoot,
    })
  ) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Некорректный список" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Некорректный список" }, { status: 400 });
  }
  const organizationId = getActiveOrgId(session);

  // Новый формат побеждает: он несёт обе половинки. Легаси `codes`
  // трактуем как «только автосоздание», не трогая автозаполнение —
  // старый клиент про него ничего не знает.
  if (parsed.items) {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { journalAutomationJson: true },
    });
    const map: JournalAutomationMap = parseJournalAutomationJson(
      org?.journalAutomationJson
    );
    for (const item of parsed.items) {
      map[item.code] = {
        autoCreate: item.autoCreate,
        autoFill: item.autoFill ?? map[item.code]?.autoFill ?? false,
      };
    }
    const codes = Object.entries(map)
      .filter(([, value]) => value.autoCreate)
      .map(([code]) => code)
      .sort();
    await db.organization.update({
      where: { id: organizationId },
      data: {
        journalAutomationJson: map as never,
        autoJournalCodes: codes as never,
      },
    });
    return NextResponse.json({ codes, automation: map });
  }

  const unique = Array.from(new Set(parsed.codes ?? []));
  await db.organization.update({
    where: { id: organizationId },
    data: { autoJournalCodes: unique },
  });
  return NextResponse.json({ codes: unique });
}
