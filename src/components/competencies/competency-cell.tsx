"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const LEVEL_COLORS = ["bg-gray-200 text-gray-500", "bg-yellow-300 text-yellow-800", "bg-blue-400 text-white", "bg-green-500 text-white"];

interface Props {
  userId: string;
  skill: string;
  level: number;
}

export function CompetencyCell({ userId, skill, level: initialLevel }: Props) {
  const router = useRouter();
  const [level, setLevel] = useState(initialLevel);
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    const nextLevel = (level + 1) % 4;
    setLevel(nextLevel);
    setSaving(true);

    try {
      await fetch("/api/competencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, skill, level: nextLevel }),
      });
      router.refresh();
    } catch {
      setLevel(initialLevel);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={saving}
      className={`inline-flex items-center justify-center rounded-md size-8 text-xs font-bold transition-colors cursor-pointer ${LEVEL_COLORS[level]} ${saving ? "opacity-50" : "hover:ring-2 hover:ring-primary"}`}
      title={`Уровень ${level}`}
    >
      {level}
    </button>
  );
}
