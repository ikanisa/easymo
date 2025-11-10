import { compileRoutePath, type PathParams } from "./utils";

const appRouteDefinitions = [
  { key: "dashboard", path: "/" },
  { key: "subscriptions", path: "/subscriptions" },
  { key: "users", path: "/users" },
  { key: "trips", path: "/trips" },
  { key: "favorites", path: "/favorites" },
  { key: "scheduleTrip", path: "/schedule-trip" },
  { key: "quickActions", path: "/quick-actions" },
  { key: "driverParking", path: "/driver-parking" },
  { key: "driverAvailability", path: "/driver-availability" },
  { key: "matches", path: "/matches" },
  { key: "agentTooling", path: "/agent-tooling" },
  { key: "settings", path: "/settings" },
  { key: "tokens", path: "/tokens" },
  { key: "tokensIssue", path: "/tokens/issue" },
  { key: "tokensWallets", path: "/tokens/wallets" },
  { key: "tokensWalletDetail", path: "/tokens/wallets/:id" },
  { key: "tokensShops", path: "/tokens/shops" },
  { key: "tokensReports", path: "/tokens/reports" },
  { key: "baskets", path: "/baskets" },
  { key: "marketplace", path: "/marketplace" },
  { key: "operations", path: "/operations" },
  { key: "voiceOps", path: "/voice-ops" },
  { key: "realtime", path: "/realtime" },
  { key: "developer", path: "/developer" },
  { key: "agentPatterns", path: "/agent-patterns" },
  { key: "adminWaConsole", path: "/admin/wa-console" },
  { key: "adminSimulator", path: "/admin/simulator" },
  { key: "notFound", path: "*" },
] as const;

export type AppRouteDefinitions = typeof appRouteDefinitions;
export type AppRouteDefinition = AppRouteDefinitions[number];
export type AppRouteKey = AppRouteDefinition["key"];
export type AppRoutePath = AppRouteDefinition["path"];

const appRouteDefinitionMap = Object.freeze(
  appRouteDefinitions.reduce((acc, definition) => {
    acc[definition.key as AppRouteKey] = definition;
    return acc;
  }, {} as Record<AppRouteKey, AppRouteDefinition>),
);

export const appRoutePaths = Object.freeze(
  appRouteDefinitions.reduce((acc, definition) => {
    acc[definition.key as AppRouteKey] = definition.path;
    return acc;
  }, {} as Record<AppRouteKey, AppRoutePath>),
);

const appRoutePathSet = new Set<AppRoutePath>(
  appRouteDefinitions.map((definition) => definition.path),
);

export type AppRouteParams<Key extends AppRouteKey> = PathParams<
  Extract<AppRouteDefinitions[number], { key: Key }>["path"]
>;

type RouteKeysRequiringParams = {
  [Key in AppRouteKey]: AppRouteParams<Key> extends Record<string, never> ? never : Key;
}[AppRouteKey];

export type NavigableAppRouteKey = Exclude<AppRouteKey, RouteKeysRequiringParams>;
export type NavigableAppRoutePath = (typeof appRoutePaths)[NavigableAppRouteKey];

export const getAppRoutePath = <Key extends AppRouteKey>(
  key: Key,
  ...params: AppRouteParams<Key> extends Record<string, never>
    ? []
    : [AppRouteParams<Key>]
) => {
  const definition = appRouteDefinitionMap[key];
  if (!definition) {
    throw new Error(`Unknown app route key: ${String(key)}`);
  }
  if (!params.length) {
    return definition.path;
  }
  return compileRoutePath(definition.path, params[0]);
};

export const isAppRoutePath = (path: string): path is AppRoutePath =>
  appRoutePathSet.has(path as AppRoutePath);

export { appRouteDefinitions };
