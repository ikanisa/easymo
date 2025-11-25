/**
 * Error Handling Tests
 */

import { z,ZodError } from "zod";

import {
  AppError,
  ErrorCodes,
  errorHandler,
  notFoundHandler,
} from "../src/errors";

// Mock Express request/response - simplified to avoid Express type conflicts
interface MockRequest {
  method: string;
  path: string;
  id?: string;
}

interface MockResponse {
  _status: number;
  _json: unknown;
  status(code: number): MockResponse;
  json(data: unknown): MockResponse;
}

const createMockRequest = (overrides: Partial<MockRequest> = {}): MockRequest => ({
  method: "GET",
  path: "/test",
  ...overrides,
});

const createMockResponse = (): MockResponse => {
  const res: MockResponse = {
    _status: 200,
    _json: null,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(data: unknown) {
      this._json = data;
      return this;
    },
  };
  return res;
};

const mockNext = () => {};

describe("Error Handling", () => {
  describe("errorHandler", () => {
    it("should handle ZodError with formatted field errors", () => {
      const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
      });

      let zodError: ZodError | null = null;
      try {
        schema.parse({ name: "", email: "invalid" });
      } catch (e) {
        zodError = e as ZodError;
      }

      const req = createMockRequest({ id: "test-request-id" });
      const res = createMockResponse();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorHandler(zodError!, req as any, res as any, mockNext);

      expect(res._status).toBe(400);
      expect((res._json as Record<string, unknown>).code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect((res._json as Record<string, unknown>).message).toBe("Validation failed");
      expect((res._json as Record<string, unknown>).details).toBeDefined();
    });

    it("should handle AppError with custom status code", () => {
      const error = new AppError(
        ErrorCodes.NOT_FOUND,
        "Profile not found",
        404,
        { userId: "123" }
      );

      const req = createMockRequest({ id: "test-request-id" });
      const res = createMockResponse();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorHandler(error, req as any, res as any, mockNext);

      expect(res._status).toBe(404);
      expect((res._json as Record<string, unknown>).code).toBe(ErrorCodes.NOT_FOUND);
      expect((res._json as Record<string, unknown>).message).toBe("Profile not found");
    });

    it("should handle unexpected errors with generic message", () => {
      const error = new Error("Something unexpected happened");

      const req = createMockRequest({ id: "test-request-id" });
      const res = createMockResponse();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorHandler(error, req as any, res as any, mockNext);

      expect(res._status).toBe(500);
      expect((res._json as Record<string, unknown>).code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect((res._json as Record<string, unknown>).message).toBe("An unexpected error occurred");
    });

    it("should include request ID in error response", () => {
      const error = new AppError(ErrorCodes.FORBIDDEN, "Access denied", 403);
      const requestId = "unique-request-id";

      const req = createMockRequest({ id: requestId });
      const res = createMockResponse();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      errorHandler(error, req as any, res as any, mockNext);

      expect((res._json as Record<string, unknown>).requestId).toBe(requestId);
    });
  });

  describe("notFoundHandler", () => {
    it("should return 404 with route information", () => {
      const req = createMockRequest({
        method: "POST",
        path: "/api/v1/unknown",
        id: "test-id",
      });
      const res = createMockResponse();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notFoundHandler(req as any, res as any);

      expect(res._status).toBe(404);
      expect((res._json as Record<string, unknown>).code).toBe(ErrorCodes.NOT_FOUND);
      expect((res._json as Record<string, unknown>).message).toContain("POST");
      expect((res._json as Record<string, unknown>).message).toContain("/api/v1/unknown");
    });
  });

  describe("AppError", () => {
    it("should create error with all properties", () => {
      const error = new AppError(
        ErrorCodes.RATE_LIMITED,
        "Too many requests",
        429,
        { retryAfter: 60 }
      );

      expect(error.code).toBe(ErrorCodes.RATE_LIMITED);
      expect(error.message).toBe("Too many requests");
      expect(error.statusCode).toBe(429);
      expect(error.details?.retryAfter).toBe(60);
      expect(error.name).toBe("AppError");
    });

    it("should default to 400 status code", () => {
      const error = new AppError(ErrorCodes.INVALID_INPUT, "Invalid input");

      expect(error.statusCode).toBe(400);
    });
  });
});
