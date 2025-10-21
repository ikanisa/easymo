export type AgentKind = "broker" | "support" | "sales" | "marketing" | "mobility";

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

export type AgentTokenClaims = {
  sub: string;
  tenantId: string;
  agentConfigId: string;
  agentKind: AgentKind;
  permissions: AgentPermission[];
  sessionId?: string;
  iat?: number;
  exp?: number;
};

export type AgentContext = {
  agentId: string;
  tenantId: string;
  agentConfigId: string;
  agentKind: AgentKind;
  permissions: Set<AgentPermission>;
  token: string;
  sessionId?: string;
};
