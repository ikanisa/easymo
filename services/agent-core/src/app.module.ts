import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import configuration from "./config/configuration.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { ToolsModule } from "./modules/tools/tools.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { LoggerModule } from "nestjs-pino";
import { AgentsModule } from "./modules/agents/agents.module.js";
import { AgentAdminModule } from "./modules/agent-admin/agent-admin.module.js";
import { getRequestId } from "@easymo/commons";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        customProps: () => {
          const requestId = getRequestId();
          return requestId ? { requestId } : {};
        },
      },
    }),
    PrismaModule,
    HealthModule,
    AgentsModule,
    ToolsModule,
    AgentAdminModule,
  ],
})
export class AppModule {}
