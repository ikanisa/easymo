/**
 * Unit tests for groups API client
 *
 * Tests the client-side API functions for join requests and members list fetching.
 * Uses Node's native test runner with mocked fetch.
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// Mock the global fetch before importing the module
const originalFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock.fn>;

beforeEach(() => {
  mockFetch = mock.fn(originalFetch);
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

describe("submitJoinRequest", () => {
  it("should successfully submit a join request", async () => {
    const { submitJoinRequest } = await import("@/lib/api/groups");

    mockFetch.mock.mockImplementation(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const result = await submitJoinRequest("group-123", { note: "I want to join" });

    assert.deepEqual(result, { ok: true });
    assert.equal(mockFetch.mock.calls.length, 1);
    assert.equal(mockFetch.mock.calls[0]?.arguments[0], "/api/groups/group-123/join-request");

    const callOptions = mockFetch.mock.calls[0]?.arguments[1] as RequestInit;
    assert.equal(callOptions.method, "POST");
    assert.equal(callOptions.headers?.["Content-Type"], "application/json");
  });

  it("should throw error on failed join request", async () => {
    const { submitJoinRequest } = await import("@/lib/api/groups");

    mockFetch.mock.mockImplementation(
      async () => new Response(JSON.stringify({ error: "Duplicate request" }), { status: 400 })
    );

    await assert.rejects(async () => submitJoinRequest("group-123"), {
      message: "Duplicate request",
    });
  });

  it("should handle empty payload", async () => {
    const { submitJoinRequest } = await import("@/lib/api/groups");

    mockFetch.mock.mockImplementation(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await submitJoinRequest("group-123");

    const callOptions = mockFetch.mock.calls[0]?.arguments[1] as RequestInit;
    const body = JSON.parse(callOptions.body as string);
    assert.deepEqual(body, {});
  });
});

describe("fetchGroupMembers", () => {
  it("should successfully fetch members list", async () => {
    const { fetchGroupMembers } = await import("@/lib/api/groups");

    const mockMembers = [
      {
        id: "member-1",
        full_name: "John Doe",
        msisdn: "+250788123456",
        member_code: "M001",
        status: "active",
        joined_at: "2024-01-01T00:00:00Z",
      },
    ];

    mockFetch.mock.mockImplementation(
      async () => new Response(JSON.stringify({ members: mockMembers }), { status: 200 })
    );

    const result = await fetchGroupMembers("group-123");

    assert.deepEqual(result, { members: mockMembers });
    assert.equal(mockFetch.mock.calls.length, 1);
    assert.equal(mockFetch.mock.calls[0]?.arguments[0], "/api/groups/group-123/members");

    const callOptions = mockFetch.mock.calls[0]?.arguments[1] as RequestInit;
    assert.equal(callOptions.method, "GET");
  });

  it("should throw error for 401 Unauthorized", async () => {
    const { fetchGroupMembers } = await import("@/lib/api/groups");

    mockFetch.mock.mockImplementation(
      async () => new Response(JSON.stringify({ error: "Unauthenticated" }), { status: 401 })
    );

    await assert.rejects(async () => fetchGroupMembers("group-123"), {
      message: "You must be logged in to view members",
    });
  });

  it("should throw error for 403 Forbidden", async () => {
    const { fetchGroupMembers } = await import("@/lib/api/groups");

    mockFetch.mock.mockImplementation(
      async () => new Response(JSON.stringify({ error: "Access denied" }), { status: 403 })
    );

    await assert.rejects(async () => fetchGroupMembers("group-123"), {
      message: "Access denied. Only group members can view the members list",
    });
  });

  it("should handle generic errors", async () => {
    const { fetchGroupMembers } = await import("@/lib/api/groups");

    mockFetch.mock.mockImplementation(
      async () => new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
    );

    await assert.rejects(async () => fetchGroupMembers("group-123"), { message: "Server error" });
  });

  it("should handle non-JSON error responses", async () => {
    const { fetchGroupMembers } = await import("@/lib/api/groups");

    mockFetch.mock.mockImplementation(
      async () => new Response("Internal Server Error", { status: 500 })
    );

    await assert.rejects(async () => fetchGroupMembers("group-123"), { message: "Request failed" });
  });
});
