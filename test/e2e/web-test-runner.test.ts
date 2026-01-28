import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();
import {
    derivePatchFromMessage,
    deriveListingPatchFromMessage,
    type DraftFields,
    type ListingDraftFields,
} from "@easymo/commons";
import {
    createOrGetSession,
    type WebSessionRecord,
} from "../../src/web/sessionService";
import {
    createDraftPost,
    updatePostFields,
    setPostStatus,
    type MarketPost,
} from "../../src/web/postService";
import {
    createListingDraft,
    updateListingFields,
    publishListing,
    type ProductListing,
} from "../../src/web/listingService";

// Define schema for scenarios
type ScenarioStep = {
    action: "signInAnonymously" | "sendMessage";
    input: Record<string, any>;
    expected: Record<string, any>;
};

type Scenario = {
    name: string;
    description: string;
    steps: ScenarioStep[];
    assertions: string[];
};

const SCENARIOS_DIR = path.join(__dirname, "scenarios/web");

const SHOULD_RUN_WEB_E2E =
    process.env.RUN_WEB_E2E === "1" &&
    Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const describeWebE2E = SHOULD_RUN_WEB_E2E ? describe : describe.skip;

function isScenario(value: unknown): value is Scenario {
    if (!value || typeof value !== "object") return false;
    const obj = value as any;
    return typeof obj.name === "string" && typeof obj.description === "string" && Array.isArray(obj.steps);
}

