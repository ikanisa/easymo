import type { AgentPermission } from "@easymo/commons";
import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "agent.permissions";

export const RequirePermissions = (...permissions: AgentPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
