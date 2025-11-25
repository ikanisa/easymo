/**
 * Profile Service Unit Tests
 */

import { AppError } from "../src/errors";
import { ProfileService } from "../src/service";

// More complete Mock Supabase client that supports method chaining
const createMockSupabase = () => {
  const mockData: Record<string, unknown[]> = {
    profiles: [],
    user_saved_locations: [],
  };

  let lastError: { message: string; code: string } | null = null;
  let insertedData: Record<string, unknown> | null = null;
  let updatedData: Record<string, unknown> | null = null;

  const createBuilder = (table: string) => {
    const currentData = mockData[table] || [];
    
    const builder: Record<string, unknown> = {
      select: (_columns?: string, _options?: { count?: string }) => {
        if (lastError) {
          return Promise.resolve({ data: null, error: lastError, count: 0 });
        }
        return {
          eq: (column: string, value: unknown) => {
            const filtered = currentData.filter(
              (item) => (item as Record<string, unknown>)[column] === value
            );
            return {
              single: () => {
                const item = filtered[0] || null;
                return Promise.resolve({
                  data: item,
                  error: item ? null : { code: "PGRST116", message: "Not found" },
                });
              },
              order: (_col: string, _opts?: { ascending: boolean }) => {
                return Promise.resolve({
                  data: filtered,
                  error: null,
                });
              },
            };
          },
          ilike: (_column: string, _pattern: string) => {
            return {
              range: (_from: number, _to: number) => ({
                order: (_col: string, _opts?: { ascending: boolean }) =>
                  Promise.resolve({
                    data: currentData,
                    error: null,
                    count: currentData.length,
                  }),
              }),
            };
          },
          range: (_from: number, _to: number) => ({
            order: (_col: string, _opts?: { ascending: boolean }) =>
              Promise.resolve({
                data: currentData,
                error: null,
                count: currentData.length,
              }),
          }),
        };
      },
      insert: (data: Record<string, unknown>) => {
        insertedData = { ...data, created_at: new Date().toISOString() };
        if (lastError) {
          return {
            select: () => ({
              single: () => Promise.resolve({ data: null, error: lastError }),
            }),
          };
        }
        mockData[table] = mockData[table] || [];
        mockData[table].push(insertedData);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: insertedData, error: null }),
          }),
        };
      },
      update: (data: Record<string, unknown>) => {
        updatedData = { ...data, updated_at: new Date().toISOString() };
        return {
          eq: (_column: string, _value: unknown) => ({
            select: () => ({
              single: () => {
                if (lastError) {
                  return Promise.resolve({ data: null, error: lastError });
                }
                return Promise.resolve({ data: updatedData, error: null });
              },
            }),
          }),
        };
      },
      delete: () => ({
        eq: (_column: string, _value: unknown) => {
          if (lastError) {
            return Promise.resolve({ error: lastError });
          }
          return {
            eq: (_col2: string, _val2: unknown) =>
              Promise.resolve({ error: null }),
          };
        },
      }),
    };
    return builder;
  };

  return {
    _setMockData: (table: string, data: unknown[]) => {
      mockData[table] = data;
    },
    _setMockError: (error: { message: string; code: string } | null) => {
      lastError = error;
    },
    _getMockData: (table: string) => mockData[table],
    from: (table: string) => createBuilder(table),
  };
};

describe("ProfileService", () => {
  let service: ProfileService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ProfileService(mockSupabase as any);
  });

  describe("createProfile", () => {
    it("should create a profile with valid input", async () => {
      const input = {
        whatsappE164: "+250781234567",
        name: "Test User",
        email: "test@example.com",
        locale: "en",
      };

      const result = await service.createProfile(input);

      expect(result).toBeDefined();
      expect(result.whatsapp_e164).toBe("+250781234567");
      expect(result.name).toBe("Test User");
    });

    it("should throw CONFLICT error for duplicate profile", async () => {
      mockSupabase._setMockError({ message: "Duplicate key", code: "23505" });

      await expect(
        service.createProfile({ whatsappE164: "+250781234567", locale: "en" })
      ).rejects.toThrow(AppError);
    });
  });

  describe("getProfileById", () => {
    it("should return profile when found", async () => {
      const mockProfile = {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        whatsapp_e164: "+250781234567",
        name: "Test User",
        created_at: new Date().toISOString(),
      };
      mockSupabase._setMockData("profiles", [mockProfile]);

      const result = await service.getProfileById(mockProfile.user_id);

      expect(result.user_id).toBe(mockProfile.user_id);
      expect(result.name).toBe("Test User");
    });

    it("should throw NOT_FOUND error when profile does not exist", async () => {
      mockSupabase._setMockData("profiles", []);

      await expect(
        service.getProfileById("123e4567-e89b-12d3-a456-426614174000")
      ).rejects.toThrow(AppError);
    });
  });

  describe("updateProfile", () => {
    it("should update profile with valid input", async () => {
      const mockProfile = {
        user_id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Updated User",
        updated_at: new Date().toISOString(),
      };
      mockSupabase._setMockData("profiles", [mockProfile]);

      const result = await service.updateProfile(mockProfile.user_id, { name: "Updated User" });

      expect(result.name).toBe("Updated User");
    });
  });

  describe("searchProfiles", () => {
    it("should return paginated results", async () => {
      const mockProfiles = [
        { user_id: "1", name: "User 1", created_at: new Date().toISOString() },
        { user_id: "2", name: "User 2", created_at: new Date().toISOString() },
      ];
      mockSupabase._setMockData("profiles", mockProfiles);

      const result = await service.searchProfiles({ limit: 20, offset: 0 });

      expect(result.profiles).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe("getSavedLocations", () => {
    it("should return user's saved locations", async () => {
      const userId = "123e4567-e89b-12d3-a456-426614174000";
      const mockLocations = [
        { id: "loc1", user_id: userId, label: "home", latitude: -1.9536, longitude: 30.1047 },
        { id: "loc2", user_id: userId, label: "work", latitude: -1.9468, longitude: 30.0619 },
      ];
      mockSupabase._setMockData("user_saved_locations", mockLocations);

      const result = await service.getSavedLocations(userId);

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("home");
    });
  });

  describe("createSavedLocation", () => {
    it("should create a saved location", async () => {
      const userId = "123e4567-e89b-12d3-a456-426614174000";
      const input = {
        label: "home",
        latitude: -1.9536,
        longitude: 30.1047,
        address: "Kigali, Rwanda",
      };

      const result = await service.createSavedLocation(userId, input);

      expect(result).toBeDefined();
      expect(result.label).toBe("home");
      expect(result.latitude).toBe(-1.9536);
    });
  });

  describe("deleteSavedLocation", () => {
    it("should delete a saved location without error", async () => {
      const userId = "123e4567-e89b-12d3-a456-426614174000";
      const locationId = "loc1";

      await expect(
        service.deleteSavedLocation(userId, locationId)
      ).resolves.not.toThrow();
    });
  });
});
