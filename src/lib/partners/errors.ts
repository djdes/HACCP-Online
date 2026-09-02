import { NextResponse } from "next/server";

/** Ошибка прикладного слоя партнёрки — превращается в JSON-ответ с нужным статусом. */
export class PartnerError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409 | 429 = 400,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "PartnerError";
  }
}

/** Единый обработчик для API-роутов партнёрки. */
export function partnerErrorResponse(error: unknown): NextResponse {
  if (error instanceof PartnerError) {
    return NextResponse.json({ error: error.message, code: error.code ?? null }, { status: error.status });
  }
  console.error("partner api error", error);
  return NextResponse.json({ error: "Внутренняя ошибка" }, { status: 500 });
}
