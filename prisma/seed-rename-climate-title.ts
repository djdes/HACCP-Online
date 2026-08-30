/**
 * One-shot rename: «Бланк контроля температуры и влажности» →
 * «… на складах».
 *
 * Журнал сузили до складов, где хранятся продукты, и название в коде
 * поправили. Но у уже созданных документов заголовок лежит в БД строкой
 * с момента создания, а имя шаблона — в JournalTemplate. Обычный seed
 * обновляет шаблон, документы же остаются со старым названием, и на
 * сайте журнал по-прежнему называется по-старому.
 *
 * Безопасно: трогаем только документы шаблона climate_control, у которых
 * заголовок ещё не содержит «на складах». Пользовательские названия,
 * набранные вручную, не совпадут с известными старыми и останутся как
 * есть — переименовываем строго по точному совпадению.
 *
 * Идемпотентно: после прогона следующий запуск обновит 0 строк.
 * Запускается на каждый deploy (см. .github/workflows/deploy.yml).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TEMPLATE_CODE = "climate_control";
const NEW_TITLE = "Бланк контроля температуры и влажности на складах";

/**
 * Старые заголовки — точным совпадением. Список, а не префикс: под
 * префикс попало бы «…влажности в цехе №2», которое кто-то ввёл руками.
 */
const OLD_TITLES = [
  "Бланк контроля температуры и влажности",
  "Журнал контроля температуры и влажности",
  "Контроль температуры и влажности",
];

async function main() {
  const template = await prisma.journalTemplate.findUnique({
    where: { code: TEMPLATE_CODE },
    select: { id: true, name: true },
  });
  if (!template) {
    console.log(`[rename-climate] шаблон ${TEMPLATE_CODE} не найден — нечего делать`);
    return;
  }

  if (template.name !== NEW_TITLE) {
    await prisma.journalTemplate.update({
      where: { id: template.id },
      data: { name: NEW_TITLE },
    });
    console.log(`[rename-climate] шаблон: «${template.name}» → «${NEW_TITLE}»`);
  }

  const documents = await prisma.journalDocument.updateMany({
    where: { templateId: template.id, title: { in: OLD_TITLES } },
    data: { title: NEW_TITLE },
  });

  console.log(`[rename-climate] документов переименовано: ${documents.count}`);
}

main()
  .catch((error) => {
    console.error("[rename-climate] ошибка:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
