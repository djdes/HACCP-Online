export type TelegramWebAppInlineKeyboard = {
  inline_keyboard: Array<
    Array<{
      text: string;
      web_app: { url: string };
    }>
  >;
};

export function buildTelegramWebAppKeyboard(args: {
  label: string;
  url: string;
}): TelegramWebAppInlineKeyboard {
  return {
    inline_keyboard: [
      [
        {
          text: args.label,
          web_app: { url: args.url },
        },
      ],
    ],
  };
}
