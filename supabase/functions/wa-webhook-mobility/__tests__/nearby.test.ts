/**
 * Nearby Handler Tests  
 * Tests for driver/passenger matching functionality
 */

import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { createTestSuite } from "../../_shared/testing/test-utils.ts";
import { TEST_LOCATIONS } from "../../_shared/testing/fixtures.ts";

const VEHICLE_TYPES = ["moto", "cab", "lifan", "truck", "others"];

function isValidVehicleType(type: string): boolean {
  return VEHICLE_TYPES.includes(type.replace("veh_", ""));
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const vehicleSuite = createTestSuite("Nearby - Vehicle Types");

vehicleSuite.test("validates all vehicle types", () => {
  VEHICLE_TYPES.forEach((type) => {
    assertEquals(isValidVehicleType(type), true);
    assertEquals(isValidVehicleType(`veh_${type}`), true);
  });
});

vehicleSuite.test("rejects invalid vehicle types", () => {
  assertEquals(isValidVehicleType("bicycle"), false);
  assertEquals(isValidVehicleType("plane"), false);
});

const distanceSuite = createTestSuite("Nearby - Distance Calculation");

distanceSuite.test("calculates distance between locations", () => {
  const distance = calculateDistance(
    TEST_LOCATIONS.kigaliCenter.lat,
    TEST_LOCATIONS.kigaliCenter.lng,
    TEST_LOCATIONS.kimironko.lat,
    TEST_LOCATIONS.kimironko.lng
  );
  assertEquals(distance > 0, true);
  assertEquals(distance < 100, true);
});

distanceSuite.test("returns zero for same location", () => {
  const distance = calculateDistance(
    TEST_LOCATIONS.kigaliCenter.lat,
    TEST_LOCATIONS.kigaliCenter.lng,
    TEST_LOCATIONS.kigaliCenter.lat,
    TEST_LOCATIONS.kigaliCenter.lng
  );
  assertEquals(distance, 0);
});

console.log("✅ Nearby handler tests loaded");
