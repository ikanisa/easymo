import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AiController } from "./ai.controller.js";
import { AiService } from "./ai.service.js";
import { RealtimeFarmerController } from "./realtime-farmer.controller.js";
import { RealtimeFarmerService } from "./realtime-farmer.service.js";
import { SoraOrchestratorService } from "./sora-orchestrator.service.js";

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AiService, ServiceTokenGuard, SoraOrchestratorService, RealtimeFarmerService],
  controllers: [AiController, RealtimeFarmerController],
  exports: [AiService, SoraOrchestratorService, RealtimeFarmerService],
})
export class AiModule {}
