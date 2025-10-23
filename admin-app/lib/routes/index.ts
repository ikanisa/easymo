import {
  adminRouteDefinitions,
  adminRoutePaths,
  adminRouteSegments,
  getAdminRoutePath as baseGetAdminRoutePath,
  isAdminRoutePath,
  // Admin API re‑exports (typed routes defined in shared)
  getAdminApiRoutePath,
  type AdminRouteKey,
  type AdminRouteParams,
  type AdminRoutePath,
  type AdminRouteRecord,
  type AdminRouteSegment,
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
  if (params.length === 0) {
    return baseGetAdminRoutePath(key) as Route;
  }

  return baseGetAdminRoutePath(key, params[0]) as Route;
};

export type AdminNavigableRoute = Extract<NavigableAdminRoutePath, Route>;

export const toAdminRoute = (path: NavigableAdminRoutePath): AdminNavigableRoute =>
  path as AdminNavigableRoute;

export {
  adminRouteDefinitions,
  adminRoutePaths,
  adminRouteSegments,
  isAdminRoutePath,
  // expose API route helper expected by app code
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
};

// Also re-export REST-style path helper for backwards compatibility
export * from "./api";
