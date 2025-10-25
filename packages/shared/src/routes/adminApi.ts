import { compileRoutePath, type PathParams } from "./utils";

type AdminApiRouteDefinition<Path extends string = string, Key extends string = string> = {
  key: Key;
  path: Path;
};

const adminApiRouteDefinitions = [
  { key: "agents", path: "/api/agents" },
  { key: "agentDetail", path: "/api/agents/:agentId" },
  { key: "agentSearch", path: "/api/agents/:agentId/search" },
  { key: "agentDeploy", path: "/api/agents/:agentId/deploy" },
  { key: "agentVersions", path: "/api/agents/:agentId/versions" },
  { key: "agentVersion", path: "/api/agents/:agentId/versions/:versionId" },
  { key: "agentVersionPublish", path: "/api/agents/:agentId/versions/:versionId/publish" },
  { key: "agentDocuments", path: "/api/agents/:agentId/documents" },
  { key: "agentDocument", path: "/api/agents/:agentId/documents/:documentId" },
  { key: "agentDocumentSigned", path: "/api/agents/:agentId/documents/:documentId/signed" },
  { key: "agentDocumentsUpload", path: "/api/agents/:agentId/documents/upload" },
  { key: "agentDocumentsUrl", path: "/api/agents/:agentId/documents/url" },
  { key: "agentDocumentsEmbedAll", path: "/api/agents/:agentId/documents/embed_all" },
  { key: "agentDocumentsDriveSync", path: "/api/agents/:agentId/documents/drive_sync" },
  { key: "agentDocumentsWebSearch", path: "/api/agents/:agentId/documents/web_search" },
  { key: "agentDocumentEmbed", path: "/api/agents/:agentId/documents/:documentId/embed" },
  { key: "agentDocumentPreview", path: "/api/agents/:agentId/documents/:documentId/preview" },
  { key: "agentTasks", path: "/api/agents/:agentId/tasks" },
  { key: "agentRuns", path: "/api/agents/:agentId/runs" },
  { key: "subscriptions", path: "/api/subscriptions" },
  { key: "subscriptionEntitlements", path: "/api/subscriptions/entitlements" },
  { key: "subscriptionSubscribe", path: "/api/subscriptions/subscribe" },
  { key: "fxConvert", path: "/api/fx/convert" },
  { key: "walletPlatformProvision", path: "/api/wallet/platform/provision" },
  { key: "walletTransfer", path: "/api/wallet/transfer" },
  { key: "marketplaceSettings", path: "/api/marketplace/settings" },
  { key: "trips", path: "/api/trips" },
] as const satisfies ReadonlyArray<AdminApiRouteDefinition>;

type AdminApiRouteDefinitions = typeof adminApiRouteDefinitions;
export type AdminApiRouteRecord = AdminApiRouteDefinitions[number];
export type AdminApiRouteKey = AdminApiRouteRecord["key"];
export type AdminApiRoutePath = AdminApiRouteRecord["path"];

const adminApiRouteDefinitionMap = adminApiRouteDefinitions.reduce(
  (acc, definition) => {
    acc[definition.key as AdminApiRouteKey] = definition;
    return acc;
  },
  {} as Record<AdminApiRouteKey, AdminApiRouteRecord>,
);

export const adminApiRoutePaths = Object.freeze(
  adminApiRouteDefinitions.reduce(
    (acc, definition) => {
      acc[definition.key as AdminApiRouteKey] = definition.path;
      return acc;
    },
    {} as Record<AdminApiRouteKey, AdminApiRoutePath>,
  ),
);

const adminApiRoutePathSet = new Set<AdminApiRoutePath>(
  adminApiRouteDefinitions.map((definition) => definition.path),
);

export const isAdminApiRoutePath = (path: string): path is AdminApiRoutePath =>
  adminApiRoutePathSet.has(path as AdminApiRoutePath);

export type AdminApiRouteParams<Key extends AdminApiRouteKey> = PathParams<
  Extract<AdminApiRouteDefinitions[number], { key: Key }>["path"]
>;

type RouteKeysRequiringParams = {
  [Key in AdminApiRouteKey]: AdminApiRouteParams<Key> extends Record<string, never> ? never : Key;
}[AdminApiRouteKey];

export type NavigableAdminApiRouteKey = Exclude<AdminApiRouteKey, RouteKeysRequiringParams>;
export type NavigableAdminApiRoutePath = (typeof adminApiRoutePaths)[NavigableAdminApiRouteKey];

export const getAdminApiRoutePath = <Key extends AdminApiRouteKey>(
  key: Key,
  ...params: AdminApiRouteParams<Key> extends Record<string, never>
    ? []
    : [AdminApiRouteParams<Key>]
) => {
  const definition = adminApiRouteDefinitionMap[key];
  if (!definition) {
    throw new Error(`Unknown admin API route key: ${String(key)}`);
  }
  if (!params.length) {
    return definition.path;
  }
  return compileRoutePath(definition.path, params[0]);
};

export { adminApiRouteDefinitions };
