export type TelegramStartReply = {
  text: string;
  buttonLabel?: string;
  buttonUrl?: string;
};

export type TelegramLinkedStartState =
  | {
      name: string;
      role: string;
      isRoot: boolean;
      kind: "staff";
      nextActionLabel: string | null;
    }
  | {
      name: string;
      role: string;
      isRoot: boolean;
      kind: "manager";
      pendingCount: number;
      employeesWithPending: number;
    };

export const TELEGRAM_COMMANDS = [
  {
    command: "start",
    description: "Открыть Wesetup",
  },
] as const;

export function buildTelegramLinkedStartReply(
  state: TelegramLinkedStartState,
  buttonUrl: string | null
): TelegramStartReply {
  if (!buttonUrl) {
    return {
      text: `Готово, ${state.name}. Мини-приложение пока не настроено, свяжитесь с руководителем.`,
    };
  }

  if (state.kind === "manager") {
    return {
      text:
        `Здравствуйте, ${state.name}.\n\n` +
        `Открыто задач: ${state.pendingCount}\n` +
        `Сотрудников с открытыми задачами: ${state.employeesWithPending}\n\n` +
        `Откройте Wesetup кнопкой ниже.`,
      buttonLabel: "Открыть кабинет",
      buttonUrl,
    };
  }

  return {
    text:
      `Готово, ${state.name}!\n\n` +
      (state.nextActionLabel
        ? `Следующее действие: ${state.nextActionLabel}\n\n`
        : `На сегодня обязательные журналы уже закрыты.\n\n`) +
      `Откройте Wesetup кнопкой ниже.`,
    buttonLabel: state.nextActionLabel ? "Открыть задачу" : "Открыть журналы",
    buttonUrl,
  };
}

export function buildTelegramUnlinkedStartReply(): TelegramStartReply {
  return {
    text: "Аккаунт пока не привязан. Откройте персональную ссылку из приглашения руководителя.",
  };
}
