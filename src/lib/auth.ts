import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getPermissionRole } from "@/lib/user-roles";

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
        };
        token.id = u.id;
        token.role = u.role;
        token.organizationId = u.organizationId;
        token.organizationName = u.organizationName;
        token.isRoot = u.isRoot === true;
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
        session.user.actingAsOrganizationId =
          typeof token.actingAsOrganizationId === "string"
            ? token.actingAsOrganizationId
            : null;
      }
      return session;
    },
  },
};
