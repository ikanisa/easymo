import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module.js";
import { AgentAdminController } from "./agent-admin.controller.js";
import { AgentAdminService } from "./agent-admin.service.js";

@Module({
  imports: [PrismaModule],
  providers: [AgentAdminService],
  controllers: [AgentAdminController],
  exports: [AgentAdminService],
})
export class AgentAdminModule {}

