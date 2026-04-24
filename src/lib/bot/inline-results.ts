import { buildMiniAppUrl } from "@/lib/journal-obligation-links";
import { buildTelegramWebAppKeyboard } from "@/lib/telegram-web-app";

type InlineJournal = {
  code: string;
  name: string;
  description: string | null;
};

type InlineEquipment = {
  id: string;
  name: string;
  type: string | null;
};

export function buildInlineQueryResults(args: {
  miniAppBaseUrl: string | null;
  journals: InlineJournal[];
  equipment: InlineEquipment[];
}) {
  const journalResults = args.journals.flatMap((journal) => {
    const url = buildMiniAppUrl(
      args.miniAppBaseUrl,
      `/mini/journals/${journal.code}`
    );
    if (!url) return [];

    return [
      {
        type: "article" as const,
        id: `j_${journal.code}`,
        title: journal.name,
        description: journal.description ?? "Журнал",
        input_message_content: {
          message_text: `Журнал: ${journal.name}`,
        },
        reply_markup: buildTelegramWebAppKeyboard({
          label: "Открыть в Mini App",
          url,
        }),
      },
    ];
  });

  const equipmentResults = args.equipment.flatMap((item) => {
    const url = buildMiniAppUrl(args.miniAppBaseUrl, "/mini/equipment");
    if (!url) return [];

    return [
      {
        type: "article" as const,
        id: `e_${item.id}`,
        title: item.name,
        description: item.type ?? "Оборудование",
        input_message_content: {
          message_text: `Оборудование: ${item.name}`,
        },
        reply_markup: buildTelegramWebAppKeyboard({
          label: "Открыть в Mini App",
          url,
        }),
      },
    ];
  });

  return [...journalResults, ...equipmentResults];
}
