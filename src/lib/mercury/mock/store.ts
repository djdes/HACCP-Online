/**
 * Мок Ветис.API в памяти.
 *
 * Честно моделирует ПСЕВДОАСИНХРОННОСТЬ: `submit` возвращает
 * `ACCEPTED`, первый `receive` — `IN_PROCESS`, и только следующий отдаёт
 * `COMPLETED` с результатом. Это принципиально: без задержки крон
 * прошёл бы «в один тик», и настоящий цикл поллинга остался бы
 * непроверенным до самого прода.
 *
 * Мок также умеет:
 *   • генерировать входящие ВСД, похожие на жизнь (реальные поставщики,
 *     сроки годности, номера ТТН) — демо-организация выглядит рабочей;
 *   • гасить ВСД, переводя его в UTILIZED, и отвечать на повторное
 *     гашение бизнес-ошибкой «уже погашен» — та самая ветка, которая
 *     защищает от двойного гашения и которую иначе не протестировать;
 *   • отдавать ошибку по команде (`__forceError` в payload).
 */
import { MERCURY_OPERATIONS } from "../ns";
import type {
  ApplicationStatus,
  VetDocument,
  VetDocumentStatus,
} from "../types";

export type MockApplication = {
  id: string;
  operation: string;
  payload: Record<string, unknown>;
  status: ApplicationStatus;
  /** Сколько раз уже спрашивали результат. */
  polls: number;
  resultXml?: string;
  errors: { code?: string; message: string }[];
  createdAt: number;
};

export type MockVetDocument = VetDocument & {
  status: VetDocumentStatus;
  updatedAt: number;
};

const SUPPLIERS = [
  {
    name: "ООО «Мясной двор»",
    inn: "7714345678",
    manufacturer: "АО «Останкинский МПК»",
  },
  {
    name: "ИП Смирнов А. В.",
    inn: "504712345678",
    manufacturer: "ООО «Молочный комбинат «Ополье»",
  },
  {
    name: "ООО «Птицепром»",
    inn: "7726123456",
    manufacturer: "ЗАО «Петелинская птицефабрика»",
  },
];

const PRODUCTS = [
  { name: "Говядина охлаждённая, лопатка", type: "Мясо и мясопродукты", unit: "кг", volume: 42.5, shelfDays: 5 },
  { name: "Филе куриное охлаждённое", type: "Мясо и мясопродукты", unit: "кг", volume: 18, shelfDays: 4 },
  { name: "Молоко питьевое 3,2 %", type: "Молоко и молочные продукты", unit: "л", volume: 120, shelfDays: 10 },
  { name: "Творог 9 %", type: "Молоко и молочные продукты", unit: "кг", volume: 24, shelfDays: 7 },
  { name: "Треска филе с/м", type: "Рыба и морепродукты", unit: "кг", volume: 30, shelfDays: 120 },
];

function shiftDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pseudoUuid(seed: string): string {
  // Детерминированный «uuid» — чтобы демо-данные не прыгали между
  // перезапусками и тесты были воспроизводимы.
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  return `${hex(h)}-${hex(h >>> 3).slice(0, 4)}-4${hex(h >>> 5).slice(0, 3)}-a${hex(h >>> 7).slice(0, 3)}-${hex(h >>> 11)}${hex(h >>> 13).slice(0, 4)}`;
}

