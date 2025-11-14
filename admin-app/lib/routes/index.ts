import {
  adminApiRouteDefinitions,
  adminApiRoutePaths,
  adminRouteDefinitions,
  adminRoutePaths,
  adminRouteSegments,
  getAdminApiRoutePath,
  getAdminRoutePath as baseGetAdminRoutePath,
  isAdminApiRoutePath,
  isAdminRoutePath,
  type AdminApiRouteKey,
  type AdminApiRouteParams,
  type AdminApiRoutePath,
  type AdminApiRouteRecord,
  type AdminRouteKey,
  type AdminRouteParams,
  type AdminRoutePath,
  type AdminRouteRecord,
  type AdminRouteSegment,
  type NavigableAdminApiRouteKey,
  type NavigableAdminApiRoutePath,
  type NavigableAdminRouteKey,
  type NavigableAdminRoutePath,
} from "@va/shared";
import type { Route } from "next";

export const getAdminRoutePath = <Key extends AdminRouteKey>(
  key: Key,
  ...params: AdminRouteParams<Key> extends Record<string, never>
    ? []
    : [AdminRouteParams<Key>]
): Route => {
  return baseGetAdminRoutePath(key, ...(params as typeof params)) as Route;
};

export type AdminNavigableRoute = Extract<NavigableAdminRoutePath, Route>;

export const toAdminRoute = (path: NavigableAdminRoutePath): AdminNavigableRoute =>
  path as AdminNavigableRoute;

export {
  adminRouteDefinitions,
  adminRoutePaths,
  adminRouteSegments,
  isAdminRoutePath,
  adminApiRouteDefinitions,
  adminApiRoutePaths,
  isAdminApiRoutePath,
  getAdminApiRoutePath,
};

export type {
  AdminRouteKey,
  AdminRouteParams,
  AdminRoutePath,
  AdminRouteRecord,
  AdminRouteSegment,
  NavigableAdminRouteKey,
  NavigableAdminRoutePath,
  AdminApiRouteKey,
  AdminApiRouteParams,
  AdminApiRoutePath,
  AdminApiRouteRecord,
  NavigableAdminApiRouteKey,
  NavigableAdminApiRoutePath,
};

export { getAdminApiPath } from "./api";
