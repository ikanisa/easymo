import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AiService } from "./ai.service.js";
import { AiController } from "./ai.controller.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";

@Module({
  imports: [ConfigModule],
  providers: [AiService, ServiceTokenGuard],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
