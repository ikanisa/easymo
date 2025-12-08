import { SupabaseClient } from "@supabase/supabase-js";

import { AppError, ErrorCodes } from "./errors";
import { logger } from "./logger";
import type { 
  CreateProfileInput, 
  SavedLocationInput,
  SearchProfilesQuery,
  UpdateProfileInput, 
} from "./schemas";

/**
 * Profile data structure from database
 */
export interface Profile {
  user_id: string;
  whatsapp_e164: string | null;
  wa_id: string | null;
  name: string | null;
  email: string | null;
  locale: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/**
 * Saved location data structure
 * Uses the unified saved_locations table (lat/lng columns)
 */
export interface SavedLocation {
  id: string;
  user_id: string;
  label: string;
  lat: number;
  lng: number;
  address: string | null;
  created_at: string;
}

/**
 * Profile Service - handles all profile-related operations
 */
export class ProfileService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Create a new profile
   */
  async createProfile(input: CreateProfileInput): Promise<Profile> {
    logger.info({ msg: "profile.create.start", input: { ...input, whatsappE164: input.whatsappE164 ? "***" : null } });

    const { data, error } = await this.supabase
      .from("profiles")
      .insert({
        user_id: input.userId,
        whatsapp_e164: input.whatsappE164,
        wa_id: input.waId,
        name: input.name,
        email: input.email,
        locale: input.locale,
        metadata: input.metadata,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.error({ msg: "profile.create.error", error: error.message, code: error.code });
      
      if (error.code === "23505") {
        throw new AppError(
          ErrorCodes.CONFLICT,
          "A profile with this identifier already exists",
          409
        );
      }
      
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        "Failed to create profile",
        500,
        { dbError: error.message }
      );
    }

    logger.info({ msg: "profile.create.success", profileId: data.user_id });
    return data as Profile;
  }

  /**
   * Get profile by ID
   */
  async getProfileById(userId: string): Promise<Profile> {
    logger.debug({ msg: "profile.get.start", userId });

    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      logger.warn({ msg: "profile.get.not_found", userId });
      throw new AppError(
        ErrorCodes.NOT_FOUND,
        "Profile not found",
        404
      );
    }

    return data as Profile;
  }

  /**
   * Update profile
   */
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<Profile> {
    logger.info({ msg: "profile.update.start", userId, fields: Object.keys(input) });

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.whatsappE164 !== undefined) updateData.whatsapp_e164 = input.whatsappE164;
    if (input.waId !== undefined) updateData.wa_id = input.waId;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.locale !== undefined) updateData.locale = input.locale;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const { data, error } = await this.supabase
      .from("profiles")
      .update(updateData)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      logger.error({ msg: "profile.update.error", userId, error: error.message });
      
      if (error.code === "PGRST116") {
        throw new AppError(
          ErrorCodes.NOT_FOUND,
          "Profile not found",
          404
        );
      }
      
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        "Failed to update profile",
        500,
        { dbError: error.message }
      );
    }

    logger.info({ msg: "profile.update.success", userId });
    return data as Profile;
  }

  /**
   * Delete profile (soft delete by setting deleted_at)
   */
  async deleteProfile(userId: string): Promise<void> {
    logger.info({ msg: "profile.delete.start", userId });

    // Prefer soft delete where schema supports it; fall back to hard delete
    const { error: softDeleteError } = await this.supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (softDeleteError) {
      logger.warn({ msg: "profile.delete.soft_failed", userId, error: softDeleteError.message });
      const { error: hardDeleteError } = await this.supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId);
      if (hardDeleteError) {
        logger.error({ msg: "profile.delete.error", userId, error: hardDeleteError.message });
        throw new AppError(
          ErrorCodes.DATABASE_ERROR,
          "Failed to delete profile",
          500,
          { dbError: hardDeleteError.message }
        );
      }
      logger.info({ msg: "profile.delete.success.hard", userId });
      return;
    }

    logger.info({ msg: "profile.delete.success.soft", userId });
  }

  /**
   * Search profiles with pagination
   */
  async searchProfiles(query: SearchProfilesQuery): Promise<{ profiles: Profile[]; total: number }> {
    logger.debug({ msg: "profile.search.start", query: { ...query, phone: query.phone ? "***" : null } });

    let queryBuilder = this.supabase
      .from("profiles")
      .select("*", { count: "exact" });

    if (query.phone) {
      queryBuilder = queryBuilder.eq("whatsapp_e164", query.phone);
    }
    if (query.name) {
      queryBuilder = queryBuilder.ilike("name", `%${query.name}%`);
    }
    if (query.email) {
      queryBuilder = queryBuilder.ilike("email", `%${query.email}%`);
    }

    queryBuilder = queryBuilder
      .range(query.offset, query.offset + query.limit - 1)
      .order("created_at", { ascending: false });

    const { data, error, count } = await queryBuilder;

    if (error) {
      logger.error({ msg: "profile.search.error", error: error.message });
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        "Failed to search profiles",
        500,
        { dbError: error.message }
      );
    }

    return {
      profiles: (data || []) as Profile[],
      total: count || 0,
    };
  }

  /**
   * Get user's saved locations
   */
  async getSavedLocations(userId: string): Promise<SavedLocation[]> {
    logger.debug({ msg: "locations.get.start", userId });

    const { data, error } = await this.supabase
      .from("saved_locations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error({ msg: "locations.get.error", userId, error: error.message });
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        "Failed to fetch saved locations",
        500,
        { dbError: error.message }
      );
    }

    return (data || []) as SavedLocation[];
  }

  /**
   * Create a saved location
   */
  async createSavedLocation(userId: string, input: SavedLocationInput): Promise<SavedLocation> {
    logger.info({ msg: "locations.create.start", userId, label: input.label });

    const { data, error } = await this.supabase
      .from("saved_locations")
      .insert({
        user_id: userId,
        label: input.label,
        lat: input.latitude,
        lng: input.longitude,
        address: input.address,
      })
      .select()
      .single();

    if (error) {
      logger.error({ msg: "locations.create.error", userId, error: error.message });
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        "Failed to create saved location",
        500,
        { dbError: error.message }
      );
    }

    logger.info({ msg: "locations.create.success", userId, locationId: data.id });
    return data as SavedLocation;
  }

  /**
   * Delete a saved location
   */
  async deleteSavedLocation(userId: string, locationId: string): Promise<void> {
    logger.info({ msg: "locations.delete.start", userId, locationId });

    const { error } = await this.supabase
      .from("saved_locations")
      .delete()
      .eq("user_id", userId)
      .eq("id", locationId);

    if (error) {
      logger.error({ msg: "locations.delete.error", userId, locationId, error: error.message });
      throw new AppError(
        ErrorCodes.DATABASE_ERROR,
        "Failed to delete saved location",
        500,
        { dbError: error.message }
      );
    }

    logger.info({ msg: "locations.delete.success", userId, locationId });
  }
}