describeWebE2E("Web Marketplace E2E Scenarios", () => {
    const scenarios = SHOULD_RUN_WEB_E2E
        ? fs
              .readdirSync(SCENARIOS_DIR)
              .filter((f) => f.endsWith(".json"))
              .map((f) => {
                  const raw = JSON.parse(
                      fs.readFileSync(path.join(SCENARIOS_DIR, f), "utf-8"),
                  ) as unknown;
                  if (!isScenario(raw)) {
                      return null;
                  }
                  return { filename: f, content: raw };
              })
              .filter(Boolean) as { filename: string; content: Scenario }[]
        : [];

    beforeAll(() => {
        if (!SHOULD_RUN_WEB_E2E) return;
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set RUN_WEB_E2E=1 to enable)");
        }
    });

    scenarios.forEach(({ filename, content }) => {
        it(`runs scenario: ${content.name} (${filename})`, async () => {
            let session: WebSessionRecord | null = null;
            let currentPost: MarketPost | null = null;
            let currentListing: ProductListing | null = null;
            // We need to track drafts locally to pass to the parser, just like App.tsx
            let localDraft: Partial<DraftFields> = { currency: "RWF" };
            let localListingDraft: Partial<ListingDraftFields> = {
                currency: "RWF",
                price_type: "fixed",
                availability: "unknown",
            };

            console.log(`Starting scenario: ${content.description}`);

            for (const step of content.steps) {
                // --- Action: signInAnonymously ---
                if (step.action === "signInAnonymously") {
                    const anonId = `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                    session = await createOrGetSession({ anon_user_id: anonId });
                    expect(session).toBeDefined();

                    if (step.expected.session_created) {
                        expect(session.id).toBeTruthy();
                    }
                }

                // --- Action: sendMessage ---
                if (step.action === "sendMessage") {
                    if (!session) throw new Error("Session not initialized before sendMessage");
                    const text = step.input.text as string;

                    // 1. Parse message using shared logic AND update local state
                    // logic mimics App.tsx: default is 'request' (post) unless mode switch (not implemented effectively in JSON yet)

                    // Check for Listing Mode command
                    if (text.includes("@@mode:listing")) {
                        // Switch "local mode" (conceptually) - in runner, we might need a flag or inferred
                        // For now we try listing parser if we have a currentListing or command
                        if (!currentListing) {
                            currentListing = await createListingDraft({
                                session_id: session.id,
                                listing_type: text.includes("service") ? "service" : "product",
                                currency: "RWF"
                            });
                        }
                        continue; // Skip parser for the command itself
                    }

                    if (currentListing) {
                        // LISTING FLOW
                        const patch = deriveListingPatchFromMessage(text, localListingDraft);
                        localListingDraft = { ...localListingDraft, ...patch };

                        currentListing = await updateListingFields({
                            listing_id: currentListing.id,
                            fields: patch
                        });

                        const lower = text.toLowerCase();
                        const shouldPublish = /\b(publish|post|go live|list it)\b/.test(lower);
                        const readyToPublish = localListingDraft.title && localListingDraft.category && localListingDraft.location_text;

                        if (shouldPublish && readyToPublish) {
                            currentListing = await publishListing({ listing_id: currentListing.id });
                        }

                        // Listing Expectations
                        if (step.expected.listing_created) {
                            expect(currentListing).toBeDefined();
                        }
                        if (step.expected.title) {
                            expect(currentListing?.title).toBe(step.expected.title);
                        }
                        if (step.expected.status === 'published') {
                            expect(currentListing?.status).toBe('published');
                        }

                    } else {
                        // REQUEST FLOW (Default)
                        const patch = derivePatchFromMessage(text, localDraft);
                        localDraft = { ...localDraft, ...patch }; // update local state

                        // 2. Sync with Backend
                        // If no current post, create draft
                        if (!currentPost) {
                            // Basic defaults for creation
                            currentPost = await createDraftPost({
                                session_id: session.id,
                                type: patch.type || "buy", // fallback
                                currency: "RWF"
                            });
                        }

                        // Update backend fields
                        if (Object.keys(patch).length > 0) {
                            currentPost = await updatePostFields({
                                post_id: currentPost.id,
                                fields: patch
                            });
                        }

                        // Check for "Post now" / "Publish" trigger
                        const lower = text.toLowerCase();
                        const shouldPost = /\b(post|publish|go live|ready)\b/.test(lower);
                        const readyToPost = localDraft.type && localDraft.price_min && localDraft.price_max && localDraft.location_text;

                        if (shouldPost && readyToPost) {
                            currentPost = await setPostStatus({
                                post_id: currentPost.id,
                                status: "posted"
                            });
                        }

                        // 3. Verify Expectations
                        if (step.expected.draft_created) {
                            expect(currentPost).toBeDefined();
                        }
                        if (step.expected.type) {
                            expect(currentPost?.type).toBe(step.expected.type);
                        }
                        if (step.expected.category_inferred) {
                            // The parser might infer 'electronics' from 'smartphone'
                            expect(localDraft.category).toBe(step.expected.category_inferred);
                            // Backend should match
                            expect(currentPost?.category).toBe(step.expected.category_inferred);
                        }
                        if (step.expected.price_min) {
                            expect(currentPost?.price_min).toBe(step.expected.price_min);
                        }
                        if (step.expected.location_text) {
                            expect(currentPost?.location_text).toBe(step.expected.location_text);
                        }
                        if (step.expected.status === 'posted') {
                            expect(currentPost?.status).toBe('posted');
                        }
                    }
                }

            }

            // --- Final Assertions (Naive eval for now) ---
            if (content.assertions) {
                const client = getWebSupabaseClient();
                for (const assert of content.assertions) {
                    if (assert.includes("web_sessions.count == 1")) {
                        expect(session).toBeTruthy();
                    }
                    if (assert.includes("market_posts.status == 'posted'") && currentPost) {
                        const { data } = await client.from("market_posts").select("status").eq("id", currentPost.id).single();
                        expect(data?.status).toBe("posted");
                    }
                    if (assert.includes("product_listings.status == 'published'") && currentListing) {
                        const { data } = await client.from("product_listings").select("status").eq("id", currentListing.id).single();
                        expect(data?.status).toBe("published");
                    }
                }
            }

        });
    });
});