export class MockMercuryStore {
  private applications = new Map<string, MockApplication>();
  private documents = new Map<string, MockVetDocument>();
  private seq = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  /** Засеять N входящих ВСД на площадку. */
  seedIncoming(enterpriseGuid: string, count = 6): MockVetDocument[] {
    const base = this.now();
    const created: MockVetDocument[] = [];
    for (let i = 0; i < count; i += 1) {
      const supplier = SUPPLIERS[i % SUPPLIERS.length];
      const product = PRODUCTS[i % PRODUCTS.length];
      // Разбрасываем по последним дням, чтобы были и свежие, и просроченные.
      const deliveryDate = shiftDays(base, -(i % 4));
      const uuid = pseudoUuid(`${enterpriseGuid}:${i}`);
      const doc: MockVetDocument = {
        uuid,
        number: `${2600000000 + i}`,
        docType: "TRANSPORT",
        status: "CONFIRMED",
        issueDate: deliveryDate,
        deliveryDate,
        consigneeEnterpriseGuid: enterpriseGuid,
        consignorEnterpriseGuid: pseudoUuid(supplier.inn),
        consignorName: supplier.name,
        consignorInn: supplier.inn,
        manufacturerName: supplier.manufacturer,
        productName: product.name,
        productType: product.type,
        volume: product.volume,
        unit: product.unit,
        batchNumber: `П-${deliveryDate.slice(5).replace("-", "")}-${i + 1}`,
        productionDate: shiftDays(new Date(`${deliveryDate}T00:00:00Z`), -2),
        expiryDate: shiftDays(new Date(`${deliveryDate}T00:00:00Z`), product.shelfDays),
        transportInfo: `Автотранспорт А${100 + i}ВС${770 + i}`,
        accompanyingDocs: `ТТН №${deliveryDate.slice(2, 4)}${deliveryDate.slice(5, 7)}${deliveryDate.slice(8)}-${i + 1}`,
        raw: { mock: true, uuid },
        updatedAt: Date.now(),
      };
      this.documents.set(uuid, doc);
      created.push(doc);
    }
    return created;
  }

  listIncoming(enterpriseGuid: string): MockVetDocument[] {
    return [...this.documents.values()].filter(
      (d) => d.consigneeEnterpriseGuid === enterpriseGuid,
    );
  }

  getDocument(uuid: string): MockVetDocument | undefined {
    return this.documents.get(uuid);
  }

  /** `submitApplicationRequest`. */
  submit(operation: string, payload: Record<string, unknown>): MockApplication {
    this.seq += 1;
    const app: MockApplication = {
      id: `mock-app-${this.seq}`,
      operation,
      payload,
      status: "ACCEPTED",
      polls: 0,
      errors: [],
      createdAt: Date.now(),
    };
    this.applications.set(app.id, app);
    return app;
  }

  /**
   * `receiveApplicationResultRequest`.
   *
   * Первый вызов всегда `IN_PROCESS` — так тестируется настоящий цикл
   * ожидания, а не срезанный путь.
   */
  receive(applicationId: string): MockApplication | undefined {
    const app = this.applications.get(applicationId);
    if (!app) return undefined;
    app.polls += 1;
    if (app.polls < 2) {
      app.status = "IN_PROCESS";
      return app;
    }
    if (app.status === "COMPLETED" || app.status === "REJECTED") return app;
    this.execute(app);
    return app;
  }

  /** Выполнение операции — здесь живёт вся «бизнес-логика» мока. */
  private execute(app: MockApplication): void {
    if (app.payload.__forceError) {
      app.status = "REJECTED";
      app.errors = [
        { code: "MOCK00001", message: String(app.payload.__forceError) },
      ];
      return;
    }

    switch (app.operation) {
      case MERCURY_OPERATIONS.processIncomingConsignment: {
        const uuid = String(app.payload.vetDocumentUuid ?? "");
        const doc = this.documents.get(uuid);
        if (!doc) {
          app.status = "REJECTED";
          app.errors = [{ code: "MERC10001", message: "ВСД не найден" }];
          return;
        }
        if (doc.status !== "CONFIRMED") {
          // Ровно та ветка, ради которой мок и нужен: повторное гашение
          // должно читаться как успех, а не как провал.
          app.status = "REJECTED";
          app.errors = [
            { code: "MERC10005", message: "ВСД уже погашен" },
          ];
          return;
        }
        doc.status = "UTILIZED";
        doc.updatedAt = Date.now();
        app.status = "COMPLETED";
        app.resultXml = `<stockEntry><guid>${pseudoUuid(`stock:${uuid}`)}</guid></stockEntry>`;
        return;
      }
      default: {
        app.status = "COMPLETED";
        return;
      }
    }
  }

  reset(): void {
    this.applications.clear();
    this.documents.clear();
    this.seq = 0;
  }
}

/** Общий стор для dev-эндпоинта: переживает hot-reload в рамках процесса. */
const globalForMock = globalThis as unknown as {
  __mercuryMockStore?: MockMercuryStore;
};

export function getMockStore(): MockMercuryStore {
  if (!globalForMock.__mercuryMockStore) {
    globalForMock.__mercuryMockStore = new MockMercuryStore();
  }
  return globalForMock.__mercuryMockStore;
}
