import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId: string;
      organizationName: string;
      /** Platform superadmin. True only for users in the synthetic platform org. */
      isRoot: boolean;
      /**
       * Non-null when a root user is viewing a customer organisation via
       * impersonation ("View as"). All data reads MUST use getActiveOrgId()
       * instead of organizationId directly to honour this.
       */
      actingAsOrganizationId: string | null;
    activeOrganizationId?: string | null;
      /** Организация, в которой человек сейчас работает (multi-org). */
      activeOrganizationId?: string | null;
      /**
       * Permission preset overlay поверх legacy `role`. Управляет:
       *   - terminology (admin видит «журналы», остальные «задачи»);
       *   - capabilities (что может видеть/делать).
       * null → fallback на role.
       */
      permissionPreset: string | null;
      /**
       * Org-level overrides для матрицы пресет → capabilities.
       * Если для preset нет ключа — применяются дефолты из
       * `src/lib/permission-presets.ts`. Формат:
       *   `{ "head_chef": ["staff.view", "tasks.verify", "mini.tasks"], ... }`
       * Перезагружается из БД на каждый getServerSession().
       */
      orgPresetOverrides: Record<string, string[]> | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    organizationId: string;
    organizationName: string;
    isRoot: boolean;
    actingAsOrganizationId: string | null;
    permissionPreset: string | null;
  }
}
