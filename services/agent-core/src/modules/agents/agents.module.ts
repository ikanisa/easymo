import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AgentsService } from "./agents.service.js";

@Module({
  imports: [ConfigModule],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
