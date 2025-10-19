import { RetryPolicy } from "../src/retry";

describe("RetryPolicy", () => {
  it("retries the configured number of times and eventually succeeds", async () => {
    const policy = new RetryPolicy({ attempts: 3, backoffMs: 1, jitterMs: 0 });
    let counter = 0;
    const result = await policy.execute(async () => {
      counter += 1;
      if (counter < 3) {
        throw new Error("fail");
      }
      return "ok";
    });
    expect(result).toBe("ok");
    expect(counter).toBe(3);
  });
});
