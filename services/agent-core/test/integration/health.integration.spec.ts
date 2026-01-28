import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HealthModule } from "../../src/modules/health/health.module.js";

describe("agent-core integration", () => {
  let app: INestApplication;
  let server: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    const nestApp = moduleRef.createNestApplication();
    await nestApp.init();
    app = nestApp;
    server = nestApp.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health status", async () => {
    const response = await request(server).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
