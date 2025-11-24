import { normalizeInsuranceExtraction } from "./ins_normalize.ts";
import { assertEquals } from "../../../../../tests/deps/asserts.ts";

Deno.test("normalizeInsuranceExtraction coerces fields", () => {
  const raw = {
    insurer_name: "  Akagera Insurance  ",
    policy_number: "pn-123",
    certificate_number: "  cert-99 ",
    policy_inception: "2025-01-05",
    policy_expiry: "2025-06-30",
    carte_jaune_number: " cj-55 ",
    carte_jaune_expiry: "2025-07-01",
    make: " toyota ",
    model: " corolla ",
    vehicle_year: "2018",
    registration_plate: " rae 123 c ",
    vin_chassis: " abcd1234 ",
    usage: " personal ",
    licensed_to_carry: "4",
  };

  const result = normalizeInsuranceExtraction(raw);
  assertEquals(result.registration_plate, "RAE123C");
  assertEquals(result.vin_chassis, "ABCD1234");
  assertEquals(result.vehicle_year, 2018);
  assertEquals(result.licensed_to_carry, 4);
  assertEquals(result.policy_inception, "2025-01-05");
});
