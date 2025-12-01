/**
 * Tests for Marketplace Utilities
 */

import { assertEquals, assert } from "https://deno.land/std@0.208.0/assert/mod.ts";

Deno.test("Location parsing from text", () => {
  const parseLocation = (text: string) => {
    const match = text.match(/-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/);
    if (!match) return null;
    
    const [lat, lng] = match[0].split(',').map(s => parseFloat(s.trim()));
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    
    return { latitude: lat, longitude: lng };
  };

  const r1 = parseLocation("-1.9441,30.0619");
  assertEquals(r1?.latitude, -1.9441);
  assertEquals(r1?.longitude, 30.0619);

  const r2 = parseLocation("Location: -1.9441, 30.0619");
  assertEquals(r2?.latitude, -1.9441);

  assertEquals(parseLocation("not a location"), null);
  assertEquals(parseLocation("91.0,30.0"), null);
});

Deno.test("Distance calculation (Haversine)", () => {
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const distance = calculateDistance(-1.9441, 30.0619, -1.4994, 29.6349);
  assert(distance > 60 && distance < 70);

  const sameLocation = calculateDistance(-1.9441, 30.0619, -1.9441, 30.0619);
  assertEquals(sameLocation, 0);
});
