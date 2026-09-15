// Подключение к ЛОКАЛЬНОЙ e2e-базе. Никогда не читает .env: там туннель
// 127.0.0.1:5433 на прод. Любой другой адрес — немедленный отказ.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

export const E2E_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5432/wesetup_e2e?sslmode=disable";

const url = process.env.E2E_DATABASE_URL || E2E_DATABASE_URL;
if (!/@localhost:5432\/wesetup_e2e\b/.test(url)) {
  throw new Error(`Отказ: e2e работает только с localhost:5432/wesetup_e2e, получено ${url}`);
}
process.env.DATABASE_URL = url;
process.env.DATABASE_URL_DIRECT = url;

export const db = new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: url })) });
