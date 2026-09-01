import { db } from "@/lib/db";
import { resolveAssistantConfig } from "@/lib/assistant/config";
import { failTurn } from "@/lib/assistant/store";

/**
 * Постановка хода в очередь ProjectsFlow.
 *
 * Кладём именно AI-задание (`ai-prompt-jobs`), а НЕ карточку задачи на
 * доску. Карточка на каждый вопрос пользователя завалила бы проект
 * мусором за неделю: вопросов много, каждый живёт минуту, и следа в
 * планировании после себя не оставляет. Очередь заданий невидима на
 * доске и чистится сама.
 *
 * История запросов при этом не теряется — она наша, в `AssistantMessage`,
 * и видна в панели управления. ProjectsFlow здесь только транспорт.
 */

/** Дольше ждать бессмысленно: у хода всё равно 15-минутный токен. */
const DISPATCH_TIMEOUT_MS = 15_000;

export type DispatchResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string };

function buildJobText(args: {
  question: string;
  token: string;
  baseUrl: string;
  messageId: string;
}): string {
  // Плоский текст, а не JSON: у очереди это поле — описание задания, и
  // исполнителю удобнее читать его глазами, когда что-то пошло не так.
  return [
    "Вопрос пользователя Wesetup. Ответь по правилам из prompt_url.",
    "",
    `prompt_url: ${args.baseUrl}/api/assistant/prompt?mode=agent`,
    `context_url: ${args.baseUrl}/api/assistant/context`,
    `reply_url: ${args.baseUrl}/api/assistant/reply`,
    `token: ${args.token}`,
    `message_id: ${args.messageId}`,
    "",
    "Вопрос:",
    args.question,
  ].join("\n");
}

export async function dispatchAssistantTurn(args: {
  messageId: string;
  question: string;
  token: string;
}): Promise<DispatchResult> {
  const config = await resolveAssistantConfig();
  if (!config) {
    const error = "Ассистент сейчас недоступен — интеграция не настроена";
    await failTurn({ messageId: args.messageId, error });
    return { ok: false, error };
  }

  const body = {
    text: buildJobText({
      question: args.question,
      token: args.token,
      baseUrl: config.publicBaseUrl,
      messageId: args.messageId,
    }),
    projectId: config.pfProjectId,
    mode: "assistant",
  };

  try {
    const response = await fetch(`${config.pfApiUrl}/agent/ai-prompt-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.pfToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `ProjectsFlow ответил ${response.status}: ${detail.slice(0, 200)}`
      );
    }

    const data = (await response.json().catch(() => null)) as {
      jobId?: string;
      id?: string;
    } | null;
    const jobId = data?.jobId ?? data?.id ?? null;

    if (jobId) {
      await db.assistantMessage.update({
        where: { id: args.messageId },
        data: { pfJobId: jobId },
      });
    }

    return { ok: true, jobId: jobId ?? "" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось поставить задание";
    console.error("[assistant] dispatch failed:", message);
    // Ход не должен висеть «печатает» до истечения токена, если мы уже
    // знаем, что задание не поставлено.
    await failTurn({
      messageId: args.messageId,
      error: "Не удалось связаться с ассистентом. Попробуйте ещё раз",
    });
    return { ok: false, error: message };
  }
}
