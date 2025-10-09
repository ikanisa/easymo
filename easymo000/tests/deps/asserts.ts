export function assertEquals(
  actual: unknown,
  expected: unknown,
  message?: string,
): void {
  const same = Object.is(actual, expected) ||
    JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    throw new Error(message ?? `Assertion failed: ${actual} !== ${expected}`);
  }
}

export function assert(
  condition: unknown,
  message?: string,
): asserts condition {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}
