import { SetMetadata } from "@nestjs/common";
import type { AgentPermission } from "@easymo/commons";

export const PERMISSIONS_KEY = "agent.permissions";

export const RequirePermissions = (...permissions: AgentPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
