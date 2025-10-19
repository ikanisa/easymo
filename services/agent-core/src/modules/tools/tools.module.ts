import { Logger, Module } from "@nestjs/common";
import { ToolsController } from "./tools.controller.js";
import { ToolsService } from "./tools.service.js";
import { ServiceAuthGuard } from "../../common/guards/service-auth.guard.js";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard.js";

@Module({
  controllers: [ToolsController],
  providers: [ToolsService, ServiceAuthGuard, FeatureFlagGuard, Logger],
})
export class ToolsModule {}
