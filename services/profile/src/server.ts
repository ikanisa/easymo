import { setRequestId } from "@easymo/commons";
import { randomUUID } from "crypto";
import express from "express";
import pinoHttp from "pino-http";

import { settings } from "./config";
import { AppError, ErrorCodes, errorHandler, notFoundHandler } from "./errors";
import { logger } from "./logger";
import { rateLimitMiddleware, validateRequest } from "./middleware";
import {
  CreateProfileSchema,
  GetProfileParamsSchema,
  SavedLocationSchema,
  SearchProfilesQuerySchema,
  UpdateProfileSchema,
} from "./schemas";
import { ProfileService } from "./service";
import { getSupabase } from "./supabase";

async function bootstrap() {
  const app = express();

  // Trust proxy for accurate IP addresses behind load balancer
  app.set("trust proxy", true);

  // Request parsing
  app.use(express.json({ limit: "10kb" }));

  // Request ID and context middleware
  app.use((req, _res, next) => {
    const headerId =
      typeof req.headers["x-request-id"] === "string"
        ? req.headers["x-request-id"]
        : undefined;
    const requestId = headerId?.trim() || randomUUID();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).id = requestId;
    req.headers["x-request-id"] = requestId;
    setRequestId(requestId);
    next();
  });

  // Structured logging middleware
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use(pinoHttp({ logger: logger as any }));

  // Rate limiting
  app.use(rateLimitMiddleware);

  // Initialize service
  let profileService: ProfileService;

  try {
    const supabase = getSupabase();
    profileService = new ProfileService(supabase);
  } catch (_error) {
    logger.warn({ msg: "supabase.init.skipped", reason: "No credentials configured" });
    // Create a mock service for health checks when Supabase is not configured
    profileService = null as unknown as ProfileService;
  }

  // Health check endpoints
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "profile-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/health/ready", async (_req, res) => {
    try {
      if (profileService) {
        // Try a simple database query to verify connectivity
        const supabase = getSupabase();
        const { error } = await supabase.from("profiles").select("user_id").limit(1);
        if (error) {
          res.status(503).json({
            status: "not_ready",
            reason: "database_unavailable",
          });
          return;
        }
      }
      res.json({ status: "ready" });
    } catch (_error) {
      res.status(503).json({
        status: "not_ready",
        reason: "database_unavailable",
      });
    }
  });

  // Profile CRUD endpoints
  app.post(
    "/api/v1/profiles",
    validateRequest(CreateProfileSchema),
    async (req, res, next) => {
      try {
        if (!profileService) {
          throw new AppError(ErrorCodes.INTERNAL_ERROR, "Service not initialized", 503);
        }
        const profile = await profileService.createProfile(req.body);
        res.status(201).json({ profile });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/v1/profiles/:id",
    validateRequest(GetProfileParamsSchema, "params"),
    async (req, res, next) => {
      try {
        if (!profileService) {
          throw new AppError(ErrorCodes.INTERNAL_ERROR, "Service not initialized", 503);
        }
        const profile = await profileService.getProfileById(req.params.id);
        res.json({ profile });
      } catch (error) {
        next(error);
      }
    }
  );

  app.put(
    "/api/v1/profiles/:id",
    validateRequest(GetProfileParamsSchema, "params"),
    validateRequest(UpdateProfileSchema),
    async (req, res, next) => {
      try {
        if (!profileService) {
          throw new AppError(ErrorCodes.INTERNAL_ERROR, "Service not initialized", 503);
        }
        const profile = await profileService.updateProfile(req.params.id, req.body);
        res.json({ profile });
      } catch (error) {
        next(error);
      }
    }
  );

  app.delete(
    "/api/v1/profiles/:id",
    validateRequest(GetProfileParamsSchema, "params"),
    async (req, res, next) => {
      try {
        if (!profileService) {
          throw new AppError(ErrorCodes.INTERNAL_ERROR, "Service not initialized", 503);
        }
        await profileService.deleteProfile(req.params.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  app.get(
    "/api/v1/profiles/search",
    validateRequest(SearchProfilesQuerySchema, "query"),
    async (req, res, next) => {
      try {
        if (!profileService) {
          throw new AppError(ErrorCodes.INTERNAL_ERROR, "Service not initialized", 503);
        }
        const result = await profileService.searchProfiles(req.query as Record<string, unknown> as Parameters<ProfileService["searchProfiles"]>[0]);
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Saved locations endpoints
  app.get("/api/v1/profiles/:id/locations", async (req, res, next) => {
    try {
      if (!profileService) {
        throw new AppError(ErrorCodes.INTERNAL_ERROR, "Service not initialized", 503);
      }
      const locations = await profileService.getSavedLocations(req.params.id);
      res.json({ locations });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/v1/profiles/:id/locations",
    validateRequest(SavedLocationSchema),
    async (req, res, next) => {
      try {
        if (!profileService) {
          throw new AppError(ErrorCodes.INTERNAL_ERROR, "Service not initialized", 503);
        }
        const location = await profileService.createSavedLocation(
          req.params.id,
          req.body
        );
        res.status(201).json({ location });
      } catch (error) {
        next(error);
      }
    }
  );

  app.delete(
    "/api/v1/profiles/:id/locations/:locationId",
    async (req, res, next) => {
      try {
        if (!profileService) {
          throw new AppError(ErrorCodes.INTERNAL_ERROR, "Service not initialized", 503);
        }
        await profileService.deleteSavedLocation(req.params.id, req.params.locationId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Start server
  const server = app.listen(settings.port, () => {
    logger.info({
      msg: "profile-service.listen",
      port: settings.port,
      env: settings.env,
    });
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info({ msg: "profile-service.shutdown.start" });
    server.close(() => {
      logger.info({ msg: "profile-service.shutdown.complete" });
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((error) => {
  logger.error({ msg: "profile-service.bootstrap_failed", error: error.message });
  process.exit(1);
});
