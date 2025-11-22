import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module.js";
import { VideoJobQueueService } from "./video-job-queue.service.js";
import { VideoScriptPlannerService } from "./video-script-planner.service.js";

@Module({
  imports: [PrismaModule],
  providers: [VideoScriptPlannerService, VideoJobQueueService],
  exports: [VideoScriptPlannerService],
})
export class VideoModule {}
