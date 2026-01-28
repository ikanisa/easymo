import path from "node:path";
import { pathToFileURL } from "node:url";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type AuthLevel = "public" | "user" | "admin" | "service";

type ServiceContractEndpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  auth: AuthLevel;
  requestSchema?: { safeParse: (input: unknown) => unknown };
  responseSchema?: { safeParse: (input: unknown) => unknown };
  description?: string;
};

type ServiceContract = {
  name: string;
  version: string;
  endpoints: ServiceContractEndpoint[];
  events?: Array<{ topic: string; role: "producer" | "consumer" }>;
  dependencies?: string[];
};

const contractsToValidate = [
  { name: "agent-core", path: "services/agent-core/src/contract.ts" },
  { name: "wallet-service", path: "services/wallet-service/src/contract.ts" },
];

const allowedMethods = new Set<HttpMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const allowedAuth = new Set<AuthLevel>(["public", "user", "admin", "service"]);

const isSchema = (value: unknown) =>
  Boolean(value) && typeof (value as { safeParse?: unknown }).safeParse === "function";

const loadContract = async (contractPath: string): Promise<ServiceContract> => {
  const module = await import(pathToFileURL(path.resolve(contractPath)).href);
  const contract = module.serviceContract ?? module.default;
  if (!contract) {
    throw new Error(`Missing export "serviceContract" in ${contractPath}`);
  }
  return contract as ServiceContract;
};

const validateContract = (contract: ServiceContract, expectedName: string): string[] => {
  const errors: string[] = [];

  if (contract.name !== expectedName) {
    errors.push(`name mismatch: expected "${expectedName}", got "${contract.name}"`);
  }

  if (!contract.version || typeof contract.version !== "string") {
    errors.push("version is required and must be a string");
  }

  if (!Array.isArray(contract.endpoints) || contract.endpoints.length === 0) {
    errors.push("endpoints must be a non-empty array");
    return errors;
  }

  const seenKeys = new Set<string>();
  for (const endpoint of contract.endpoints) {
    if (!endpoint.id || typeof endpoint.id !== "string") {
      errors.push("endpoint.id is required and must be a string");
    }
    if (!allowedMethods.has(endpoint.method)) {
      errors.push(`endpoint "${endpoint.id}" has invalid method "${endpoint.method}"`);
    }
    if (!endpoint.path || typeof endpoint.path !== "string") {
      errors.push(`endpoint "${endpoint.id}" has invalid path`);
    } else if (!endpoint.path.startsWith("/")) {
      errors.push(`endpoint "${endpoint.id}" path must start with "/"`);
    }
    if (!allowedAuth.has(endpoint.auth)) {
      errors.push(`endpoint "${endpoint.id}" has invalid auth "${endpoint.auth}"`);
    }
    if (endpoint.requestSchema && !isSchema(endpoint.requestSchema)) {
      errors.push(`endpoint "${endpoint.id}" requestSchema is not a zod schema`);
    }
    if (endpoint.responseSchema && !isSchema(endpoint.responseSchema)) {
      errors.push(`endpoint "${endpoint.id}" responseSchema is not a zod schema`);
    }

    const key = `${endpoint.method} ${endpoint.path}`;
    if (seenKeys.has(key)) {
      errors.push(`duplicate endpoint detected: ${key}`);
    } else {
      seenKeys.add(key);
    }
  }

  return errors;
};

let hasErrors = false;

for (const contractDef of contractsToValidate) {
  try {
    const contract = await loadContract(contractDef.path);
    const errors = validateContract(contract, contractDef.name);
    if (errors.length > 0) {
      hasErrors = true;
      console.error(`\n❌ Contract validation failed for ${contractDef.name}:`);
      errors.forEach((error) => console.error(`  - ${error}`));
    } else {
      console.log(`✅ Contract valid: ${contractDef.name} (${contract.endpoints.length} endpoints)`);
    }
  } catch (error) {
    hasErrors = true;
    console.error(`\n❌ Contract validation failed for ${contractDef.name}:`);
    console.error(`  - ${(error as Error).message}`);
  }
}

if (hasErrors) {
  process.exit(1);
}
