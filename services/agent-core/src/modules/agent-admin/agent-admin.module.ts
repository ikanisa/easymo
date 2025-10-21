import { Module } from "@nestjs/common";
import { AgentAdminService } from "./agent-admin.service.js";
import { AgentAdminController } from "./agent-admin.controller.js";
import { PrismaModule } from "../../prisma/prisma.module.js";

@Module({
  imports: [PrismaModule],
  providers: [AgentAdminService],
  controllers: [AgentAdminController],
  exports: [AgentAdminService],
})
export class AgentAdminModule {}

