import { buildAssistantPrompt } from "@/lib/assistant/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Системный промпт для исполнителя.
 *
 * Открыт без токена намеренно: это правила поведения ассистента, а не
 * секрет. Прятать их за токеном значит усложнить отладку ради тайны,
 * которую всё равно видно в любом ответе.
 */
export async function GET(request: Request) {
  const mode =
    new URL(request.url).searchParams.get("mode") === "worker"
      ? "worker"
      : "agent";
  return new Response(buildAssistantPrompt(mode), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
