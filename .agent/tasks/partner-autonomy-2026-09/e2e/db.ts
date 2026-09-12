// Подключение к базе прода через туннель 127.0.0.1:5433 (см. .env.local).
// Prisma 7 требует адаптер — собираем так же, как src/lib/db.ts.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const envLocal = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const url = envLocal.match(/^DATABASE_URL="?([^"\r\n]+)"?/m)?.[1];
if (!url) throw new Error("DATABASE_URL не найден в .env.local");
process.env.DATABASE_URL = url;

const pool = new pg.Pool({ connectionString: url });
export const db = new PrismaClient({ adapter: new PrismaPg(pool) });
