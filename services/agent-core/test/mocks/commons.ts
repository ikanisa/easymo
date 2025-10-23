import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

type RequestContextSeed = string | { requestId?: string } | undefined;

type RequestContext = {
  requestId: string;
};

const requestContext = new AsyncLocalStorage<RequestContext>();

const normaliseSeed = (seed: RequestContextSeed): RequestContext => {
  if (typeof seed === "string" && seed.trim().length > 0) {
    return { requestId: seed };
  }
  if (seed && typeof seed === "object" && typeof seed.requestId === "string" && seed.requestId.trim().length > 0) {
    return { requestId: seed.requestId };
  }
  return { requestId: randomUUID() };
};

export const getRequestId = (): string | undefined => {
  return requestContext.getStore()?.requestId;
};

export const setRequestId = (requestId: string): void => {
  if (!requestId || requestId.trim().length === 0) {
    return;
  }
  const store = requestContext.getStore();
  if (store) {
    store.requestId = requestId;
    requestContext.enterWith(store);
  } else {
    requestContext.enterWith({ requestId });
  }
};

export const runWithRequestContext = <T>(fn: () => T, seed?: RequestContextSeed): T => {
  return requestContext.run(normaliseSeed(seed), fn);
};

export const withRequestContext = async <T>(fn: () => Promise<T> | T, seed?: RequestContextSeed): Promise<T> => {
  return await requestContext.run(normaliseSeed(seed), async () => await fn());
};

export type AgentKind = "broker" | "support" | "sales" | "marketing";
export type AgentPermission =
  | "lead.read"
  | "lead.write"
  | "lead.optOut"
  | "call.write"
  | "call.transfer"
  | "disposition.write"
  | "payment.collect";

export const AGENT_PERMISSIONS: readonly AgentPermission[] = [
  "lead.read",
  "lead.write",
  "lead.optOut",
  "call.write",
  "call.transfer",
  "disposition.write",
  "payment.collect",
] as const;

const controllerBasePaths: Record<string, string> = {
  chat: "",
  tools: "tools",
  health: "health",
  agentAdmin: "admin/agents",
  ai: "ai",
  aiTasks: "ai/tasks",
};

export const agentCoreControllerBasePath = controllerBasePaths.chat;

export const getAgentCoreControllerBasePath = (key: string) => controllerBasePaths[key] ?? "";

const routeSegments: Record<string, string> = {
  respond: "respond",
  toolsListLeads: "leads",
  toolsFetchLead: "fetch-lead",
  toolsLogLead: "log-lead",
  toolsCreateCall: "create-call",
  toolsSetDisposition: "set-disposition",
  toolsRegisterOptOut: "register-opt-out",
  toolsCollectPayment: "collect-payment",
  toolsWarmTransfer: "warm-transfer",
  health: "",
  agentAdminList: "",
  agentAdminCreate: "",
  agentAdminGet: ":id",
  agentAdminUpdate: ":id",
  agentAdminListRevisions: ":id/revisions",
  agentAdminCreateRevision: ":id/revisions",
  agentAdminPublishRevision: ":id/publish",
  agentAdminListDocuments: ":id/documents",
  agentAdminCreateDocument: ":id/documents",
  agentAdminListTasks: ":id/tasks",
  agentAdminCreateTask: ":id/tasks",
  aiBrokerOrchestrate: "broker/orchestrate",
  aiSettlementRun: "settlement/run",
  aiAttributionRun: "attribution/run",
  aiReconciliationRun: "reconciliation/run",
  aiSupportRun: "support/run",
  aiTasksSchedule: "schedule",
  aiTasksRunDue: "run-due",
};

const routePermissions: Record<string, AgentPermission[]> = {
  toolsListLeads: ["lead.read"],
  toolsFetchLead: ["lead.read"],
  toolsLogLead: ["lead.write"],
  toolsCreateCall: ["call.write"],
  toolsSetDisposition: ["disposition.write"],
  toolsRegisterOptOut: ["lead.optOut"],
  toolsCollectPayment: ["payment.collect"],
  toolsWarmTransfer: ["call.transfer"],
};

const routeServiceScopes: Record<string, string[]> = {
  aiBrokerOrchestrate: ["ai:broker.orchestrate"],
  aiSettlementRun: ["ai:settlement"],
  aiAttributionRun: ["ai:attribution"],
  aiReconciliationRun: ["ai:reconciliation"],
  aiSupportRun: ["ai:support"],
  aiTasksSchedule: ["tasks:schedule"],
  aiTasksRunDue: ["tasks:run"],
};

export const getAgentCoreRouteSegment = (key: string) => routeSegments[key] ?? key;

export const getAgentCoreRoutePermissions = (key: string): AgentPermission[] =>
  routePermissions[key]?.slice() ?? [];

export const getAgentCoreRouteServiceScopes = (key: string): string[] =>
  routeServiceScopes[key]?.slice() ?? [];

export type AgentContext = {
  agentId: string;
  tenantId: string;
  agentConfigId: string;
  agentKind: AgentKind;
  permissions: Set<AgentPermission>;
  token: string;
  sessionId?: string;
};

export type FeatureFlag =
  | "agent.chat"
  | "agent.collectPayment"
  | "agent.warmTransfer"
  | "wallet.service"
  | "marketplace.ranking"
  | "marketplace.vendor"
  | "marketplace.buyer";

