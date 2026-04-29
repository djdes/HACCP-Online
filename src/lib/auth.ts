import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getPermissionRole } from "@/lib/user-roles";
import { verifyTelegramInitData } from "@/lib/telegram-init-data";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 365 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  jwt: {
    maxAge: 365 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-haccp-online.session-token"
          : "haccp-online.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Host-haccp-online.csrf-token"
          : "haccp-online.csrf-token",
      options: {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-haccp-online.callback-url"
          : "haccp-online.callback-url",
      options: {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Введите email и пароль");
        }

        // Защита от brute-force: 5 попыток на email за 5 минут.
        // Lazy-import — rate-limit Map не должна быть в server bundle
        // если функция не вызвана.
        const { loginRateLimiter } = await import("@/lib/rate-limit");
        const emailKey = `login:${credentials.email.toLowerCase().trim()}`;
        if (!loginRateLimiter.consume(emailKey)) {
          throw new Error(
            "Слишком много попыток входа. Подождите 5 минут или восстановите пароль."
          );
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { organization: true },
        });

        if (!user || !user.isActive) {
          throw new Error("Неверный email или пароль");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );

        if (!isPasswordValid) {
          throw new Error("Неверный email или пароль");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: getPermissionRole(user.role),
          organizationId: user.organizationId,
          organizationName: user.organization.name,
          isRoot: user.isRoot === true,
          permissionPreset: user.permissionPreset ?? null,
        };
      },
    }),
    // Second CredentialsProvider: Telegram Mini App sign-in. The client sends
    // the raw `window.Telegram.WebApp.initData` string as the sole credential;
    // we verify its HMAC against TELEGRAM_BOT_TOKEN and map the TG user id to
    // an existing User via `telegramChatId`. No auto-provisioning — the bot's
    // `/start inv_<token>` handler is the only place that binds new users.
    CredentialsProvider({
      id: "telegram",
      name: "Telegram",
      credentials: {
        initData: { label: "initData", type: "text" },
      },
      async authorize(credentials) {
        const initData = credentials?.initData;
        if (!initData) {
          throw new Error("Не найдены данные Telegram");
        }
        const verified = verifyTelegramInitData(initData);
        if (!verified.ok) {
          throw new Error("Неверная подпись Telegram");
        }
        const chatIdStr = String(verified.data.user.id);
        const user = await db.user.findFirst({
          where: { telegramChatId: chatIdStr, isActive: true },
          include: { organization: true },
        });
        if (!user) {
          throw new Error(
            "Аккаунт не связан с Telegram. Получите приглашение у руководителя."
          );
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: getPermissionRole(user.role),
          organizationId: user.organizationId,
          organizationName: user.organization.name,
          isRoot: user.isRoot === true,
          permissionPreset: user.permissionPreset ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as {
          id: string;
          role: string;
          organizationId: string;
          organizationName: string;
          isRoot?: boolean;
          permissionPreset?: string | null;
        };
        token.id = u.id;
        token.role = u.role;
        token.organizationId = u.organizationId;
        token.organizationName = u.organizationName;
        token.isRoot = u.isRoot === true;
        token.permissionPreset = u.permissionPreset ?? null;
        token.actingAsOrganizationId = null;
      }
      // Impersonation: root clicks "View as <org>" or "Stop" and the
      // client calls `update({ actingAsOrganizationId: ... })`. NextAuth v4
      // routes that through the jwt callback with trigger === "update".
      if (trigger === "update" && session && typeof session === "object") {
        if ("actingAsOrganizationId" in session && token.isRoot) {
          const next = session.actingAsOrganizationId;
          token.actingAsOrganizationId =
            typeof next === "string" && next.length > 0 ? next : null;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string;
        session.user.organizationName = token.organizationName as string;
        session.user.isRoot = token.isRoot === true;
        session.user.permissionPreset =
          typeof token.permissionPreset === "string" ? token.permissionPreset : null;
        session.user.actingAsOrganizationId =
          typeof token.actingAsOrganizationId === "string"
            ? token.actingAsOrganizationId
            : null;

        // Live-refresh organizationName из БД. JWT кэширует имя на момент
        // login и больше его не обновляет, поэтому при переименовании
        // организации старое имя «прилипает» в шапке у залогиненного
        // пользователя до релогина. Один лёгкий запрос (только name)
        // решает это без необходимости в logout/login.
        try {
          const activeOrgId =
            session.user.isRoot &&
            typeof session.user.actingAsOrganizationId === "string" &&
            session.user.actingAsOrganizationId.length > 0
              ? session.user.actingAsOrganizationId
              : session.user.organizationId;
          if (activeOrgId) {
            const { db } = await import("@/lib/db");
            const fresh = await db.organization.findUnique({
              where: { id: activeOrgId },
              select: { name: true },
            });
            if (fresh?.name) {
              session.user.organizationName = fresh.name;
            }
          }
        } catch {
          /* fall back to cached token name */
        }
      }
      return session;
    },
  },
  events: {
    /**
     * Уведомление руководству при первом входе нового сотрудника.
     * Дедупликация через AuditLog (action="user.first_login") — повторные
     * логины не пингают повторно. Fire-and-forget: ошибка нотификации
     * не должна ломать сам логин.
     */
    async signIn({ user }) {
      const u = user as { id?: string; organizationId?: string; name?: string };
      if (!u?.id || !u.organizationId) return;
      try {
        const { db } = await import("@/lib/db");
        const existing = await db.auditLog.findFirst({
          where: {
            organizationId: u.organizationId,
            action: "user.first_login",
            entityId: u.id,
          },
          select: { id: true },
        });
        if (existing) return;

        await db.auditLog.create({
          data: {
            organizationId: u.organizationId,
            userId: u.id,
            userName: u.name ?? null,
            action: "user.first_login",
            entity: "user",
            entityId: u.id,
          },
        });

        // Не пингаем для root и management — они себя сами регистрируют
        // и не интересны как «новенький».
        const { notifyOrganization, escapeTelegramHtml: esc } = await import(
          "@/lib/telegram"
        );
        const { isManagementRole } = await import("@/lib/user-roles");
        const u2 = user as { role?: string; isRoot?: boolean };
        if (u2?.isRoot || isManagementRole(u2?.role)) return;

        const message =
          `👋 <b>Новенький в команде</b>\n\n` +
          `${esc(u.name ?? "Сотрудник")} зашёл в систему первый раз. ` +
          `Проверьте права доступа и медкнижку, прежде чем выпускать на смену.`;
        await notifyOrganization(u.organizationId, message, ["owner"]);
      } catch (err) {
        console.warn("[auth/signIn] first-login notify failed", err);
      }
    },
  },
};
