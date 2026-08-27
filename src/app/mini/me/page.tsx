import { MiniMeClient } from "./me-client";

/**
 * Тонкая server-обёртка над клиентским экраном профиля.
 *
 * Нужна ровно ради одного: `TELEGRAM_BOT_USERNAME` — серверная
 * переменная (не NEXT_PUBLIC), а форме обратной связи нужна ссылка на
 * бота. Так же её прокидывает дашборд в `(dashboard)/layout.tsx`.
 */
export default function MiniMePage() {
  return (
    <MiniMeClient
      telegramBotUsername={process.env.TELEGRAM_BOT_USERNAME ?? ""}
    />
  );
}
