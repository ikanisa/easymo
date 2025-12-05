import { getRequestId } from "@easymo/commons";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";

import configuration from "./config/configuration.js";
import { AgentAdminModule } from "./modules/agent-admin/agent-admin.module.js";
import { AgentsModule } from "./modules/agents/agents.module.js";
import { ChatModule } from "./modules/chat/chat.module.js";
import { ColdCallerModule } from "./modules/cold-caller/cold-caller.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ToolsModule } from "./modules/tools/tools.module.js";
import { VideoModule } from "./modules/video/video.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

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
    ChatModule,
    ToolsModule,
    AgentAdminModule,
    VideoModule,
    ColdCallerModule,
  ],
})
export class AppModule {}
