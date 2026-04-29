import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = {
    organizationId: getActiveOrgId(session),
  };
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59); dateFilter.lte = d; }
    where.date = dateFilter;
  }

  const records = await db.lossRecord.findMany({
    where,
    orderBy: { date: "desc" },
    take: 200,
  });

  return NextResponse.json(records);
}

/**
 * L9 — авто-классификация writeoff causes по ключевым словам.
 * Если менеджер не выбрал категорию (или выбрал "other"), а в
 * `cause` или `productName` есть характерное слово — мы
 * подменяем category. Без AI — keyword-matching.
 */
function autoCategorize(
  category: string | undefined,
  cause: string | undefined,
  productName: string | undefined
): string {
  const initial = (category ?? "").trim();
  if (initial && initial !== "other") return initial;
  const haystack = `${cause ?? ""} ${productName ?? ""}`.toLowerCase();
  const matches: Array<{ cat: string; words: string[] }> = [
    { cat: "writeoff", words: ["просроч", "истёк", "испорч", "плесен", "запах"] },
    { cat: "packaging_defect", words: ["упаков", "тара", "вмятин", "разрыв"] },
    { cat: "rework", words: ["перераб", "повтор"] },
    { cat: "overweight", words: ["перевес"] },
    { cat: "underweight", words: ["недовес"] },
    { cat: "bottleneck_idle", words: ["простой", "ожидан"] },
    { cat: "raw_material_variance", words: ["сырь", "разброс"] },
  ];
  for (const m of matches) {
    if (m.words.some((w) => haystack.includes(w))) return m.cat;
  }
  return "other";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const category = autoCategorize(body.category, body.cause, body.productName);
  const record = await db.lossRecord.create({
    data: {
      organizationId: getActiveOrgId(session),
      category,
      productName: body.productName,
      quantity: Number(body.quantity),
      unit: body.unit || "kg",
      costRub: body.costRub ? Number(body.costRub) : null,
      cause: body.cause || null,
      areaId: body.areaId || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(record, { status: 201 });
}
