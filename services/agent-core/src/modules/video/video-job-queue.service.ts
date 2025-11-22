import { PrismaService } from "@easymo/db";
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class VideoJobQueueService {
  private readonly logger = new Logger(VideoJobQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(jobId: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.videoJob.update({
          where: { id: jobId },
          data: {
            queueStatus: "ready",
            queuedAt: new Date(),
            queueAttempts: { increment: 1 },
          },
        });

        await tx.soraJobQueue.create({
          data: {
            jobId,
            status: "pending",
            payload,
            visibleAt: new Date(),
          },
        });
      });

      this.logger.debug("video.job_queue.enqueued", { jobId });
    } catch (error) {
      this.logger.error("video.job_queue.enqueue_failed", error as Error, { jobId });
      throw error;
    }
  }
}
