import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { AiModule } from "../ai/ai.module.js";
import { TasksController } from "./tasks.controller.js";
import { TasksService } from "./tasks.service.js";

@Module({
  imports: [ConfigModule, PrismaModule, AiModule],
  providers: [TasksService, ServiceTokenGuard],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
