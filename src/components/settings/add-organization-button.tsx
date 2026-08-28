"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { CreateOrganizationDialog } from "@/components/layout/create-organization-dialog";

/**
 * «+ Добавить организацию» на странице сотрудников.
 *
 * Владелец сети приходит заводить вторую точку именно сюда: он открыл
 * список людей и упёрся в то, что они все из одного заведения. Кнопка в
 * меню профиля остаётся, но искать её на этом экране неочевидно.
 *
 * Рендерится только владельцу аккаунта — решение принимает сервер
 * (страница), компонент про права ничего не знает.
 */
export function AddOrganizationButton({
  currentSphere,
  currentName,
  organizationsCount,
}: {
  currentSphere: string;
  currentName: string;
  organizationsCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors duration-150 hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
      >
        <Building2 className="size-4 text-[#5566f6]" />
        Добавить организацию
      </button>
      <span className="text-[13px] text-[#6f7282]">
        Вторая точка со своими журналами и сотрудниками. Лимит бесплатного
        тарифа общий на все организации.
      </span>

      {open ? (
        <CreateOrganizationDialog
          currentSphere={currentSphere}
          currentName={currentName}
          organizationsCount={organizationsCount}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
