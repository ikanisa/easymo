export {
  adminRouteDefinitions,
  adminRoutePaths,
  adminRouteSegments,
  adminApiRouteDefinitions,
  adminApiRoutePaths,
  getAdminRoutePath,
  getAdminApiRoutePath,
  isAdminRoutePath,
  isAdminApiRoutePath,
} from "@va/shared";

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
} from "@va/shared";

export { ADMIN_API_BASE_PATH, getAdminApiPath } from "./api";
