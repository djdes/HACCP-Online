"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  getPositionLabelsGrouped,
  getUserPositionLabel,
  getUsersForRoleLabel,
  type UserLike,
} from "@/lib/user-roles";

type PositionSelectProps = {
  /// Whole users collection available for this journal / screen. The
  /// component reads `jobPosition` + `positionTitle` + `role` from each and
  /// groups the distinct labels into management / staff sections.
  users: UserLike[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
};

/**
 * Uniform dropdown that every journal should use for a "должность" picker.
 * Labels come from the live DB positions (seeded from admin's
 * /settings/users) and are split into bold-labelled Руководство / Сотрудники
 * groups so the two-column hierarchy from the staff screen is mirrored in
 * every journal that lets the owner pick a role.
 */
export function PositionSelect({
  users,
  value,
  onValueChange,
  placeholder = "- Выберите значение -",
  disabled,
  triggerClassName,
}: PositionSelectProps) {
  const groups = useMemo(() => getPositionLabelsGrouped(users), [users]);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <PositionSelectItems users={users} />
      </SelectContent>
    </Select>
  );
}

/**
 * Just the grouped <SelectItem>s — drop inside an existing <SelectContent>
 * when the enclosing <Select> is already wired up with custom styling /
 * state. Use this in journal clients where the dropdown is embedded in a
 * larger form layout and we don't want to replace the outer <Select>.
 */
