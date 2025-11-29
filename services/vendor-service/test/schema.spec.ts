import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from "zod";

const Schema = z.object({
  categories: z.array(z.string()).min(1),
});

describe("vendor category schema", () => {
  it("rejects empty category arrays", () => {
    expect(() => Schema.parse({ categories: [] })).toThrow();
  });
});
