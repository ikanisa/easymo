import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const AWS_SECRET_REGEX = /^aws-sm:\/\/(.+)$/i;
const ENV_REF_REGEX = /^env:\/\/(.+)$/i;

const cachedSecrets = new Map<string, Promise<string>>();

let secretsClient: SecretsManagerClient | null = null;

function getSecretsClient(): SecretsManagerClient {
  if (!secretsClient) {
    const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
    secretsClient = new SecretsManagerClient({ region });
  }
  return secretsClient;
}

async function fetchAwsSecret(secretId: string): Promise<string> {
  const cached = cachedSecrets.get(secretId);
  if (cached) return cached;

  const promise = (async () => {
    const client = getSecretsClient();
    const result = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    if (!result.SecretString) {
      throw new Error(`Secret ${secretId} has no SecretString value`);
    }
    try {
      const parsed = JSON.parse(result.SecretString) as Record<string, unknown>;
      const preferred = parsed.token ?? parsed.value ?? parsed.secret ?? parsed.WHATSAPP_TOKEN;
      if (typeof preferred === "string") {
        return preferred;
      }
      const firstValue = Object.values(parsed).find((value): value is string => typeof value === "string");
      if (firstValue) {
        return firstValue;
      }
      throw new Error(`Secret ${secretId} does not contain a string value`);
    } catch {
      return result.SecretString;
    }
  })();

  cachedSecrets.set(secretId, promise);
  return promise;
}

export async function resolveSecretValue(options: {
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

    const envMatch = trimmed.match(ENV_REF_REGEX);
    if (envMatch) {
      const envValue = process.env[envMatch[1]];
      if (envValue) return envValue;
    }

    if (trimmed.length) {
      return trimmed;
    }
  }

  if (fallbackEnv) {
    const fallback = process.env[fallbackEnv];
    if (fallback) {
      return fallback;
    }
  }

  if (optional) {
    return undefined;
  }

  throw new Error(`Missing required secret for ${label}`);
}