const DEFAULT_FLAGS: Record<FeatureFlag, boolean> = {
  "agent.chat": true,
  "agent.collectPayment": false,
  "agent.warmTransfer": false,
  "wallet.service": false,
  "marketplace.ranking": false,
  "marketplace.vendor": false,
  "marketplace.buyer": false,
};

const featureFlagKey = (flag: FeatureFlag) => `FEATURE_${flag.replace(/\./g, "_").toUpperCase()}`;

export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  const key = featureFlagKey(flag);
  const value = process.env[key];
  if (value === undefined) {
    return DEFAULT_FLAGS[flag];
  }
  return ["1", "true", "yes"].includes(value.toLowerCase());
};

export type Scope = string;

export interface ServiceJwtClaims extends JWTPayload {
  scope?: string | string[];
  [key: string]: unknown;
}

export interface SignServiceJwtOptions {
  audience: string | string[];
  scope?: Scope[];
  subject?: string;
  expiresInSeconds?: number;
  additionalClaims?: Record<string, unknown>;
  issuer?: string;
  jwtId?: string;
}

export interface VerifyServiceJwtOptions {
  audience?: string | string[];
  requiredScopes?: Scope[];
  leewaySeconds?: number;
  issuer?: string;
}

export interface VerifiedServiceToken {
  token: string;
  payload: ServiceJwtClaims;
  scopes: Scope[];
  audience?: string | string[];
}

export interface BuildAuthHeadersOptions extends SignServiceJwtOptions {
  requestId?: string;
  extraHeaders?: Record<string, string>;
  service?: string;
}

export type ServiceAuthContext = VerifiedServiceToken & {
  serviceName?: string;
  scope?: Scope[];
};

export class ServiceAuthError extends Error {
  constructor(
    readonly code: "missing_token" | "invalid_token" | "invalid_scope" | "invalid_request",
    readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ServiceAuthError";
  }
}

const textEncoder = new TextEncoder();

const parseSigningKeys = (): Uint8Array[] => {
  const raw = process.env.SERVICE_JWT_KEYS ?? process.env.SERVICE_JWT_SECRET ?? "test-secret";
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => textEncoder.encode(value));
};

const extractScopes = (input?: string | string[]): Scope[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter(Boolean);
  }
  return input
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
};

const normaliseAudience = (audience?: string | string[]): string | string[] | undefined => {
  if (!audience) return undefined;
  if (Array.isArray(audience) && audience.length === 1) {
    return audience[0];
  }
  return audience;
};

const issuerFromEnv = () => (process.env.SERVICE_JWT_ISSUER ?? "easymo-services").trim();

export const signServiceJwt = async (options: SignServiceJwtOptions): Promise<string> => {
  const keys = parseSigningKeys();
  const signingKey = keys[0];
  if (!signingKey) {
    throw new Error("SERVICE_JWT_KEYS must provide at least one signing secret");
  }

  const issuer = options.issuer ?? issuerFromEnv();
  const expires = options.expiresInSeconds ?? 300;
  const scopes = options.scope && options.scope.length > 0 ? options.scope.join(" ") : undefined;
  const payload: ServiceJwtClaims = {
    scope: scopes,
    ...options.additionalClaims,
  };
  if (options.subject) {
    payload.sub = options.subject;
  }

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(options.audience)
    .setIssuedAt()
    .setExpirationTime(`${expires}s`)
    .setJti(options.jwtId ?? randomUUID())
    .sign(signingKey);
};

export const verifyServiceJwt = async (
  token: string,
  options: VerifyServiceJwtOptions = {},
): Promise<ServiceAuthContext> => {
  const keys = parseSigningKeys();
  const issuer = options.issuer ?? issuerFromEnv();
  const tolerance = options.leewaySeconds ?? 60;
  let lastError: unknown;

  for (const key of keys) {
    try {
      const { payload } = await jwtVerify<ServiceJwtClaims>(token, key, {
        issuer,
        audience: normaliseAudience(options.audience),
        clockTolerance: tolerance,
      });

      const scopes = extractScopes(payload.scope);
      if (options.requiredScopes && options.requiredScopes.length > 0) {
        const missing = options.requiredScopes.filter((scope) => !scopes.includes(scope));
        if (missing.length > 0) {
          throw new ServiceAuthError("invalid_scope", 403, `Missing required scopes: ${missing.join(", ")}`);
        }
      }

      const context: ServiceAuthContext = {
        token,
        payload,
        scopes,
        scope: scopes,
        audience: payload.aud ?? options.audience,
      };
      return context;
    } catch (error) {
      if (error instanceof ServiceAuthError) {
        throw error;
      }
      lastError = error;
    }
  }

  if (lastError instanceof ServiceAuthError) {
    throw lastError;
  }

  throw new ServiceAuthError("invalid_token", 401);
};

export const buildAuthHeaders = async (options: BuildAuthHeadersOptions): Promise<Record<string, string>> => {
  const token = await signServiceJwt(options);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "X-Service-Name": options.service ?? process.env.SERVICE_NAME ?? "agent-core-tests",
  };
  if (options.requestId) {
    headers["X-Request-ID"] = options.requestId;
  }
  if (options.extraHeaders) {
    Object.assign(headers, options.extraHeaders);
  }
  return headers;
};
