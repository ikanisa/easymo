import { Logger, Module } from "@nestjs/common";

import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard.js";
import { ServiceAuthGuard } from "../../common/guards/service-auth.guard.js";
import { ToolsController } from "./tools.controller.js";
import { ToolsService } from "./tools.service.js";

@Module({
  controllers: [ToolsController],
  providers: [ToolsService, ServiceAuthGuard, FeatureFlagGuard, Logger],
})
export class ToolsModule {}
