import { Composer, type Context } from "grammy";
import { db } from "@/lib/db";

export function registerInlineQueryHandler(composer: Composer<Context>): void {
  composer.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query.trim().toLowerCase();
    const fromId = ctx.from?.id;
    if (!fromId) {
      await ctx.answerInlineQuery([]);
      return;
    }

    // Find linked user
    const user = await db.user.findFirst({
      where: { telegramChatId: String(fromId), isActive: true },
      select: { id: true, organizationId: true },
    });

    if (!user) {
      await ctx.answerInlineQuery([], {
        button: {
          text: "Привязать аккаунт",
          start_parameter: "link",
        },
      });
      return;
    }

    const miniAppBaseUrl = process.env.MINI_APP_BASE_URL ?? "";

    // Search journals
    const journals = await db.journalTemplate.findMany({
      where: {
        isActive: true,
        name: { contains: query, mode: "insensitive" },
      },
      take: 5,
      select: { code: true, name: true, description: true },
    });

    // Search equipment
    const equipment = await db.equipment.findMany({
      where: {
        area: { organizationId: user.organizationId },
        name: { contains: query, mode: "insensitive" },
      },
      take: 5,
      select: { id: true, name: true, type: true },
    });

    const results = [
      ...journals.map((j) => ({
        type: "article" as const,
        id: `j_${j.code}`,
        title: j.name,
        description: j.description ?? "Журнал",
        input_message_content: {
          message_text: `Журнал: ${j.name}`,
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть в Mini App",
                url: `${miniAppBaseUrl}/mini/journals/${j.code}`,
              },
            ],
          ],
        },
      })),
      ...equipment.map((eq) => ({
        type: "article" as const,
        id: `e_${eq.id}`,
        title: eq.name,
        description: eq.type,
        input_message_content: {
          message_text: `Оборудование: ${eq.name}`,
        },
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Открыть в Mini App",
                url: `${miniAppBaseUrl}/mini/equipment`,
              },
            ],
          ],
        },
      })),
    ];

    await ctx.answerInlineQuery(results, { cache_time: 10 });
  });
}
