import {
  adminApiRouteDefinitions,
  type AdminApiRouteKey,
  type AdminApiRouteParams,
  type AdminApiRoutePath,
  adminApiRoutePaths,
  type AdminApiRouteRecord,
  adminRouteDefinitions,
  type AdminRouteKey,
  type AdminRouteParams,
  type AdminRoutePath,
  adminRoutePaths,
  type AdminRouteRecord,
  type AdminRouteSegment,
  adminRouteSegments,
  getAdminApiRoutePath,
  getAdminRoutePath as baseGetAdminRoutePath,
  isAdminApiRoutePath,
  isAdminRoutePath,
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
  adminApiRouteDefinitions,
  adminApiRoutePaths,
  adminRouteDefinitions,
  adminRoutePaths,
  adminRouteSegments,
  getAdminApiRoutePath,
  isAdminApiRoutePath,
  isAdminRoutePath,
};

export type {
  AdminApiRouteKey,
  AdminApiRouteParams,
  AdminApiRoutePath,
  AdminApiRouteRecord,
  AdminRouteKey,
  AdminRouteParams,
  AdminRoutePath,
  AdminRouteRecord,
  AdminRouteSegment,
  NavigableAdminApiRouteKey,
  NavigableAdminApiRoutePath,
  NavigableAdminRouteKey,
  NavigableAdminRoutePath,
};

export { getAdminApiPath } from "./api";
