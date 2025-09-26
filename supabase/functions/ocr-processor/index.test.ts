(globalThis as { __DISABLE_OCR_SERVER__?: boolean }).__DISABLE_OCR_SERVER__ =
  true;

const { processNextJob } = await import("./index.ts");

type UpdateEntry = {
  status: string;
  options?: { errorMessage?: string | null; resultPath?: string | null };
};

type OcrWorkerDeps = Parameters<typeof processNextJob>[0];

function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

function assertEquals(
  actual: unknown,
  expected: unknown,
  message?: string,
): void {
  if (Number.isNaN(actual) && Number.isNaN(expected)) return;
  if (actual !== expected) {
    throw new Error(message ?? `Assertion failed: ${actual} !== ${expected}`);
  }
}

Deno.test("processNextJob processes queued job successfully", async () => {
  const job = { id: "job1", bar_id: "bar1", source_file_id: "files/menu.pdf" };
  const updates: UpdateEntry[] = [];
  let menuCalled = false;

  const extraction = {
    currency: "RWF",
    categories: [
      {
        name: "Meals",
        items: [
          {
            name: "Grilled Chicken",
            description: "With fries",
            price: 8000,
            flags: ["spicy"],
          },
        ],
      },
    ],
  };

  const deps: NonNullable<OcrWorkerDeps> = {
    fetchQueuedJob: async () => job,
    updateJobStatus: async (
      _id: string,
      status: string,
      options?: { errorMessage?: string | null; resultPath?: string | null },
    ) => {
      updates.push({ status, options });
    },
    downloadSourceFile: async (path: string) => {
      assertEquals(path, job.source_file_id);
      return { base64Data: "ZmFrZQ==", contentType: "application/pdf" };
    },
    runOpenAiExtraction: async (_base64: string, _type: string) => ({
      raw: JSON.stringify(extraction),
      data: extraction,
    }),
    storeExtractionResult: async (jobId: string, raw: string) => {
      assertEquals(jobId, job.id);
      assertEquals(raw, JSON.stringify(extraction));
      return `results/${jobId}.json`;
    },
    upsertMenuFromExtraction: async (barId: string, data: unknown) => {
      assertEquals(barId, job.bar_id);
      assertEquals(JSON.stringify(data), JSON.stringify(extraction));
      menuCalled = true;
    },
  };

  const result = await processNextJob(deps);
  assertEquals(result.status, "processed");
  if (result.status === "processed") {
    assertEquals(result.jobId, job.id);
  }
  assert(menuCalled, "Menu upsert not called");
  assertEquals(updates.length, 2);
  assertEquals(updates[0].status, "processing");
  assertEquals(updates[1].status, "succeeded");
  assertEquals(updates[1].options?.resultPath, `results/${job.id}.json`);
});

Deno.test("processNextJob sets failed status when dependencies throw", async () => {
  const job = { id: "job2", bar_id: "bar2", source_file_id: "files/fail.pdf" };
  const updates: UpdateEntry[] = [];

  const deps: NonNullable<OcrWorkerDeps> = {
    fetchQueuedJob: async () => job,
    updateJobStatus: async (
      _id: string,
      status: string,
      options?: { errorMessage?: string | null; resultPath?: string | null },
    ) => {
      updates.push({ status, options });
    },
    downloadSourceFile: async () => {
      throw new Error("download failed");
    },
    runOpenAiExtraction: async () => ({ raw: "{}", data: {} }),
    storeExtractionResult: async () => "results/job2.json",
    upsertMenuFromExtraction: async () => {},
  };

  let caught = false;
  try {
    await processNextJob(deps);
  } catch (_err) {
    caught = true;
  }
  assert(caught, "Expected error to be thrown");
  assertEquals(updates.length, 2);
  assertEquals(updates[0].status, "processing");
  assertEquals(updates[1].status, "failed");
  assertEquals(updates[1].options?.errorMessage, "download failed");
});

Deno.test("processNextJob returns no_job when queue empty", async () => {
  const deps: NonNullable<OcrWorkerDeps> = {
    fetchQueuedJob: async () => null,
    updateJobStatus: async () => {
      throw new Error("should not update");
    },
    downloadSourceFile: async () => ({ base64Data: "", contentType: "" }),
    runOpenAiExtraction: async () => ({ raw: "{}", data: {} }),
    storeExtractionResult: async () => "results/none",
    upsertMenuFromExtraction: async () => {},
  };

  const result = await processNextJob(deps);
  assertEquals(result.status, "no_job");
});
