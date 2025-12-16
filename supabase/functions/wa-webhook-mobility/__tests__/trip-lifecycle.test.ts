/**
 * Trip Lifecycle Tests
 * Tests for trip state machine transitions
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createTestSuite } from "../../_shared/testing/test-utils.ts";

const TripStatus = {
  OPEN: "open",
  MATCHED: "matched",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

type TripStatusType = typeof TripStatus[keyof typeof TripStatus];

const VALID_TRANSITIONS: Record<TripStatusType, TripStatusType[]> = {
  [TripStatus.OPEN]: [TripStatus.MATCHED, TripStatus.CANCELLED],
  [TripStatus.MATCHED]: [TripStatus.IN_PROGRESS, TripStatus.CANCELLED],
  [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED, TripStatus.CANCELLED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
};

function isValidTransition(from: TripStatusType, to: TripStatusType): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

const transitionSuite = createTestSuite("Trip Lifecycle - Transitions");

transitionSuite.test("open can transition to matched", () => {
  assertEquals(isValidTransition(TripStatus.OPEN, TripStatus.MATCHED), true);
});

transitionSuite.test("open cannot transition to completed", () => {
  assertEquals(isValidTransition(TripStatus.OPEN, TripStatus.COMPLETED), false);
});

transitionSuite.test("matched can transition to in_progress", () => {
  assertEquals(
    isValidTransition(TripStatus.MATCHED, TripStatus.IN_PROGRESS),
    true,
  );
});

transitionSuite.test("completed cannot transition", () => {
  assertEquals(isValidTransition(TripStatus.COMPLETED, TripStatus.OPEN), false);
  assertEquals(
    isValidTransition(TripStatus.COMPLETED, TripStatus.CANCELLED),
    false,
  );
});

transitionSuite.test("all states can transition to cancelled except terminal states", () => {
  assertEquals(isValidTransition(TripStatus.OPEN, TripStatus.CANCELLED), true);
  assertEquals(
    isValidTransition(TripStatus.MATCHED, TripStatus.CANCELLED),
    true,
  );
  assertEquals(
    isValidTransition(TripStatus.IN_PROGRESS, TripStatus.CANCELLED),
    true,
  );
  assertEquals(
    isValidTransition(TripStatus.COMPLETED, TripStatus.CANCELLED),
    false,
  );
  assertEquals(
    isValidTransition(TripStatus.CANCELLED, TripStatus.CANCELLED),
    false,
  );
});

console.log("✅ Trip lifecycle tests loaded");
