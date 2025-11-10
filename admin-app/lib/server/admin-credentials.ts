import { authorizeActor } from "@/lib/auth/credentials";

export type AdminCredentialRecord = {
  actorId: string;
  email: string;
  password: string;
  username?: string;
  label?: string | null;
};

let cachedCredentials: AdminCredentialRecord[] | null = null;

function parseCredentialsFromEnv(): AdminCredentialRecord[] {
  const raw = process.env.ADMIN_ACCESS_CREDENTIALS;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Expected ADMIN_ACCESS_CREDENTIALS to be an array");
    }

    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const actorId = typeof record.actorId === "string" ? record.actorId : null;
        const email = typeof record.email === "string" ? record.email : null;
        const password = typeof record.password === "string" ? record.password : null;
        if (!actorId || !email || !password) return null;
        return {
          actorId,
          email,
          password,
          username: typeof record.username === "string" ? record.username : undefined,
          label: typeof record.label === "string" ? record.label : null,
        } satisfies AdminCredentialRecord;
      })
      .filter((value): value is AdminCredentialRecord => Boolean(value));
  } catch (error) {
    console.error("admin.credentials.invalid_config", error);
    return [];
  }
}

export function getAdminCredentials(): AdminCredentialRecord[] {
  if (!cachedCredentials) {
    cachedCredentials = parseCredentialsFromEnv();
  }
  return cachedCredentials;
}

export function findAdminCredentialByEmail(email: string): AdminCredentialRecord | null {
  const normalized = email.trim().toLowerCase();
  return (
    getAdminCredentials().find((credential) => credential.email.trim().toLowerCase() === normalized) ??
    null
  );
}

export function verifyAdminCredential(
  email: string,
  password: string,
): AdminCredentialRecord | null {
  const credential = findAdminCredentialByEmail(email);
  if (!credential) {
    return null;
  }
  if (credential.password !== password) {
    return null;
  }
  authorizeActor(credential.actorId);
  return credential;
}
