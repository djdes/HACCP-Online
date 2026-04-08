import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

type DemoUserSpec = {
  emailPrefix: string;
  name: string;
  role: string;
};

const DEMO_USERS: DemoUserSpec[] = [
  { emailPrefix: "health-demo-alexey", name: "Алексей Смирнов", role: "operator" },
  { emailPrefix: "health-demo-boris", name: "Борис Орлов", role: "operator" },
  { emailPrefix: "health-demo-viktor", name: "Виктор Егоров", role: "operator" },
];

function parseOrgIds() {
  const args = process.argv.slice(2);
  const ids: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--org") continue;

    const value = args[index + 1];
    if (value) ids.push(value);
  }

  return [...new Set(ids)];
}

function getCurrentPeriodBounds(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const day = referenceDate.getUTCDate();

  if (day <= 15) {
    return {
      dateFrom: new Date(Date.UTC(year, month, 1)),
      dateTo: new Date(Date.UTC(year, month, 15)),
    };
  }

  return {
    dateFrom: new Date(Date.UTC(year, month, 16)),
    dateTo: new Date(Date.UTC(year, month + 1, 0)),
  };
}

function buildDateKeys(dateFrom: Date, dateTo: Date) {
  const keys: string[] = [];

  for (
    const cursor = new Date(dateFrom);
    cursor.getTime() <= dateTo.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    keys.push(cursor.toISOString().slice(0, 10));
  }

  return keys;
}

function getDemoEmail(prefix: string, organizationId: string) {
  return `${prefix}.${organizationId.slice(0, 8)}@wesetup.local`;
}

async function main() {
  const organizationIds = parseOrgIds();
  if (organizationIds.length === 0) {
    throw new Error("Передайте хотя бы один --org <organizationId>");
  }

  const connectionString =
    process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL не задан");
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const template = await prisma.journalTemplate.findUnique({
      where: { code: "health_check" },
      select: { id: true, name: true },
    });

    if (!template) {
      throw new Error("Шаблон health_check не найден");
    }

    const passwordHash = await bcrypt.hash("DemoHealth123!", 10);
    const { dateFrom, dateTo } = getCurrentPeriodBounds();
    const dateKeys = buildDateKeys(dateFrom, dateTo);
    const todayKey = new Date().toISOString().slice(0, 10);

    for (const organizationId of organizationIds) {
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          users: {
            where: { isActive: true },
            select: { id: true, role: true, name: true },
            orderBy: [{ role: "asc" }, { name: "asc" }],
          },
        },
      });

      if (!organization) {
        console.log(`Пропуск: организация ${organizationId} не найдена`);
        continue;
      }

      const responsibleUser =
        organization.users.find((user) => user.role === "owner") ||
        organization.users.find((user) => user.role === "technologist") ||
        organization.users[0] ||
        null;

      const demoUsers = [];

      for (const spec of DEMO_USERS) {
        const email = getDemoEmail(spec.emailPrefix, organizationId);
        const user = await prisma.user.upsert({
          where: { email },
          update: {
            name: spec.name,
            role: spec.role,
            organizationId,
            isActive: true,
            passwordHash,
          },
          create: {
            email,
            name: spec.name,
            role: spec.role,
            organizationId,
            passwordHash,
            isActive: true,
          },
        });

        demoUsers.push(user);
      }

      let document = await prisma.journalDocument.findFirst({
        where: {
          organizationId,
          templateId: template.id,
          status: "active",
          dateFrom,
          dateTo,
        },
      });

      if (!document) {
        document = await prisma.journalDocument.create({
          data: {
            templateId: template.id,
            organizationId,
            title: "Журнал здоровья",
            dateFrom,
            dateTo,
            status: "active",
            responsibleUserId: responsibleUser?.id || null,
            responsibleTitle:
              responsibleUser?.role === "owner"
                ? "Управляющий"
                : responsibleUser?.role === "technologist"
                  ? "Шеф-повар"
                  : "Сотрудник",
            createdById: responsibleUser?.id || null,
          },
        });
      }

      for (const user of demoUsers) {
        for (const dateKey of dateKeys) {
          const measures =
            dateKey === todayKey
              ? "Осмотр проведен, замечаний нет"
              : null;

          await prisma.journalDocumentEntry.upsert({
            where: {
              documentId_employeeId_date: {
                documentId: document.id,
                employeeId: user.id,
                date: new Date(`${dateKey}T00:00:00.000Z`),
              },
            },
            update: {
              data: {
                signed: true,
                measures,
              },
            },
            create: {
              documentId: document.id,
              employeeId: user.id,
              date: new Date(`${dateKey}T00:00:00.000Z`),
              data: {
                signed: true,
                measures,
              },
            },
          });
        }
      }

      console.log(
        `Готово: ${organization.name} (${organizationId}) -> ${demoUsers.length} demo users, document ${document.id}`
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
