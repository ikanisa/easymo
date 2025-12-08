/**
 * Validation Schema Tests
 */

import {
  CreateProfileSchema,
  SavedLocationSchema,
  SearchProfilesQuerySchema,
  UpdateProfileSchema,
} from "../src/schemas";

describe("Validation Schemas", () => {
  describe("CreateProfileSchema", () => {
    it("should validate valid input with all fields", () => {
      const input = {
        userId: "123e4567-e89b-12d3-a456-426614174000",
        whatsappE164: "+250781234567",
        name: "Test User",
        email: "test@example.com",
        locale: "en",
        metadata: { role: "user" },
      };

      const result = CreateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should validate minimal input", () => {
      const input = {
        userId: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = CreateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.locale).toBe("en"); // Default value
    });

    it("should reject invalid phone number format", () => {
      const input = {
        userId: "123e4567-e89b-12d3-a456-426614174000",
        whatsappE164: "0781234567", // Missing + prefix
      };

      const result = CreateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid email format", () => {
      const input = {
        userId: "123e4567-e89b-12d3-a456-426614174000",
        email: "not-an-email",
      };

      const result = CreateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid UUID format", () => {
      const input = {
        userId: "not-a-uuid",
      };

      const result = CreateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateProfileSchema", () => {
    it("should validate partial updates", () => {
      const input = {
        name: "Updated Name",
      };

      const result = UpdateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject empty update", () => {
      const input = {};

      const result = UpdateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept valid phone update", () => {
      const input = {
        whatsappE164: "+250789876543",
      };

      const result = UpdateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("SearchProfilesQuerySchema", () => {
    it("should use default values", () => {
      const input = {};

      const result = SearchProfilesQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(20);
      expect(result.data?.offset).toBe(0);
    });

    it("should validate pagination limits", () => {
      const input = {
        limit: 150, // Over max of 100
      };

      const result = SearchProfilesQuerySchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should accept valid search parameters", () => {
      const input = {
        name: "John",
        email: "john@example.com",
        limit: 50,
        offset: 10,
      };

      const result = SearchProfilesQuerySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe("SavedLocationSchema", () => {
    it("should validate valid location", () => {
      const input = {
        label: "home",
        latitude: -1.9536,
        longitude: 30.1047,
        address: "Kigali, Rwanda",
      };

      const result = SavedLocationSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid latitude", () => {
      const input = {
        label: "home",
        latitude: 100, // Invalid: must be between -90 and 90
        longitude: 30.1047,
      };

      const result = SavedLocationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject invalid longitude", () => {
      const input = {
        label: "home",
        latitude: -1.9536,
        longitude: 200, // Invalid: must be between -180 and 180
      };

      const result = SavedLocationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should require label", () => {
      const input = {
        latitude: -1.9536,
        longitude: 30.1047,
      };

      const result = SavedLocationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject empty label", () => {
      const input = {
        label: "",
        latitude: -1.9536,
        longitude: 30.1047,
      };

      const result = SavedLocationSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
