import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@easymo/db";
import { AgentTask, Prisma, TaskStatus, TaskType } from "@prisma/client";
import { AiService } from "../ai/ai.service.js";
import { emitMetric } from "../../common/metrics.js";

type ScheduleTaskInput = {
  tenantId: string;
  contactRef: string;
  type: TaskType;
  payload: Record<string, unknown>;
  scheduledAt?: Date;
};

@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);
  private readonly pollIntervalMs: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly config: ConfigService,
  ) {
    this.pollIntervalMs = Number(this.config.get("tasks.pollIntervalMs") ?? process.env.TASK_POLL_INTERVAL_MS ?? 60000);
  }

  async scheduleTask(input: ScheduleTaskInput) {
    const task = await this.prisma.agentTask.create({
      data: {
        tenantId: input.tenantId,
        contactRef: input.contactRef,
        type: input.type,
        payload: input.payload as Prisma.JsonValue,
        scheduledAt: input.scheduledAt ?? new Date(),
      },
    });
    this.logger.debug({ msg: "tasks.schedule", id: task.id, type: task.type, contactRef: task.contactRef });
    emitMetric("tasks.scheduled", 1, { type: input.type, tenantId: input.tenantId });
    return task;
  }

  async runDueTasks(limit = 10) {
    const now = new Date();
    const dueTasks = await this.prisma.agentTask.findMany({
      where: {
        status: TaskStatus.PENDING,
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
    });
    emitMetric("tasks.due_fetched", dueTasks.length, { limit });

    const results: Array<{ id: string; type: TaskType; status: TaskStatus; result?: Prisma.JsonValue; error?: string }> = [];

    for (const task of dueTasks) {
      const locked = await this.prisma.agentTask.updateMany({
        where: { id: task.id, status: TaskStatus.PENDING },
        data: { status: TaskStatus.IN_PROGRESS },
      });
      if (locked.count === 0) continue; // picked by another worker

      try {
        const execution = await this.executeTask(task);
        const updated = await this.prisma.agentTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.COMPLETED,
            runAt: new Date(),
            result: execution as Prisma.JsonValue,
            error: null,
          },
        });
        emitMetric("tasks.executed", 1, { type: task.type, status: "completed" });
        results.push({ id: updated.id, type: updated.type, status: updated.status, result: updated.result });
      } catch (error) {
        const message = (error as Error).message ?? String(error);
        await this.prisma.agentTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.FAILED,
            runAt: new Date(),
            error: message.slice(0, 500),
          },
        });
        this.logger.error({ msg: "tasks.execute.failed", id: task.id, error: message });
        emitMetric("tasks.executed", 1, { type: task.type, status: "failed" });
        results.push({ id: task.id, type: task.type, status: TaskStatus.FAILED, error: message });
      }
    }

    return results;
  }

  private async executeTask(task: AgentTask) {
    const payload = (task.payload ?? {}) as Record<string, any>;
    switch (task.type) {
      case TaskType.BROKER_WHATSAPP: {
        this.assertFields(task.type, payload, ["tenantId", "buyerId", "msisdn"]);
        const followUpAt = this.resolveFollowUpAt(payload.followUpAt);
        const response = await this.ai.runBrokerOrchestrator({
          tenantId: payload.tenantId,
          buyerId: payload.buyerId,
          msisdn: payload.msisdn,
          region: payload.region,
          categories: payload.categories ?? [],
          intentPayload: payload.intentPayload ?? {},
          expiresAt: payload.expiresAt,
        });
        await this.upsertMemory({
          tenantId: task.tenantId,
          contactRef: task.contactRef,
          channel: "WHATSAPP",
          summary: {
            type: "BROKER_WHATSAPP",
            response,
            input: {
              categories: payload.categories,
              region: payload.region,
            },
          },
          followUpAt,
        });
        return response;
      }
      case TaskType.SALES_WHATSAPP: {
        this.assertFields(task.type, payload, ["msisdn", "message"]);
        const followUpAt = this.resolveFollowUpAt(payload.followUpAt);
        const conversation = await this.ai.startAgentWhatsappConversation({
          profile: "sales",
          msisdn: payload.msisdn,
          message: payload.message,
          metadata: payload.metadata,
          callId: payload.callId,
        });
        await this.upsertMemory({
          tenantId: task.tenantId,
          contactRef: task.contactRef,
          channel: "WHATSAPP",
          summary: {
            type: "SALES_WHATSAPP",
            conversation,
            input: { message: payload.message },
          },
          followUpAt,
        });
        return conversation;
      }
      case TaskType.MARKETING_WHATSAPP: {
        this.assertFields(task.type, payload, ["msisdn", "message"]);
        const followUpAt = this.resolveFollowUpAt(payload.followUpAt);
        const conversation = await this.ai.startAgentWhatsappConversation({
          profile: "marketing",
          msisdn: payload.msisdn,
          message: payload.message,
          metadata: payload.metadata,
          callId: payload.callId,
        });
        await this.upsertMemory({
          tenantId: task.tenantId,
          contactRef: task.contactRef,
          channel: "WHATSAPP",
          summary: {
            type: "MARKETING_WHATSAPP",
            conversation,
            input: { message: payload.message },
          },
          followUpAt,
        });
        return conversation;
      }
      case TaskType.SUPPORT_WHATSAPP: {
        this.assertFields(task.type, payload, ["msisdn", "message"]);
        const response = await this.ai.runSupport({
          msisdn: payload.msisdn,
          message: payload.message,
          messageId: payload.messageId,
          timestamp: payload.timestamp,
        });
        await this.upsertMemory({
          tenantId: task.tenantId,
          contactRef: task.contactRef,
          channel: "WHATSAPP",
          summary: { type: "SUPPORT_WHATSAPP", response },
          followUpAt: null,
        });
        return response;
      }
      case TaskType.VOICE_COLD_CALL: {
        this.assertFields(task.type, payload, ["msisdn"]);
        const followUpAt = this.resolveFollowUpAt(payload.followUpAt);
        const response = await this.ai.runVoiceCall({
          msisdn: payload.msisdn,
          tenantId: payload.tenantId ?? task.tenantId,
          contactName: payload.contactName,
          region: payload.region,
          profile: "cold_caller",
        });
        await this.upsertMemory({
          tenantId: task.tenantId,
          contactRef: task.contactRef,
          channel: "VOICE",
          summary: { type: "VOICE_COLD_CALL", response },
          followUpAt,
        });
        return response;
      }
      case TaskType.VOICE_SALES_CALL: {
        this.assertFields(task.type, payload, ["msisdn"]);
        const followUpAt = this.resolveFollowUpAt(payload.followUpAt);
        const response = await this.ai.runVoiceCall({
          msisdn: payload.msisdn,
          tenantId: payload.tenantId ?? task.tenantId,
          contactName: payload.contactName,
          region: payload.region,
          profile: "sales",
        });
        await this.upsertMemory({
          tenantId: task.tenantId,
          contactRef: task.contactRef,
          channel: "VOICE",
          summary: { type: "VOICE_SALES_CALL", response },
          followUpAt,
        });
        return response;
      }
      case TaskType.VOICE_MARKETING_CALL: {
        this.assertFields(task.type, payload, ["msisdn"]);
        const followUpAt = this.resolveFollowUpAt(payload.followUpAt);
        const response = await this.ai.runVoiceCall({
          msisdn: payload.msisdn,
          tenantId: payload.tenantId ?? task.tenantId,
          contactName: payload.contactName,
          region: payload.region,
          profile: "marketing",
        });
        await this.upsertMemory({
          tenantId: task.tenantId,
          contactRef: task.contactRef,
          channel: "VOICE",
          summary: { type: "VOICE_MARKETING_CALL", response },
          followUpAt,
        });
        return response;
      }
      case TaskType.VOICE_BROKER_CALL: {
        this.assertFields(task.type, payload, ["msisdn"]);
        const followUpAt = this.resolveFollowUpAt(payload.followUpAt);
        const response = await this.ai.runVoiceCall({
          msisdn: payload.msisdn,
          tenantId: payload.tenantId ?? task.tenantId,
          contactName: payload.contactName,
          region: payload.region,
          profile: "broker",
        });
        await this.upsertMemory({
          tenantId: task.tenantId,
          contactRef: task.contactRef,
          channel: "VOICE",
          summary: { type: "VOICE_BROKER_CALL", response },
          followUpAt,
        });
        return response;
      }
      default:
        throw new Error(`Unsupported task type: ${task.type}`);
    }
  }

  private async upsertMemory(input: { tenantId: string; contactRef: string; channel: "WHATSAPP" | "VOICE" | "EMAIL"; summary: Record<string, unknown>; followUpAt: Date | null }) {
    await this.prisma.interactionMemory.upsert({
      where: {
        tenantId_contactRef_channel: {
          tenantId: input.tenantId,
          contactRef: input.contactRef,
          channel: input.channel,
        },
      },
      create: {
        tenantId: input.tenantId,
        contactRef: input.contactRef,
        channel: input.channel,
        summary: input.summary as Prisma.JsonValue,
        followUpAt: input.followUpAt,
      },
      update: {
        summary: input.summary as Prisma.JsonValue,
        lastInteractionAt: new Date(),
        followUpAt: input.followUpAt,
      },
    });
  }

  private resolveFollowUpAt(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    const parsed = new Date(value as string | number);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private assertFields(type: TaskType, payload: Record<string, any>, required: string[]) {
    const missing = required.filter((key) => payload[key] === undefined || payload[key] === null || payload[key] === "");
    if (missing.length > 0) {
      throw new Error(`Task ${type} missing required fields: ${missing.join(", ")}`);
    }
  }

  onModuleInit() {
    if (this.pollIntervalMs > 0) {
      this.timer = setInterval(() => {
        this.runDueTasks().catch((error) => {
          this.logger.error({ msg: "tasks.poller.failed", error });
        });
      }, this.pollIntervalMs);
      this.logger.log(`Task poller running every ${this.pollIntervalMs}ms`);
    }
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
