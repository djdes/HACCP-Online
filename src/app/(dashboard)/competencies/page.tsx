import { GraduationCap } from "lucide-react";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { CompetencyCell } from "@/components/competencies/competency-cell";

const SKILLS = [
  { key: "safety", label: "Безопасность" },
  { key: "stability", label: "Стабильность" },
  { key: "speed", label: "Скорость" },
  { key: "haccp", label: "ХАССП" },
  { key: "hygiene", label: "Гигиена" },
  { key: "equipment", label: "Оборудование" },
];

const LEVEL_COLORS = ["bg-gray-200", "bg-yellow-300", "bg-blue-400", "bg-green-500"];
const LEVEL_LABELS = ["Не обучен", "Базовый", "Средний", "Продвинутый"];

export default async function CompetenciesPage() {
  const session = await requireAuth();
  const orgId = session.user.organizationId;

  const [users, competencies] = await Promise.all([
    db.user.findMany({
      where: { organizationId: orgId, isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    db.staffCompetency.findMany({
      where: { organizationId: orgId },
    }),
  ]);

  // Build matrix: userId -> skill -> competency
  const matrix: Record<string, Record<string, { level: number; id: string }>> = {};
  for (const c of competencies) {
    if (!matrix[c.userId]) matrix[c.userId] = {};
    matrix[c.userId][c.skill] = { level: c.level, id: c.id };
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <GraduationCap className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Матрица компетенций</h1>
        </div>
        <p className="mt-1 text-muted-foreground">
          Уровни: Безопасно → Стабильно → Быстро (3-уровневая модель)
        </p>
      </div>

      {/* Legend */}
      <div className="flex gap-3">
        {LEVEL_LABELS.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <div className={`size-4 rounded ${LEVEL_COLORS[i]}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">Сотрудник</th>
                {SKILLS.map((s) => (
                  <th key={s.key} className="px-3 py-3 text-center font-medium text-xs">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                  </td>
                  {SKILLS.map((skill) => {
                    const comp = matrix[user.id]?.[skill.key];
                    const level = comp?.level ?? 0;

                    return (
                      <td key={skill.key} className="px-3 py-3 text-center">
                        <CompetencyCell
                          userId={user.id}
                          skill={skill.key}
                          level={level}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
