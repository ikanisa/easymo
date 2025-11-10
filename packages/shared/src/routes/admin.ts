import { compileRoutePath, type PathParams } from "./utils";

export type AdminRouteSegment = "root" | "panel" | "admin";

type AdminRouteDefinition<Path extends string = string, Key extends string = string> = {
  key: Key;
  path: Path;
  segment: AdminRouteSegment;
};

const adminRouteDefinitions = [
  { key: "rootIndex", path: "/", segment: "root" },
  { key: "login", path: "/login", segment: "root" },
  { key: "rootAgentsPlayground", path: "/agents", segment: "root" },
  { key: "panelDashboard", path: "/dashboard", segment: "panel" },
  { key: "panelUsers", path: "/users", segment: "panel" },
  { key: "panelInsurance", path: "/insurance", segment: "panel" },
  { key: "panelBars", path: "/bars", segment: "panel" },
  { key: "panelMenus", path: "/menus", segment: "panel" },
  { key: "panelTrips", path: "/trips", segment: "panel" },
  { key: "panelStaffNumbers", path: "/staff-numbers", segment: "panel" },
  { key: "panelStations", path: "/stations", segment: "panel" },
  { key: "panelLiveCalls", path: "/live-calls", segment: "panel" },
  { key: "panelVoiceAnalytics", path: "/voice-analytics", segment: "panel" },
  { key: "panelLeads", path: "/leads", segment: "panel" },
  { key: "panelQr", path: "/qr", segment: "panel" },
  { key: "panelDeepLinks", path: "/deep-links", segment: "panel" },
  { key: "panelWhatsAppHealth", path: "/whatsapp-health", segment: "panel" },
  { key: "panelNotifications", path: "/notifications", segment: "panel" },
  { key: "panelFiles", path: "/files", segment: "panel" },
  { key: "panelMarketplace", path: "/marketplace", segment: "panel" },
  { key: "panelMarketplaceSettings", path: "/marketplace/settings", segment: "panel" },
  { key: "panelAgents", path: "/agents", segment: "panel" },
  { key: "panelAgentDetail", path: "/agents/:agentId", segment: "panel" },
  { key: "panelDriverSubscriptions", path: "/driver-subscriptions", segment: "panel" },
  { key: "panelWalletTopUp", path: "/wallet/topup", segment: "panel" },
  { key: "panelSettings", path: "/settings", segment: "panel" },
  { key: "panelLogs", path: "/logs", segment: "panel" },
  { key: "panelSubscriptions", path: "/subscriptions", segment: "panel" },
  { key: "panelAiChatCompletions", path: "/ai/chat-completions", segment: "panel" },
  { key: "adminAgents", path: "/agents", segment: "admin" },
  { key: "adminAgentNew", path: "/agents/new", segment: "admin" },
  { key: "adminAgentDetail", path: "/agents/:agentId", segment: "admin" },
  { key: "adminAgentSearch", path: "/agents/:agentId/search", segment: "admin" },
  { key: "adminInsuranceQueue", path: "/insurance/queue", segment: "admin" },
  { key: "adminMobilityDispatch", path: "/mobility/dispatch", segment: "admin" },
] as const satisfies ReadonlyArray<AdminRouteDefinition>;

type AdminRouteDefinitions = typeof adminRouteDefinitions;
export type AdminRouteRecord = AdminRouteDefinitions[number];
export type AdminRouteKey = AdminRouteRecord["key"];
export type AdminRoutePath = AdminRouteRecord["path"];

const adminRouteDefinitionMap = adminRouteDefinitions.reduce(
  (acc, definition) => {
    acc[definition.key as AdminRouteKey] = definition;
    return acc;
  },
  {} as Record<AdminRouteKey, AdminRouteRecord>,
);

export const adminRoutePaths = Object.freeze(
  adminRouteDefinitions.reduce(
    (acc, definition) => {
      acc[definition.key as AdminRouteKey] = definition.path;
      return acc;
    },
    {} as Record<AdminRouteKey, AdminRoutePath>,
  ),
);

export const adminRouteSegments = Object.freeze(
  adminRouteDefinitions.reduce(
    (acc, definition) => {
      acc[definition.key as AdminRouteKey] = definition.segment;
      return acc;
    },
    {} as Record<AdminRouteKey, AdminRouteSegment>,
  ),
);

const adminRoutePathSet = new Set<AdminRoutePath>(
  adminRouteDefinitions.map((definition) => definition.path),
);

export const isAdminRoutePath = (path: string): path is AdminRoutePath =>
  adminRoutePathSet.has(path as AdminRoutePath);

export type AdminRouteParams<Key extends AdminRouteKey> = PathParams<
  Extract<AdminRouteDefinitions[number], { key: Key }>["path"]
>;

type RouteKeysRequiringParams = {
  [Key in AdminRouteKey]: AdminRouteParams<Key> extends Record<string, never> ? never : Key;
}[AdminRouteKey];

export type NavigableAdminRouteKey = Exclude<AdminRouteKey, RouteKeysRequiringParams>;
export type NavigableAdminRoutePath = (typeof adminRoutePaths)[NavigableAdminRouteKey];

export const getAdminRoutePath = <Key extends AdminRouteKey>(
  key: Key,
  ...params: AdminRouteParams<Key> extends Record<string, never>
    ? []
    : [AdminRouteParams<Key>]
) => {
  const definition = adminRouteDefinitionMap[key];
  if (!definition) {
    throw new Error(`Unknown admin route key: ${String(key)}`);
  }
  if (!params.length) {
    return definition.path;
  }
  return compileRoutePath(definition.path, params[0]);
};

export { adminRouteDefinitions };
