import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as favoritesGet } from "@app-apis/domains/favorites/handler";
import { POST as matchPost } from "@app-apis/domains/match/handler";
import { GET as adminGet } from "@app-apis/domains/admin/handler";
import { setEnvironmentForTests } from "@app-apis/config/environment";
import { FeatureFlagService, setFeatureFlagServiceForTests } from "@app-apis/lib/featureFlags";
import {
  resetSupabaseClient,
  setSupabaseRepositoriesForTests,
} from "@app-apis/lib/supabase";
import { clearCache } from "@app-apis/lib/cache";
import { setLogSink } from "@app-apis/lib/logger";
import { createRepositoryStub } from "@app-apis/tests/utils/repositoriesStub";

const ALL_FEATURE_FLAGS = {
  favorites: true,
  driver: true,
  match: true,
  deeplink: true,
  broker: true,
  admin: true,
} as const;

beforeEach(() => {
  setEnvironmentForTests({
    supabase: {
      url: "http://localhost:54321",
      key: "service-role-key",
      schema: "public",
    },
    featureFlags: { ...ALL_FEATURE_FLAGS },
    cache: {
      ttlMs: 5000,
      maxSize: 100,
    },
  });
  setFeatureFlagServiceForTests(new FeatureFlagService({ ...ALL_FEATURE_FLAGS }));
  const { repositories } = createRepositoryStub();
  setSupabaseRepositoriesForTests(repositories);
});

afterEach(() => {
  clearCache();
  setLogSink(null);
  setSupabaseRepositoriesForTests(null);
  resetSupabaseClient();
  setFeatureFlagServiceForTests(null);
  setEnvironmentForTests(null);
});

describe("app-apis integration", () => {
  it("returns validation errors for malformed match payloads", async () => {
    const request = new NextRequest("http://localhost/api/match", {
      method: "POST",
      body: JSON.stringify({ riderId: "not-a-uuid" }),
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-validation",
      },
    });

    const response = await matchPost(request);
    expect(response.status).toBe(400);
    const body = (await response.json()) as any;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.requestId).toBe("req-validation");
  });

  it("applies pagination defaults for favorites when parameters are omitted", async () => {
    const userId = "00000000-0000-0000-0000-000000000010";
    let observedQuery: { page: number; pageSize: number } | null = null;
    const { repositories } = createRepositoryStub({
      favoritesList: async (context, query) => {
        observedQuery = { page: query.page, pageSize: query.pageSize };
        return {
          rows: [
            {
              id: "00000000-0000-0000-0000-000000000099",
              user_id: userId,
              driver_id: "00000000-0000-0000-0000-000000000020",
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
        };
      },
    });
    setSupabaseRepositoriesForTests(repositories);

    const request = new NextRequest(`http://localhost/api/favorites?userId=${userId}`);
    const response = await favoritesGet(request);
    const body = (await response.json()) as any;
    if (response.status !== 200) {
      console.error(body);
    }
    expect(response.status).toBe(200);
    expect(observedQuery).toEqual({ page: 1, pageSize: 20 });
    expect(body.data.pagination.page).toBe(1);
    expect(body.data.pagination.pageSize).toBe(20);
    expect(body.data.pagination.total).toBe(1);
  });

  it("logs request identifiers throughout the lifecycle", async () => {
    const logs: any[] = [];
    setLogSink((entry) => {
      logs.push(entry);
    });

    const requestId = "req-logging";
    const request = new NextRequest("http://localhost/api/admin?page=1&pageSize=5", {
      headers: {
        "x-request-id": requestId,
      },
    });

    const response = await adminGet(request);
    const body = (await response.json()) as any;
    if (response.status !== 200) {
      console.error(body);
    }
    expect(response.status).toBe(200);
    expect(logs.some((entry) => entry.context?.requestId === requestId)).toBe(true);
  });
});
