export type AdminAccessCredential = {
  actorId: string;
  email: string;
  password: string;
  username?: string;
  label?: string;
};

let cachedCredentials: AdminAccessCredential[] | null = null;

function parseFromJson(raw: string): AdminAccessCredential[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const actorId = String(entry.actorId ?? "").trim();
        const email = entry.email ? String(entry.email).trim().toLowerCase() : "";
        const password = entry.password ? String(entry.password).trim() : "";
        const username = entry.username ? String(entry.username).trim() : undefined;
        const label = entry.label ? String(entry.label) : undefined;
        if (!actorId || !email || !password) {
          return null;
        }
        return { actorId, email, password, username, label };
      })
      .filter((entry): entry is AdminAccessCredential => Boolean(entry));
  } catch (error) {
    console.error("admin_auth.credentials_json_parse_failed", error);
    return [];
  }
}

export function getAdminAccessCredentials(): AdminAccessCredential[] {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  const credentials: AdminAccessCredential[] = [];

  const jsonSource = process.env.ADMIN_ACCESS_CREDENTIALS;
  if (jsonSource) {
    credentials.push(...parseFromJson(jsonSource));
  }

  cachedCredentials = credentials;
  return cachedCredentials;
}

export function findCredentialByEmail(email: string): AdminAccessCredential | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return (
    getAdminAccessCredentials().find((entry) => entry.email && entry.email === normalized) ?? null
  );
}

export function isActorAuthorized(actorId: string): boolean {
  if (process.env.ADMIN_ALLOW_ANY_ACTOR === 'true') {
    return true;
  }
  return getAdminAccessCredentials().some((entry) => entry.actorId === actorId);
}

export function getActorLabel(actorId: string): string | null {
  const credential = getAdminAccessCredentials().find((entry) => entry.actorId === actorId);
  if (!credential) return null;
  return credential.label ?? credential.username ?? credential.email ?? null;
}

export function clearCachedCredentials() {
  cachedCredentials = null;
}
