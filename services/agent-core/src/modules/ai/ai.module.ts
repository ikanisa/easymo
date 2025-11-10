import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiService } from "./ai.service.js";
import { AiController } from "./ai.controller.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { SoraOrchestratorService } from "./sora-orchestrator.service.js";

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AiService, ServiceTokenGuard, SoraOrchestratorService],
  controllers: [AiController],
  exports: [AiService, SoraOrchestratorService],
})
export class AiModule {}
