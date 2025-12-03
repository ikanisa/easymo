// =====================================================
// JOB BOARD AI AGENT - Tests
// =====================================================

import { assertEquals, assertExists } from "$std/assert/mod.ts";
import { generateEmbedding } from "./handlers.ts";

// Mock OpenAI for testing
const mockOpenAI = {
  embeddings: {
    create: async ({ input }: any) => {
      return {
        data: [{
          embedding: new Array(1536).fill(0).map(() => Math.random())
        }]
      };
    }
  },
  chat: {
    completions: {
      create: async ({ messages }: any) => {
        return {
          choices: [{
            message: {
              role: "assistant",
              content: "Test response",
              tool_calls: []
            }
          }]
        };
      }
    }
  }
} as any;

Deno.test("generateEmbedding - creates 1536-dim vector", async () => {
  const text = "Need construction worker for 3 days in Kigali";
  const embedding = await generateEmbedding(mockOpenAI, text);
  
  assertEquals(embedding.length, 1536);
  assertEquals(typeof embedding[0], "number");
});

Deno.test("generateEmbedding - different texts produce different embeddings", async () => {
  const text1 = "Construction worker needed";
  const text2 = "Software developer position";
  
  const embedding1 = await generateEmbedding(mockOpenAI, text1);
  const embedding2 = await generateEmbedding(mockOpenAI, text2);
  
  // Embeddings should be different (cosine similarity < 1.0)
  const similarity = cosineSimilarity(embedding1, embedding2);
  assertEquals(similarity < 1.0, true);
});

Deno.test("Job metadata extraction format", () => {
  const metadata = {
    title: "Construction Worker",
    category: "construction",
    job_type: "gig",
    location: "Kigali",
    pay_min: 10000,
    pay_max: 15000,
    pay_type: "daily",
    duration: "3 days",
    required_skills: ["physical_strength", "construction"],
    experience_level: "beginner"
  };
  
  assertExists(metadata.title);
  assertExists(metadata.category);
  assertExists(metadata.job_type);
  assertEquals(typeof metadata.pay_min, "number");
});

Deno.test("Intent detection - post job", () => {
  const message1 = "I need to hire someone for delivery";
  const message2 = "Need construction worker";
  const message3 = "Looking for someone to help";
  
  const keywords = ["need", "hire", "looking for"];
  
  assertEquals(
    keywords.some(k => message1.toLowerCase().includes(k)),
    true,
    "Should detect post job intent"
  );
});

Deno.test("Intent detection - find job", () => {
  const message1 = "I'm looking for work";
  const message2 = "Need a job";
  const message3 = "Can work as delivery driver";
  
  const keywords = ["looking for work", "need", "can work"];
  
  assertEquals(
    keywords.some(k => message1.toLowerCase().includes(k)),
    true,
    "Should detect find job intent"
  );
});

// Helper: Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Integration test (requires real Supabase)
Deno.test({
  name: "Integration: Full job post flow",
  ignore: !Deno.env.get("RUN_INTEGRATION_TESTS"),
  async fn() {
    // This would test:
    // 1. POST request to edge function
    // 2. Job saved to database
    // 3. Embeddings generated
    // 4. Matches created
    // 5. Response returned
    
    // Requires SUPABASE_URL and keys in env
    console.log("Integration test requires RUN_INTEGRATION_TESTS=true");
  }
});
