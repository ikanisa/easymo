import type { ProfileRow } from "@/lib/auth";

export function isSystemAdmin(profile: ProfileRow): boolean {
  return profile.role === "SYSTEM_ADMIN";
}

function matchesSacco(profile: ProfileRow, saccoId: string | null): boolean {
  if (!saccoId) return false;
  return profile.sacco_id === saccoId;
}

export function hasSaccoReadAccess(profile: ProfileRow, saccoId: string | null): boolean {
  if (isSystemAdmin(profile)) return true;
  if (!saccoId) return false;
  return matchesSacco(profile, saccoId);
}

export function canManageIkimina(profile: ProfileRow, saccoId: string | null): boolean {
  if (isSystemAdmin(profile)) return true;
  if (!matchesSacco(profile, saccoId)) return false;
  return profile.role === "SACCO_MANAGER" || profile.role === "SACCO_STAFF";
}

export function canManageMembers(profile: ProfileRow, saccoId: string | null): boolean {
  return canManageIkimina(profile, saccoId);
}

export function canManageSettings(profile: ProfileRow, saccoId: string | null): boolean {
  if (isSystemAdmin(profile)) return true;
  if (!matchesSacco(profile, saccoId)) return false;
  return profile.role === "SACCO_MANAGER";
}

export function canImportStatements(profile: ProfileRow, saccoId: string | null): boolean {
  if (isSystemAdmin(profile)) return true;
  if (!matchesSacco(profile, saccoId)) return false;
  return profile.role === "SACCO_MANAGER" || profile.role === "SACCO_STAFF";
}

export function canReconcilePayments(profile: ProfileRow, saccoId: string | null): boolean {
  return canImportStatements(profile, saccoId);
}

export function isSaccoViewer(profile: ProfileRow, saccoId: string | null): boolean {
  if (profile.role !== "SACCO_VIEWER") return false;
  return matchesSacco(profile, saccoId);
}

export function describeRole(role: ProfileRow["role"]): string {
  switch (role) {
    case "SYSTEM_ADMIN":
      return "System administrator";
    case "SACCO_MANAGER":
      return "SACCO manager";
    case "SACCO_STAFF":
      return "SACCO staff";
    case "SACCO_VIEWER":
      return "SACCO viewer";
    default:
      return (role as string).replace(/_/g, " ");
  }
}
