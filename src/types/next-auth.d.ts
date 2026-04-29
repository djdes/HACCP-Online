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
      /**
       * Permission preset overlay поверх legacy `role`. Управляет:
       *   - terminology (admin видит «журналы», остальные «задачи»);
       *   - capabilities (что может видеть/делать).
       * null → fallback на role.
       */
      permissionPreset: string | null;
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
