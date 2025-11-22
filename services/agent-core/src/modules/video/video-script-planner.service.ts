import { PrismaService } from "@easymo/db";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  BrandGuide,
  Product,
  VideoJob,
  VideoScript,
  VideoTemplate,
} from "@prisma/client";

import { VideoJobQueueService } from "./video-job-queue.service.js";

interface ShotPlanReferenceProduct {
  id: string;
  name: string;
  description: string | null;
  keywords: string[];
  hero_asset_url: string | null;
}

interface ShotPlanReferenceGuide {
  id: string;
  title: string;
  summary: string | null;
  tone: unknown;
  palette: unknown;
}

interface ShotPlanShot {
  order: number;
  duration_seconds: number;
  prompt: string;
  reference_product_id: string | null;
  overlays?: Record<string, unknown>;
  voiceover: string;
}

interface ShotPlanPayload {
  version: string;
  locale: string;
  template: string;
  synopsis: string | null;
  voice: string;
  references: {
    products: ShotPlanReferenceProduct[];
    brand_guides: ShotPlanReferenceGuide[];
  };
  shots: ShotPlanShot[];
}

type ScriptWithTemplate = VideoScript & {
  template: VideoTemplate & { brandGuide: BrandGuide | null };
};

type JobWithScript = VideoJob & { script: ScriptWithTemplate };

function unique<T>(items: (T | null | undefined)[]): T[] {
  const set = new Set<T>();
  for (const item of items) {
    if (!item) continue;
    set.add(item);
  }
  return Array.from(set.values());
}

function coerceArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((value) => String(value)).filter((value) => value.length > 0);
  }
  if (typeof input === "string" && input.trim()) {
    return input.split(",").map((value) => value.trim()).filter(Boolean);
  }
  return [];
}

@Injectable()
export class VideoScriptPlannerService {
  private readonly logger = new Logger(VideoScriptPlannerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: VideoJobQueueService,
  ) {}

