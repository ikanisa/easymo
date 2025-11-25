/**
 * Media Upload Tests
 * 
 * Tests for photo/document upload functionality
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { handleMediaUpload } from "../media.ts";
import type { MarketplaceContext } from "../agent.ts";

Deno.test("handleMediaUpload - rejects media without active listing", async () => {
  const mockSupabase = {
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "http://example.com/image.jpg" } }),
      }),
    },
    from: () => ({
      update: () => ({
        eq: () => ({ error: null }),
      }),
      select: () => ({
        eq: () => ({
          single: () => ({ data: { photos: [] }, error: null }),
        }),
      }),
    }),
    rpc: () => {},
  } as any;

  const context: MarketplaceContext = {
    phone: "+250788123456",
    flowType: null,
    flowStep: null,
    collectedData: {},
    conversationHistory: [],
    currentListingId: null, // No active listing
  };

  const message = {
    type: "image" as const,
    image: {
      id: "test-media-id",
      caption: "Test photo",
    },
  };

  const response = await handleMediaUpload(
    "+250788123456",
    message,
    context,
    mockSupabase
  );

  assertEquals(response.includes("creating a listing"), true);
});

Deno.test("handleMediaUpload - rejects video uploads", async () => {
  const mockSupabase = {} as any;
  
  const context: MarketplaceContext = {
    phone: "+250788123456",
    flowType: "selling",
    flowStep: "photo",
    collectedData: {},
    conversationHistory: [],
    currentListingId: "test-listing-id",
  };

  const message = {
    type: "video" as const,
    video: {
      id: "test-video-id",
    },
  };

  const response = await handleMediaUpload(
    "+250788123456",
    message,
    context,
    mockSupabase
  );

  assertEquals(response.includes("video") || response.includes("Video"), true);
  assertEquals(response.includes("not supported") || response.includes("aren't supported"), true);
});
