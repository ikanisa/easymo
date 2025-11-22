import { GetSecretValueCommand,SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const AWS_SECRET_REGEX = /^aws-sm:\/\/(.+)$/i;
const ENV_SECRET_REGEX = /^env:\/\/(.+)$/i;

const cache = new Map<string, Promise<string>>();
let client: SecretsManagerClient | null = null;

function getClient(): SecretsManagerClient {
  if (!client) {
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
    client = new SecretsManagerClient({ region });
  }
  return client;
}

async function fetchAwsSecret(secretId: string): Promise<string> {
  const existing = cache.get(secretId);
  if (existing) return existing;

  const promise = (async () => {
    const res = await getClient().send(new GetSecretValueCommand({ SecretId: secretId }));
    if (!res.SecretString) {
      throw new Error(`Secret ${secretId} missing SecretString`);
    }
    try {
      const json = JSON.parse(res.SecretString) as Record<string, unknown>;
      const value = json.service_role_key ?? json.token ?? json.value ?? json.secret;
      if (typeof value === "string") return value;
      const first = Object.values(json).find((entry): entry is string => typeof entry === "string");
      if (first) return first;
    } catch {
      // ignore parse error, treat as raw string
    }
    return res.SecretString;
  })();

  cache.set(secretId, promise);
  return promise;
}

export async function resolveSecret(options: {
  ref?: string | null;
  fallbackEnv?: string;
  label: string;
  optional?: boolean;
}): Promise<string | undefined> {
  const { ref, fallbackEnv, label, optional } = options;
  const trimmed = ref?.trim();

  if (trimmed) {
    const awsMatch = trimmed.match(AWS_SECRET_REGEX);
    if (awsMatch) {
      return await fetchAwsSecret(awsMatch[1]);
    }

    const envMatch = trimmed.match(ENV_SECRET_REGEX);
    if (envMatch) {
      const envValue = process.env[envMatch[1]];
      if (envValue) return envValue;
    }

    return trimmed;
  }

  if (fallbackEnv) {
    const envValue = process.env[fallbackEnv];
    if (envValue) return envValue;
  }

  if (optional) {
    return undefined;
  }

  throw new Error(`Missing secret for ${label}`);
}
