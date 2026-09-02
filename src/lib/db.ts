import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { resolvePartnerAuditMarker } from "@/lib/partners/audit-marker";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

  const pool = new pg.Pool({
    connectionString,
  });

  const adapter = new PrismaPg(pool);

  const base = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

  // Действия партнёра в кабинете клиента помечаем в аудите
  // «партнёр: <бренд>, <ФИО>» — одним хуком на все ~40 мест записи.
  // Партнёрский режим определяется по заголовку от middleware.
  const extended = base.$extends({
    query: {
      auditLog: {
        async create({ args, query }) {
          const marker = await resolvePartnerAuditMarker(base, {
            userId: args.data.userId ?? null,
            userName: args.data.userName ?? null,
          });
          if (marker) {
            const details =
              args.data.details && typeof args.data.details === "object" && !Array.isArray(args.data.details)
                ? (args.data.details as Record<string, unknown>)
                : {};
            args.data = {
              ...args.data,
              userName: marker.label,
              details: {
                ...details,
                partner: {
                  partnerId: marker.partnerId,
                  brandName: marker.brandName,
                  userName: marker.userName,
                },
              },
            };
          }
          return query(args);
        },
      },
    },
  });

  return extended as unknown as PrismaClient;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
