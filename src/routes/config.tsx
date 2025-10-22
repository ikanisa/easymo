import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import {
  appRouteDefinitions as sharedAppRouteDefinitions,
  appRoutePaths,
  getAppRoutePath,
  isAppRoutePath,
} from "@va/shared";
import type {
  AppRouteDefinition,
  AppRouteKey,
  AppRouteParams,
  AppRoutePath,
  NavigableAppRouteKey,
  NavigableAppRoutePath,
} from "@va/shared";

export type {
  AppRouteDefinition,
  AppRouteKey,
  AppRouteParams,
  AppRoutePath,
  NavigableAppRouteKey,
  NavigableAppRoutePath,
} from "@va/shared";

type RouteComponent = ComponentType<Record<string, never>>;

type RouteLoader = () => Promise<{ default: RouteComponent }>;

type RouteDefinition = {
  key: AppRouteKey;
  path: AppRoutePath;
  loader: RouteLoader;
};

type PreloadableLazyComponent = LazyExoticComponent<RouteComponent> & {
  preload: RouteLoader;
};

type LazyRoute<Path extends string = string, Key extends string = string> = {
  key: Key;
  path: Path;
  Component: PreloadableLazyComponent;
};

type LazyRouteMap<T extends ReadonlyArray<RouteDefinition>> = {
  [Path in T[number]["path"]]: PreloadableLazyComponent;
};

type RouteDefinitionMap<T extends ReadonlyArray<RouteDefinition>> = {
  [Key in T[number]["key"]]: Extract<T[number], { key: Key }>;
};

const defineLazyRoutes = <const T extends ReadonlyArray<RouteDefinition>>(definitions: T) => {
  const routes = definitions.map(({ key, path, loader }) => ({
    key,
    path,
    Component: Object.assign(lazy(loader), { preload: loader }) as PreloadableLazyComponent,
  })) as {
    [K in keyof T]: LazyRoute<T[K]["path"], T[K]["key"]>;
  };

  const routeMap = routes.reduce((acc, { path, Component }) => {
    acc[path as T[number]["path"]] = Component;
    return acc;
  }, {} as LazyRouteMap<T>);

  const definitionMap = definitions.reduce((acc, definition) => {
    acc[definition.key as T[number]["key"]] = definition;
    return acc;
  }, {} as RouteDefinitionMap<T>);

  return {
    routes: routes as ReadonlyArray<LazyRoute>,
    routeMap,
    definitionMap,
  } as const;
};

const routeLoaderMap = {
  dashboard: () => import("@/pages/Index"),
  subscriptions: () => import("@/pages/Subscriptions"),
  users: () => import("@/pages/Users"),
  trips: () => import("@/pages/Trips"),
  favorites: () => import("@/pages/Favorites"),
  scheduleTrip: () => import("@/pages/ScheduleTrip"),
  quickActions: () => import("@/pages/QuickActions"),
  driverParking: () => import("@/pages/DriverParking"),
  driverAvailability: () => import("@/pages/DriverAvailability"),
  matches: () => import("@/pages/Matches"),
  agentTooling: () => import("@/pages/AgentTooling"),
  settings: () => import("@/pages/Settings"),
  tokens: () => import("@/pages/tokens/Wallets"),
  tokensIssue: () => import("@/pages/tokens/Issue"),
  tokensWallets: () => import("@/pages/tokens/Wallets"),
  tokensWalletDetail: () => import("@/pages/tokens/WalletDetail"),
  tokensShops: () => import("@/pages/tokens/Shops"),
  tokensReports: () => import("@/pages/tokens/Reports"),
  campaigns: () => import("@/marketing/CampaignsPage"),
  baskets: () => import("@/pages/Baskets"),
  marketplace: () => import("@/pages/Marketplace"),
  operations: () => import("@/pages/Operations"),
  voiceOps: () => import("@/pages/VoiceOps"),
  realtime: () => import("@/pages/Realtime"),
  developer: () => import("@/pages/Developer"),
  agentPatterns: () => import("@/pages/AgentPatterns"),
  adminWaConsole: () => import("@/pages/WAConsole"),
  adminSimulator: () => import("@/pages/Simulator"),
  notFound: () => import("@/pages/NotFound"),
} satisfies Record<AppRouteKey, RouteLoader>;

const routeDefinitions = sharedAppRouteDefinitions.map((definition) => ({
  ...definition,
  loader: routeLoaderMap[definition.key],
})) as const satisfies ReadonlyArray<RouteDefinition>;

const { routes: appRoutes, routeMap: appRouteComponents, definitionMap: appRouteDefinitions } =
  defineLazyRoutes(routeDefinitions);

export const getAppRouteComponent = (path: AppRoutePath) => appRouteComponents[path];

export { appRouteComponents, appRouteDefinitions, appRoutePaths, appRoutes, getAppRoutePath, isAppRoutePath };

export type { LazyRoute };
