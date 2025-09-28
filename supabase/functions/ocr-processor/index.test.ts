(globalThis as { __DISABLE_OCR_SERVER__?: boolean }).__DISABLE_OCR_SERVER__ =
  true;

Deno.env.set("OCR_MAX_MENU_CATEGORIES", "3");
Deno.env.set("OCR_MAX_MENU_ITEMS", "5");

const { processNextJob, normalizePrice, normalizeExtractionPayload } =
  await import("./index.ts");

type UpdateEntry = {
  status: string;
  options?: {
    errorMessage?: string | null;
    resultPath?: string | null;
    menuId?: string | null;
  };
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

function assertThrows(fn: () => unknown, matcher?: RegExp | string) {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    if (matcher) {
      const message = error instanceof Error ? error.message : String(error);
      if (matcher instanceof RegExp) {
        assert(matcher.test(message), `Expected error to match ${matcher}`);
      } else {
        assert(
          message.includes(matcher),
          `Expected error to include "${matcher}" but got "${message}"`,
        );
      }
    }
  }
  assert(threw, "Expected function to throw");
}

Deno.test("processNextJob processes queued job successfully", async () => {
  const job = { id: "job1", bar_id: "bar1", source_file_id: "files/menu.pdf" };
  const updates: UpdateEntry[] = [];

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

  let notifications = 0;

  const deps: NonNullable<OcrWorkerDeps> = {
    claimNextJob: async () => job,
    updateJobStatus: async (
      _id: string,
      status: string,
      options?: { errorMessage?: string | null; resultPath?: string | null },
    ) => {
      updates.push({ status, options });
    },
    downloadSourceFile: async (path: string) => {
      assertEquals(path, job.source_file_id);
      return { base64Data: "ZmFrZQ==", contentType: "image/png" };
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
    upsertMenuFromExtraction: async (jobArg, data: unknown) => {
      assertEquals(jobArg.id, job.id);
      assertEquals(jobArg.bar_id, job.bar_id);
      assertEquals(JSON.stringify(data), JSON.stringify(extraction));
      return "menu-1";
    },
    notifyMenuReady: async (barId: string) => {
      assertEquals(barId, job.bar_id);
      notifications += 1;
    },
  };

  const result = await processNextJob(deps);
  assertEquals(result.status, "processed");
  if (result.status === "processed") {
    assertEquals(result.jobId, job.id);
  }
  assertEquals(notifications, 1);
  assertEquals(updates.length, 1);
  assertEquals(updates[0].status, "succeeded");
  assertEquals(updates[0].options?.resultPath, `results/${job.id}.json`);
  assertEquals(updates[0].options?.menuId, "menu-1");
});

Deno.test("processNextJob sets failed status when dependencies throw", async () => {
  const job = { id: "job2", bar_id: "bar2", source_file_id: "files/fail.pdf" };
  const updates: UpdateEntry[] = [];

  const deps: NonNullable<OcrWorkerDeps> = {
    claimNextJob: async () => job,
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
    upsertMenuFromExtraction: async () => "menu-ignored",
    notifyMenuReady: async () => {},
  };

  let caught = false;
  try {
    await processNextJob(deps);
  } catch (_err) {
    caught = true;
  }
  assert(caught, "Expected error to be thrown");
  assertEquals(updates.length, 1);
  assertEquals(updates[0].status, "failed");
  assertEquals(updates[0].options?.errorMessage, "download failed");
});

Deno.test("processNextJob returns no_job when queue empty", async () => {
  const deps: NonNullable<OcrWorkerDeps> = {
    claimNextJob: async () => null,
    updateJobStatus: async () => {
      throw new Error("should not update");
    },
    downloadSourceFile: async () => ({ base64Data: "", contentType: "" }),
    runOpenAiExtraction: async () => ({ raw: "{}", data: {} }),
    storeExtractionResult: async () => "results/none",
    upsertMenuFromExtraction: async () => "menu-ignored",
    notifyMenuReady: async () => {},
  };

  const result = await processNextJob(deps);
  assertEquals(result.status, "no_job");
});

Deno.test("normalizePrice handles numeric and formatted inputs", () => {
  assertEquals(normalizePrice(8000), 8000);
  assertEquals(normalizePrice(12.5), 1250);
  assertEquals(normalizePrice("4.50"), 450);
  assertEquals(normalizePrice("1,200"), 1200);
  assertEquals(normalizePrice("RWF 4,500"), 4500);
  assertEquals(normalizePrice("invalid"), 0);
});

Deno.test("normalizeExtractionPayload enforces category limit", () => {
  const payload = {
    currency: "USD",
    categories: Array.from({ length: 4 }, (_, index) => ({
      name: `Cat ${index}`,
      items: [{ name: "Item", price: 100 }],
    })),
  };

  assertThrows(
    () => normalizeExtractionPayload(payload),
    /category limit/,
  );
});

Deno.test("normalizeExtractionPayload enforces item limit", () => {
  const payload = {
    currency: "USD",
    categories: [
      {
        name: "Cat",
        items: Array.from({ length: 6 }, (_, index) => ({
          name: `Item ${index}`,
          price: 100,
        })),
      },
    ],
  };

  assertThrows(() => normalizeExtractionPayload(payload), /item limit/);
});

Deno.test("normalizeExtractionPayload dedupes categories and items", () => {
  const payload = {
    currency: "usd",
    categories: [
      {
        name: " Starters ",
        items: [
          { name: "Soup", flags: ["Spicy", "invalid"], price: "10" },
          { name: "Soup" },
          { name: "Salad", flags: ["VEG"] },
        ],
      },
      {
        name: "starters",
        items: [
          { name: "Soup", flags: ["spicy"] },
          { name: "salad" },
        ],
      },
      { name: "Desserts", items: [] },
    ],
  };

  const result = normalizeExtractionPayload(payload);
  assertEquals(result.currency, "USD");
  assertEquals(result.categories?.length, 1);
  const [category] = result.categories ?? [];
  assertEquals(category?.name, "Starters");
  assertEquals(category?.items?.length, 2);
  const soup = category?.items?.find((item) => item.name === "Soup");
  const salad = category?.items?.find((item) => item.name === "Salad");
  assert(soup, "Soup item missing");
  assertEquals(JSON.stringify(soup?.flags ?? []), JSON.stringify(["spicy"]));
  assertEquals(soup?.price, "10");
  assert(salad, "Salad item missing");
  assertEquals(JSON.stringify(salad?.flags ?? []), JSON.stringify(["veg"]));
});

Deno.test("normalizeExtractionPayload rejects when no usable items", () => {
  const payload = {
    currency: "USD",
    categories: [
      { name: "Empty", items: [] },
      { name: "MissingItems" },
    ],
  };

  assertThrows(
    () => normalizeExtractionPayload(payload),
    /no usable menu items/,
  );
});