  async plan(jobId: string): Promise<VideoJob> {
    const job = await this.prisma.videoJob.findUnique({
      where: { id: jobId },
      include: {
        script: {
          include: {
            template: { include: { brandGuide: true } },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Video job ${jobId} not found`);
    }

    const script = job.script as ScriptWithTemplate;

    const jobWithScript = job as JobWithScript;
    const products = await this.fetchRelevantProducts(script);
    const guides = await this.fetchRelevantBrandGuides(script);

    const shotplan = this.buildShotPlan(jobWithScript, script, products, guides);

    const provenance = {
      ...(job.provenance as Record<string, unknown> | null ?? {}),
      planner: {
        planned_at: new Date().toISOString(),
        product_ids: products.map((product) => product.id),
        brand_guide_ids: guides.map((guide) => guide.id),
      },
    } satisfies Record<string, unknown>;

    const updatedJob = await this.prisma.$transaction(async (tx) => {
      await tx.videoScript.update({
        where: { id: script.id },
        data: {
          plan: shotplan,
          status: "planned",
        },
      });

      return await tx.videoJob.update({
        where: { id: job.id },
        data: {
          status: "planned",
          queueStatus: "pending",
          shotplanJson: shotplan,
          provenance,
        },
      });
    });

    await this.queue.enqueue(jobWithScript.id, {
      type: "sora.generate",
      job_id: jobWithScript.id,
      script_id: script.id,
      template: script.template.slug,
      shotplan,
    });

    this.logger.log("video.plan.completed", { jobId: jobWithScript.id });

    return updatedJob;
  }

  private async fetchRelevantProducts(
    script: ScriptWithTemplate,
  ): Promise<(Product & { brandGuide: BrandGuide | null })[]> {
    const metadata = (script.metadata as Record<string, unknown> | null) ?? {};
    const explicitIds = coerceArray(
      (metadata["product_ids"] ?? metadata["productIds"]) as unknown,
    );
    const keywords = coerceArray(
      (metadata["keywords"] ?? metadata["product_keywords"]) as unknown,
    );

    const where: NonNullable<
      Parameters<typeof this.prisma.product.findMany>[0]
    >["where"] = {};

    if (explicitIds.length) {
      where.id = { in: explicitIds };
    } else if (script.template.brandGuideId) {
      where.brandGuideId = script.template.brandGuideId;
    } else if (keywords.length) {
      where.OR = keywords.map((keyword) => ({ keywords: { has: keyword } }));
    }

    return await this.prisma.product.findMany({
      where,
      take: 5,
      include: { brandGuide: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  private async fetchRelevantBrandGuides(
    script: ScriptWithTemplate,
  ): Promise<BrandGuide[]> {
    const metadata = (script.metadata as Record<string, unknown> | null) ?? {};
    const explicit = coerceArray(
      (metadata["brand_guide_ids"] ?? metadata["brandGuideIds"]) as unknown,
    );
    const maybeTemplateGuide = script.template.brandGuide?.id ?? null;
    const ids = unique([maybeTemplateGuide, ...explicit]);
    if (!ids.length) {
      return [];
    }
    return await this.prisma.brandGuide.findMany({
      where: { id: { in: ids } },
    });
  }

  private buildShotPlan(
    job: JobWithScript,
    script: ScriptWithTemplate,
    products: (Product & { brandGuide: BrandGuide | null })[],
    guides: BrandGuide[],
  ): ShotPlanPayload {
    const primaryGuide = guides[0] ?? script.template.brandGuide ?? null;
    const synopsis = script.synopsis ?? primaryGuide?.summary ?? null;
    const voice = this.resolveVoice(script, primaryGuide);
    const references = {
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        keywords: product.keywords ?? [],
        hero_asset_url: this.extractHeroAsset(product.media as Record<string, unknown> | null),
      })),
      brand_guides: guides.map((guide) => ({
        id: guide.id,
        title: guide.title,
        summary: guide.summary ?? null,
        tone: guide.tone,
        palette: guide.palette,
      })),
    } satisfies ShotPlanPayload["references"];

    const shots: ShotPlanShot[] = (products.length ? products : [null]).map((product, index) => {
      const order = index + 1;
      return {
        order,
        duration_seconds: product ? 6 : 5,
        prompt: this.composeVisualPrompt(product, primaryGuide),
        reference_product_id: product?.id ?? null,
        overlays: primaryGuide?.palette ? { palette: primaryGuide.palette } : undefined,
        voiceover: this.composeVoiceoverLine(product, synopsis, voice),
      } satisfies ShotPlanShot;
    });

    return {
      version: "2025-02-01",
      locale: script.locale,
      template: script.template.slug,
      synopsis,
      voice,
      references,
      shots,
    } satisfies ShotPlanPayload;
  }

  private resolveVoice(
    script: VideoScript,
    guide: BrandGuide | null,
  ): string {
    const metadata = (script.metadata as Record<string, unknown> | null) ?? {};
    const voice = metadata["voice"];
    if (typeof voice === "string" && voice.trim()) {
      return voice.trim();
    }
    if (guide) {
      const tone = guide.tone as Record<string, unknown> | null;
      const suggested = (tone?.["voice"] ?? tone?.["style"]) as unknown;
      if (typeof suggested === "string" && suggested.trim()) {
        return suggested.trim();
      }
    }
    return "warm_informative";
  }

  private composeVisualPrompt(
    product: (Product & { brandGuide: BrandGuide | null }) | null,
    guide: BrandGuide | null,
  ): string {
    const base = guide?.title ? `${guide.title} brand` : "brand";
    if (!product) {
      return `Establishing lifestyle imagery that conveys the ${base} mood with dynamic motion and soft natural lighting.`;
    }
    return `Hero shot of ${product.name} highlighting its key benefit with ${base} colors and confident, modern pacing.`;
  }

  private composeVoiceoverLine(
    product: (Product & { brandGuide: BrandGuide | null }) | null,
    synopsis: string | null,
    voice: string,
  ): string {
    const baseSynopsis = synopsis ?? "Discover what sets us apart.";
    if (!product) {
      return `${baseSynopsis} Narrate in a ${voice.replace(/_/g, " ")} delivery.`;
    }
    const keyPhrase = product.description ?? baseSynopsis;
    return `${keyPhrase} Featuring ${product.name} with a ${voice.replace(/_/g, " ")} tone.`;
  }

  private extractHeroAsset(media: Record<string, unknown> | null): string | null {
    if (!media) return null;
    const hero = media["hero"];
    if (typeof hero === "string") return hero;
    const heroAsset = media["heroAsset"];
    if (typeof heroAsset === "string") return heroAsset;
    const gallery = media["gallery"] as unknown;
    if (Array.isArray(gallery) && gallery.length) {
      const first = gallery[0];
      if (typeof first === "string") return first;
    }
    return null;
  }
}