export function PositionSelectItems({
  users,
  labelClassName,
}: {
  users: UserLike[];
  labelClassName?: string;
}) {
  const groups = useMemo(() => getPositionLabelsGrouped(users), [users]);
  const labelCls = cn(
    "text-[13px] font-semibold italic text-[#0b1024]",
    labelClassName
  );
  return (
    <>
      {groups.management.length > 0 ? (
        <SelectGroup>
          <SelectLabel className={labelCls}>Руководство</SelectLabel>
          {groups.management.map((label) => (
            <SelectItem key={`m:${label}`} value={label}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}
      {groups.staff.length > 0 ? (
        <SelectGroup>
          <SelectLabel className={labelCls}>Сотрудники</SelectLabel>
          {groups.staff.map((label) => (
            <SelectItem key={`s:${label}`} value={label}>
              {label}
            </SelectItem>
          ))}
        </SelectGroup>
      ) : null}
    </>
  );
}

/** Единые тексты плейсхолдеров каскада — «селект сам говорит, что выбираем». */
export const POSITION_PLACEHOLDER = "Выберите должность";
export const EMPLOYEE_PLACEHOLDER = "Выберите сотрудника";

/**
 * Анимация появления второго (каскадного) селекта. Держим в одном месте,
 * чтобы «Должность → Сотрудник» выглядел одинаково во всех журналах.
 * Длительность 200ms — верхняя граница дизайн-системы.
 */
export const CASCADE_REVEAL_CLASS =
  "animate-in fade-in-0 slide-in-from-top-1 duration-200";

/**
 * Каскад Должность → Сотрудник.
 *
 * Сначала виден ТОЛЬКО селект должности с говорящим плейсхолдером
 * «Выберите должность». Как только должность выбрана — НИЖЕ мягко
 * появляется «Выберите сотрудника», отфильтрованный по этой должности.
 * Пока должность не выбрана, список сотрудников не показываем вообще
 * (иначе пользователь выбирает вслепую из всех).
 */
export function PositionEmployeePicker<T extends UserLike & { id: string }>({
  users,
  positionUsers,
  value,
  onChange,
  disabled,
  positionLabel = "Должность",
  employeeLabel = "Сотрудник",
  emptyPositionPlaceholder = POSITION_PLACEHOLDER,
  emptyEmployeePlaceholder = EMPLOYEE_PLACEHOLDER,
  emptyEmployeeHint = "На этой должности пока нет сотрудников — добавьте их в «Настройки → Сотрудники».",
  triggerClassName,
  labelClassName,
}: {
  users: T[];
  /**
   * Источник СПИСКА ДОЛЖНОСТЕЙ, когда он шире списка кандидатов.
   *
   * Нужен там, где `users` уже отфильтрован (например «Добавить
   * сотрудника» в журнале показывает только тех, кого ещё нет в
   * документе): без этого должность, у которой все сотрудники уже
   * добавлены, просто исчезала из селекта — и владелец решал, что
   * должность пропала. Теперь должности показываем все, а «кандидатов
   * не осталось» объясняет `emptyEmployeeHint`.
   */
  positionUsers?: UserLike[];
  value: { positionTitle: string; userId: string };
  onChange: (next: { positionTitle: string; userId: string }) => void;
  disabled?: boolean;
  positionLabel?: string;
  employeeLabel?: string;
  emptyPositionPlaceholder?: string;
  emptyEmployeePlaceholder?: string;
  emptyEmployeeHint?: string;
  triggerClassName?: string;
  labelClassName?: string;
}) {
  const availableEmployees = useMemo(() => {
    if (!value.positionTitle) return [];
    return getUsersForRoleLabel(users, value.positionTitle, {
      keepUserId: value.userId,
    });
  }, [users, value.positionTitle, value.userId]);

  const positionValue = value.positionTitle || "__empty__";
  const userValue = value.userId || "__empty__";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className={cn("text-[13px] font-medium text-[#6f7282]", labelClassName)}>
          {positionLabel}
        </div>
        <Select
          value={positionValue}
          onValueChange={(v) => {
            const nextTitle = v === "__empty__" ? "" : v;
            const stillValid =
              !value.userId ||
              (nextTitle
                ? users.some(
                    (u) =>
                      u.id === value.userId &&
                      getUserPositionLabel(u) === nextTitle
                  )
                : false);
            onChange({
              positionTitle: nextTitle,
              userId: stillValid ? value.userId : "",
            });
          }}
          disabled={disabled}
        >
          <SelectTrigger className={triggerClassName}>
            <SelectValue placeholder={emptyPositionPlaceholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">{emptyPositionPlaceholder}</SelectItem>
            <PositionSelectItems users={positionUsers ?? users} />
          </SelectContent>
        </Select>
      </div>

      {value.positionTitle ? (
        <div className={cn("space-y-2", CASCADE_REVEAL_CLASS)}>
          <div className={cn("text-[13px] font-medium text-[#6f7282]", labelClassName)}>
            {employeeLabel}
          </div>
          <Select
            value={userValue}
            onValueChange={(v) => {
              onChange({
                positionTitle: value.positionTitle,
                userId: v === "__empty__" ? "" : v,
              });
            }}
            disabled={disabled || availableEmployees.length === 0}
          >
            <SelectTrigger className={triggerClassName}>
              <SelectValue placeholder={emptyEmployeePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">{emptyEmployeePlaceholder}</SelectItem>
              {availableEmployees.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableEmployees.length === 0 ? (
            <div className="text-[13px] text-[#9b9fb3]">{emptyEmployeeHint}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Native `<optgroup>` + `<option>` variant for journals that still use a
 * plain HTML `<select>` (glass-list, perishable-rejection, product-writeoff
 * and friends). Drop-in for `{ROLE_OPTIONS.map(...)}` inside `<select>`.
 */
export function PositionNativeOptions({ users }: { users: UserLike[] }) {
  const groups = useMemo(() => getPositionLabelsGrouped(users), [users]);
  return (
    <>
      {groups.management.length > 0 ? (
        <optgroup label="Руководство">
          {groups.management.map((label) => (
            <option key={`m:${label}`} value={label}>
              {label}
            </option>
          ))}
        </optgroup>
      ) : null}
      {groups.staff.length > 0 ? (
        <optgroup label="Сотрудники">
          {groups.staff.map((label) => (
            <option key={`s:${label}`} value={label}>
              {label}
            </option>
          ))}
        </optgroup>
      ) : null}
    </>
  );
}
