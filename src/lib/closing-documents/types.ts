/**
 * Закрывающие документы (УПД) — типы и чистые правила.
 *
 * Здесь нет ни базы, ни файлов: этим модулем пользуются и сервер
 * (сборка снимка, PDF), и клиент ROOT-страницы «Реквизиты и подпись»
 * (чек-лист готовности). Всё, что ходит в базу и на диск, — в
 * `requisites.ts` и `service.ts`.
 */

/** Режим НДС продавца. Владелец: УСН без НДС → УПД со статусом 2. */
export type VatMode = "none";

export type BankRequisites = {
  name: string;
  bik: string;
  account: string;
  corrAccount: string;
};

export type HeadRequisites = {
  post: string;
  name: string;
};

/** Реквизиты нашей организации — заполняются ROOT, хранятся в PlatformSetting. */
export type PlatformRequisites = {
  nameFull: string;
  nameShort: string;
  inn: string;
  kpp: string;
  ogrn: string;
  address: string;
  bank: BankRequisites;
  head: HeadRequisites;
  vatMode: VatMode;
  email: string;
  phone: string;
  /** Имена файлов в приватном каталоге LEGAL_DIR; null — не загружено. */
  facsimileFile: string | null;
  stampFile: string | null;
  updatedAt: string | null;
};

export const EMPTY_REQUISITES: PlatformRequisites = {
  nameFull: "",
  nameShort: "",
  inn: "",
  kpp: "",
  ogrn: "",
  address: "",
  bank: { name: "", bik: "", account: "", corrAccount: "" },
  head: { post: "", name: "" },
  vatMode: "none",
  email: "",
  phone: "",
  facsimileFile: null,
  stampFile: null,
  updatedAt: null,
};

/** Сторона документа — снимок на момент выпуска. */
export type PartySnapshot = {
  name: string;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  head: HeadRequisites | null;
  bank?: BankRequisites | null;
};

export type ClosingLine = {
  title: string;
  /** Условное обозначение единицы: «усл. ед.», «шт». */
  unit: string;
  /** Код по ОКЕИ: 876 — условная единица, 796 — штука. */
  unitCode: string;
  qty: number;
  priceRub: number;
  sumRub: number;
};

export type ClosingDocumentDraft = {
  orderId: number;
  number: string;
  issuedAt: Date;
  seller: PartySnapshot;
  buyer: PartySnapshot;
  lines: ClosingLine[];
  totalRub: number;
  vatMode: VatMode;
  /** «Основание передачи (сдачи) / получения (приёмки)». */
  basis: string;
  /** Платёжно-расчётный документ — заказ кассы. */
  paymentDocument: string;
};

export type ChecklistItem = { key: string; label: string; ok: boolean };

const digits = (value: string, length: number[]) =>
  length.includes(value.replace(/\D/g, "").length) && /^\d+$/.test(value.trim());

/**
 * Что должно быть заполнено, чтобы документ вообще выпускался.
 * КПП необязателен (у ИП его нет), телефон и почта — тоже.
 */
export function requisitesChecklist(r: PlatformRequisites): ChecklistItem[] {
  return [
    { key: "nameFull", label: "Полное наименование", ok: r.nameFull.trim().length > 3 },
    { key: "inn", label: "ИНН (10 или 12 цифр)", ok: digits(r.inn, [10, 12]) },
    { key: "ogrn", label: "ОГРН / ОГРНИП (13 или 15 цифр)", ok: digits(r.ogrn, [13, 15]) },
    { key: "address", label: "Юридический адрес", ok: r.address.trim().length > 10 },
    { key: "bank.name", label: "Банк", ok: r.bank.name.trim().length > 2 },
    { key: "bank.bik", label: "БИК (9 цифр)", ok: digits(r.bank.bik, [9]) },
    { key: "bank.account", label: "Расчётный счёт (20 цифр)", ok: digits(r.bank.account, [20]) },
    { key: "bank.corrAccount", label: "Корреспондентский счёт (20 цифр)", ok: digits(r.bank.corrAccount, [20]) },
    { key: "head.post", label: "Должность руководителя", ok: r.head.post.trim().length > 2 },
    { key: "head.name", label: "ФИО руководителя", ok: r.head.name.trim().length > 4 },
    { key: "facsimileFile", label: "Факсимиле подписи (PNG)", ok: Boolean(r.facsimileFile) },
    { key: "stampFile", label: "Печать (PNG)", ok: Boolean(r.stampFile) },
  ];
}

export function isRequisitesComplete(r: PlatformRequisites): boolean {
  return requisitesChecklist(r).every((item) => item.ok);
}

/** Имя файла для скачивания и вложения. ASCII — для заголовка, кириллица — рядом. */
export function closingDocumentFilename(number: string): { ascii: string; utf8: string } {
  const safe = number.replace(/[^0-9A-Za-z_-]/g, "");
  return { ascii: `UPD-${safe}.pdf`, utf8: `УПД-${safe}.pdf` };
}
