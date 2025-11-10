import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@easymo/db";
import { emitMetric } from "../../common/metrics.js";
import { createHash, randomUUID } from "node:crypto";

export type SoraGenerationRequest = {
  campaignId: string;
  figureId: string;
  prompt: string;
  country?: string;
  region?: string;
  locale?: string;
  estimatedCostUsd: number;
  expectedOutputMb?: number;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export type SoraGenerationResult = {
  jobId: string;
  prompt: string;
  promptHash: string;
  appliedPolicies: {
    campaignId: string;
    brandGuideId?: string | null;
    figureId: string;
    forbiddenTerms: string[];
  };
};

@Injectable()
export class SoraOrchestratorService {
  private readonly logger = new Logger(SoraOrchestratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  private escapeRegExp(term: string) {
    return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private startOfUtcDay(date: Date) {
    const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    return copy;
  }

  private sanitizeCountry(value?: string) {
    return value?.toLowerCase();
  }

  private sanitizeRegion(value?: string) {
    return value?.toLowerCase();
  }

  async queueGeneration(request: SoraGenerationRequest): Promise<SoraGenerationResult> {
    const startedAt = process.hrtime.bigint();
    const dayKey = this.startOfUtcDay(new Date());

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: request.campaignId },
      include: { brandGuide: true },
    });
    if (!campaign) {
      this.logger.warn({
        msg: "sora.job.blocked",
        reason: "campaign_not_found",
        campaignId: request.campaignId,
        figureId: request.figureId,
        userId: request.userId ?? null,
      });
      emitMetric("sora_generation_failure", 1, { reason: "campaign_not_found" });
      throw new NotFoundException(`Campaign ${request.campaignId} not found`);
    }

    if (campaign.generationKillSwitch) {
      this.logger.warn({
        msg: "sora.job.blocked",
        reason: "kill_switch",
        campaignId: request.campaignId,
        figureId: request.figureId,
        userId: request.userId ?? null,
      });
      emitMetric("sora_generation_failure", 1, { reason: "kill_switch", campaignId: campaign.id });
      throw new ForbiddenException("Campaign has been disabled via kill switch");
    }

    const figure = await this.prisma.figure.findUnique({
      where: { id: request.figureId },
      include: { brandGuide: true },
    });
    if (!figure || figure.tenantId !== campaign.tenantId) {
      this.logger.warn({
        msg: "sora.job.blocked",
        reason: "figure_mismatch",
        campaignId: request.campaignId,
        figureId: request.figureId,
        userId: request.userId ?? null,
      });
      emitMetric("sora_generation_failure", 1, { reason: "figure_mismatch", campaignId: campaign.id });
      throw new NotFoundException("Figure is not registered for this campaign");
    }

    const now = new Date();
    if (figure.rightsStart && now < figure.rightsStart) {
      this.logger.warn({
        msg: "sora.job.blocked",
        reason: "rights_window_not_started",
        campaignId: request.campaignId,
        figureId: request.figureId,
        rightsStart: figure.rightsStart.toISOString(),
        userId: request.userId ?? null,
      });
      emitMetric("sora_generation_failure", 1, { reason: "rights_not_started", campaignId: campaign.id });
      throw new ForbiddenException("Figure rights window has not started");
    }
    if (figure.rightsEnd && now > figure.rightsEnd) {
      this.logger.warn({
        msg: "sora.job.blocked",
        reason: "rights_window_expired",
        campaignId: request.campaignId,
        figureId: request.figureId,
        rightsEnd: figure.rightsEnd.toISOString(),
        userId: request.userId ?? null,
      });
      emitMetric("sora_generation_failure", 1, { reason: "rights_expired", campaignId: campaign.id });
      throw new ForbiddenException("Figure rights window has expired");
    }

    const country = this.sanitizeCountry(request.country);
    if (figure.allowedCountries.length > 0) {
      if (!country || !figure.allowedCountries.some((c) => c.toLowerCase() === country)) {
        this.logger.warn({
          msg: "sora.job.blocked",
          reason: "country_not_allowed",
          campaignId: request.campaignId,
          figureId: request.figureId,
          requestedCountry: request.country ?? null,
          allowedCountries: figure.allowedCountries,
          userId: request.userId ?? null,
        });
        emitMetric("sora_generation_failure", 1, { reason: "country_not_allowed", campaignId: campaign.id });
        throw new ForbiddenException("Requested country is outside approved territory");
      }
    }

    const region = this.sanitizeRegion(request.region);
    if (figure.allowedRegions.length > 0) {
      if (!region || !figure.allowedRegions.some((r) => r.toLowerCase() === region)) {
        this.logger.warn({
          msg: "sora.job.blocked",
          reason: "region_not_allowed",
          campaignId: request.campaignId,
          figureId: request.figureId,
          requestedRegion: request.region ?? null,
          allowedRegions: figure.allowedRegions,
          userId: request.userId ?? null,
        });
        emitMetric("sora_generation_failure", 1, { reason: "region_not_allowed", campaignId: campaign.id });
        throw new ForbiddenException("Requested region is outside approved territory");
      }
    }

    const brandGuide = figure.brandGuide ?? campaign.brandGuide ?? null;
    const forbiddenTerms = brandGuide?.forbiddenTerms ?? [];
    const violatingTerms = forbiddenTerms.filter((term) => {
      if (!term) return false;
      const pattern = new RegExp(`\\b${this.escapeRegExp(term)}\\b`, "i");
      return pattern.test(request.prompt);
    });
    if (violatingTerms.length > 0) {
      this.logger.warn({
        msg: "sora.job.blocked",
        reason: "forbidden_terms",
        campaignId: request.campaignId,
        figureId: request.figureId,
        userId: request.userId ?? null,
        violatingTerms,
      });
      emitMetric("sora_generation_failure", 1, { reason: "forbidden_terms", campaignId: campaign.id });
      throw new ForbiddenException(`Prompt contains forbidden claims: ${violatingTerms.join(", ")}`);
    }

    if (request.estimatedCostUsd < 0) {
      throw new BadRequestException("estimatedCostUsd must be positive");
    }

    const estimatedCost = new Prisma.Decimal(request.estimatedCostUsd);
    const cap = campaign.dailyCostCapUsd ? new Prisma.Decimal(campaign.dailyCostCapUsd) : null;

    if (cap) {
      const existingLimit = await this.prisma.generationLimit.findUnique({
        where: {
          campaignId_date: {
            campaignId: campaign.id,
            date: dayKey,
          },
        },
      });
      const currentSpend = existingLimit ? new Prisma.Decimal(existingLimit.spendUsd) : new Prisma.Decimal(0);
      if (currentSpend.add(estimatedCost).gt(cap)) {
        this.logger.warn({
          msg: "sora.job.blocked",
          reason: "daily_cap_exceeded",
          campaignId: request.campaignId,
          figureId: request.figureId,
          userId: request.userId ?? null,
          currentSpend: currentSpend.toNumber(),
          requestedCost: estimatedCost.toNumber(),
          cap: cap.toNumber(),
        });
        emitMetric("sora_generation_failure", 1, { reason: "daily_cap", campaignId: campaign.id });
        throw new ForbiddenException("Campaign daily cost cap exceeded");
      }
    }

    const policySegments: string[] = [];
    if (brandGuide?.voiceTone) {
      policySegments.push(`Voice & tone: ${brandGuide.voiceTone}`);
    }
    if (brandGuide?.brandPillars && brandGuide.brandPillars.length > 0) {
      policySegments.push(`Brand pillars: ${brandGuide.brandPillars.join(", ")}`);
    }
    if (brandGuide?.safetyGuidelines) {
      policySegments.push(`Safety guidance: ${brandGuide.safetyGuidelines}`);
    }
    if (brandGuide?.legalDisclaimer) {
      policySegments.push(`Legal disclaimer: ${brandGuide.legalDisclaimer}`);
    }
    if (figure.policyNotes) {
      policySegments.push(`Figure-specific direction: ${figure.policyNotes}`);
    }
    if (figure.legalNotes) {
      policySegments.push(`Figure legal notes: ${figure.legalNotes}`);
    }
    if (forbiddenTerms.length > 0) {
      policySegments.push(`Never include the following terms or claims: ${forbiddenTerms.join(", ")}`);
    }

    const policyBlock = policySegments.length > 0
      ? `Follow these guardrails before generating visuals:\n${policySegments.map((segment) => `- ${segment}`).join("\n")}`
      : "";

    const promptSections = [] as string[];
    if (policyBlock) {
      promptSections.push(policyBlock);
    }
    promptSections.push(`Creative brief:\n${request.prompt.trim()}`);
    if (request.locale) {
      promptSections.push(`Locale: ${request.locale}`);
    }
    if (country) {
      promptSections.push(`Target country: ${country}`);
    }
    if (region) {
      promptSections.push(`Target region: ${region}`);
    }
    if (request.metadata && Object.keys(request.metadata).length > 0) {
      promptSections.push(`Metadata: ${JSON.stringify(request.metadata)}`);
    }

    const finalPrompt = promptSections.join("\n\n");
    const promptHash = createHash("sha256").update(finalPrompt).digest("hex");

    await this.prisma.generationLimit.upsert({
      where: {
        campaignId_date: {
          campaignId: campaign.id,
          date: dayKey,
        },
      },
      update: {
        spendUsd: { increment: estimatedCost.toNumber() },
        jobsCount: { increment: 1 },
        updatedAt: new Date(),
      },
      create: {
        campaignId: campaign.id,
        date: dayKey,
        spendUsd: estimatedCost,
        jobsCount: 1,
      },
    });

    const jobId = randomUUID();
    const runtimeMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    this.logger.log({
      msg: "sora.job.queued",
      jobId,
      campaignId: request.campaignId,
      figureId: request.figureId,
      promptHash,
      runtimeMs,
      estimatedCostUsd: estimatedCost.toNumber(),
      expectedOutputMb: request.expectedOutputMb ?? null,
    });

    emitMetric("sora_generation_success", 1, {
      campaignId: request.campaignId,
      figureId: request.figureId,
    });
    if (typeof request.expectedOutputMb === "number") {
      emitMetric("sora_generation_mb", request.expectedOutputMb, {
        campaignId: request.campaignId,
        figureId: request.figureId,
      });
    }
    emitMetric("sora_generation_runtime_ms", runtimeMs, {
      campaignId: request.campaignId,
    });

    return {
      jobId,
      prompt: finalPrompt,
      promptHash,
      appliedPolicies: {
        campaignId: campaign.id,
        brandGuideId: brandGuide?.id ?? null,
        figureId: figure.id,
        forbiddenTerms,
      },
    };
  }
}
