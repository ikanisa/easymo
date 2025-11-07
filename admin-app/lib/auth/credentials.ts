export type AdminAccessCredential = {
  actorId: string;
  token?: string;
  email?: string;
  password?: string;
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
        const token = entry.token ? String(entry.token).trim() : undefined;
        const email = entry.email ? String(entry.email).trim().toLowerCase() : undefined;
        const password = entry.password ? String(entry.password).trim() : undefined;
        const username = entry.username ? String(entry.username).trim() : undefined;
        const label = entry.label ? String(entry.label) : undefined;
        const hasToken = Boolean(token && token.length > 0);
        const hasPassword = Boolean(email && email.length > 0 && password && password.length > 0);
        if (!actorId || (!hasToken && !hasPassword)) {
          return null;
        }
        return { actorId, token, email, password, username, label };
      })
      .filter((entry): entry is AdminAccessCredential => Boolean(entry));
  } catch (error) {
    console.error("admin_auth.credentials_json_parse_failed", error);
    return [];
  }
}

function parseFromLegacy(raw: string): AdminAccessCredential[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex <= 0) return null;
      const actorId = entry.slice(0, separatorIndex).trim();
      const remainder = entry.slice(separatorIndex + 1).trim();
      if (!actorId || !remainder) return null;

      let token = remainder;
      let label: string | undefined;
      const labelSeparator = remainder.indexOf("|");
      if (labelSeparator > -1) {
        token = remainder.slice(0, labelSeparator).trim();
        label = remainder.slice(labelSeparator + 1).trim() || undefined;
      }

      return token ? { actorId, token, label } : null;
    })
    .filter((entry): entry is AdminAccessCredential => Boolean(entry));
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

  const legacySource = process.env.ADMIN_ACCESS_TOKENS;
  if (legacySource) {
    credentials.push(...parseFromLegacy(legacySource));
  }

  cachedCredentials = credentials;
  return cachedCredentials;
}

export function findCredentialByToken(token: string): AdminAccessCredential | null {
  const credentials = getAdminAccessCredentials();
  return credentials.find((entry) => entry.token && entry.token === token) ?? null;
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
