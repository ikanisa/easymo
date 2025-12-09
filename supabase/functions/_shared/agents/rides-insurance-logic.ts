/**
 * AI Agent Logic Implementation - Rides & Insurance
 * WhatsApp-first natural language agents
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================================
// RIDES AGENT LOGIC
// =====================================================================

export interface RidesAgentContext {
  userId: string;
  conversationId: string;
  agentId: string;
  intent: RidesIntent;
}

export interface RidesIntent {
  type: "find_driver" | "find_passenger" | "schedule_trip" | "cancel_trip" | "save_location";
  payload: Record<string, any>;
}

export class RidesAgent {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Process a rides intent from natural language
   */
  async processIntent(context: RidesAgentContext): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const { userId, conversationId, agentId, intent } = context;

    try {
      switch (intent.type) {
        case "find_driver":
          return await this.findDriver(userId, conversationId, intent.payload);
        
        case "find_passenger":
          return await this.findPassenger(userId, conversationId, intent.payload);
        
        case "schedule_trip":
          return await this.scheduleTrip(userId, conversationId, intent.payload);
        
        case "cancel_trip":
          return await this.cancelTrip(userId, intent.payload);
        
        case "save_location":
          return await this.saveLocation(userId, intent.payload);
        
        default:
          return {
            success: false,
            message: "Unknown rides intent type"
          };
      }
    } catch (error) {
      console.error("Rides agent error:", error);
      return {
        success: false,
        message: "Error processing rides request"
      };
    }
  }

  /**
   * Find a driver for a passenger
   */
  private async findDriver(userId: string, conversationId: string, payload: any) {
    const { pickupLat, pickupLng, pickupAddress, dropoffAddress, dropoffLat, dropoffLng, scheduledAt } = payload;

    // Create trip request
    const { data: trip, error: tripError } = await this.supabase
      .from("trips")
      .insert({
        rider_user_id: userId,
        pickup_address: pickupAddress,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_address: dropoffAddress,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        scheduled_at: scheduledAt || null,
        status: "pending"
      })
      .select()
      .single();

    if (tripError) {
      return { success: false, message: "Failed to create trip request" };
    }

    // Find nearby online drivers
    const { data: drivers, error: driversError } = await this.supabase.rpc(
      "rides_find_nearby_drivers",
      {
        lat: pickupLat,
        lng: pickupLng,
        radius_km: 10
      }
    );

    if (driversError || !drivers || drivers.length === 0) {
      return {
        success: true,
        message: "Trip request created. No drivers available nearby right now.",
        data: { tripId: trip.id, driversFound: 0 }
      };
    }

    return {
      success: true,
      message: `Found ${drivers.length} nearby driver${drivers.length > 1 ? 's' : ''}`,
      data: { tripId: trip.id, drivers, driversFound: drivers.length }
    };
  }

  /**
   * Find passengers for a driver
   */
  private async findPassenger(userId: string, conversationId: string, payload: any) {
    const { currentLat, currentLng, routeLat, routeLng, radiusKm = 5 } = payload;

    // Update driver status to online using RPC
    try {
      await this.supabase.rpc("update_driver_status", {
        _user_id: userId,
        _online: true,
        _lat: currentLat,
        _lng: currentLng,
      });
    } catch (error) {
      console.warn("update_driver_status failed:", error);
    }

    // Find nearby pending trips
    const { data: trips, error: tripsError } = await this.supabase.rpc(
      "rides_find_nearby_trips",
      {
        lat: currentLat,
        lng: currentLng,
        radius_km: radiusKm
      }
    );

    if (tripsError || !trips || trips.length === 0) {
      return {
        success: true,
        message: "You are now online. No pending trips nearby.",
        data: { tripsFound: 0 }
      };
    }

    return {
      success: true,
      message: `Found ${trips.length} passenger${trips.length > 1 ? 's' : ''} nearby`,
      data: { trips, tripsFound: trips.length }
    };
  }

  /**
   * Schedule a future trip
   */
  private async scheduleTrip(userId: string, conversationId: string, payload: any) {
    const { pickupLat, pickupLng, pickupAddress, dropoffAddress, dropoffLat, dropoffLng, scheduledAt } = payload;

    if (!scheduledAt) {
      return { success: false, message: "Scheduled time is required" };
    }

    const { data: trip, error } = await this.supabase
      .from("trips")
      .insert({
        rider_user_id: userId,
        pickup_address: pickupAddress,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_address: dropoffAddress,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        scheduled_at: scheduledAt,
        status: "pending"
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: "Failed to schedule trip" };
    }

    return {
      success: true,
      message: `Trip scheduled for ${new Date(scheduledAt).toLocaleString()}`,
      data: { tripId: trip.id }
    };
  }

  /**
   * Cancel a trip
   */
  private async cancelTrip(userId: string, payload: any) {
    const { tripId } = payload;

    const { data: trip, error } = await this.supabase
      .from("trips")
      .update({ status: "cancelled" })
      .eq("id", tripId)
      .or(`rider_user_id.eq.${userId},driver_user_id.eq.${userId}`)
      .select()
      .single();

    if (error) {
      return { success: false, message: "Failed to cancel trip" };
    }

    return {
      success: true,
      message: "Trip cancelled successfully",
      data: { tripId: trip.id }
    };
  }

  /**
   * Save a location for quick reuse
   */
  private async saveLocation(userId: string, payload: any) {
    const { label, addressText, lat, lng } = payload;

    const { data: location, error } = await this.supabase
      .from("saved_locations")
      .insert({
        user_id: userId,
        label,
        address: addressText,  // Changed from address_text to address
        lat,
        lng
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: "Failed to save location" };
    }

    return {
      success: true,
      message: `Location "${label}" saved`,
      data: { locationId: location.id }
    };
  }
}

// =====================================================================
// INSURANCE AGENT LOGIC
// =====================================================================

export interface InsuranceAgentContext {
  userId: string;
  conversationId: string;
  agentId: string;
  intent: InsuranceIntent;
}

export interface InsuranceIntent {
  type: "submit_documents" | "request_quote" | "renew_policy" | "check_status" | "create_profile";
  payload: Record<string, any>;
}

export class InsuranceAgent {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Process an insurance intent from natural language
   */
  async processIntent(context: InsuranceAgentContext): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    const { userId, conversationId, agentId, intent } = context;

    try {
      switch (intent.type) {
        case "create_profile":
          return await this.createProfile(userId, intent.payload);
        
        case "submit_documents":
          return await this.submitDocuments(userId, intent.payload);
        
        case "request_quote":
          return await this.requestQuote(userId, agentId, intent.payload);
        
        case "renew_policy":
          return await this.renewPolicy(userId, agentId, intent.payload);
        
        case "check_status":
          return await this.checkStatus(userId);
        
        default:
          return {
            success: false,
            message: "Unknown insurance intent type"
          };
      }
    } catch (error) {
      console.error("Insurance agent error:", error);
      return {
        success: false,
        message: "Error processing insurance request"
      };
    }
  }

  /**
   * Create insurance profile
   */
  private async createProfile(userId: string, payload: any) {
    const { vehicleIdentifier, vehicleMetadata, ownerName, ownerIdNumber } = payload;

    const { data: profile, error } = await this.supabase
      .from("insurance_profiles")
      .insert({
        user_id: userId,
        vehicle_identifier: vehicleIdentifier,
        vehicle_metadata: vehicleMetadata || {},
        owner_name: ownerName,
        owner_id_number: ownerIdNumber
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: "Failed to create insurance profile" };
    }

    return {
      success: true,
      message: "Insurance profile created",
      data: { profileId: profile.id }
    };
  }

  /**
   * Submit insurance documents
   */
  private async submitDocuments(userId: string, payload: any) {
    const { profileId, documents } = payload;

    // Verify profile ownership
    const { data: profile, error: profileError } = await this.supabase
      .from("insurance_profiles")
      .select("id")
      .eq("id", profileId)
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return { success: false, message: "Profile not found" };
    }

    // Insert documents
    const docInserts = documents.map((doc: any) => ({
      profile_id: profileId,
      document_type: doc.type,
      file_url: doc.fileUrl,
      wa_message_id: doc.waMessageId,
      metadata: doc.metadata || {}
    }));

    const { data: insertedDocs, error } = await this.supabase
      .from("insurance_documents")
      .insert(docInserts)
      .select();

    if (error) {
      return { success: false, message: "Failed to submit documents" };
    }

    return {
      success: true,
      message: `${insertedDocs.length} document${insertedDocs.length > 1 ? 's' : ''} submitted`,
      data: { documentIds: insertedDocs.map((d: any) => d.id) }
    };
  }

  /**
   * Request insurance quote
   */
  private async requestQuote(userId: string, agentId: string, payload: any) {
    const { profileId, requestType = "new", quoteDetails } = payload;

    // Verify profile ownership
    const { data: profile, error: profileError } = await this.supabase
      .from("insurance_profiles")
      .select("id")
      .eq("id", profileId)
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return { success: false, message: "Profile not found" };
    }

    const { data: request, error } = await this.supabase
      .from("insurance_quote_requests")
      .insert({
        profile_id: profileId,
        agent_id: agentId,
        request_type: requestType,
        status: "pending",
        quote_details: quoteDetails || {},
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: "Failed to create quote request" };
    }

    return {
      success: true,
      message: "Quote request submitted. We'll get back to you soon.",
      data: { requestId: request.id }
    };
  }

  /**
   * Renew existing policy
   */
  private async renewPolicy(userId: string, agentId: string, payload: any) {
    const { profileId } = payload;

    return await this.requestQuote(userId, agentId, {
      profileId,
      requestType: "renewal"
    });
  }

  /**
   * Check status of insurance requests
   */
  private async checkStatus(userId: string) {
    const { data: profiles, error: profilesError } = await this.supabase
      .from("insurance_profiles")
      .select("id")
      .eq("user_id", userId);

    if (profilesError || !profiles || profiles.length === 0) {
      return {
        success: true,
        message: "No insurance profiles found",
        data: { requests: [] }
      };
    }

    const profileIds = profiles.map((p: any) => p.id);

    const { data: requests, error } = await this.supabase
      .from("insurance_quote_requests")
      .select("id, request_type, status, requested_at, resolved_at, quote_details")
      .in("profile_id", profileIds)
      .order("requested_at", { ascending: false });

    if (error) {
      return { success: false, message: "Failed to check status" };
    }

    return {
      success: true,
      message: `You have ${requests.length} insurance request${requests.length !== 1 ? 's' : ''}`,
      data: { requests }
    };
  }
}

// =====================================================================
// INTENT PROCESSOR - Routes intents to appropriate agents
// =====================================================================

export async function processAgentIntent(
  supabaseUrl: string,
  supabaseKey: string,
  agentSlug: string,
  userId: string,
  conversationId: string,
  agentId: string,
  intent: any
): Promise<any> {
  
  switch (agentSlug) {
    case "rides": {
      const ridesAgent = new RidesAgent(supabaseUrl, supabaseKey);
      return await ridesAgent.processIntent({
        userId,
        conversationId,
        agentId,
        intent
      });
    }

    case "insurance": {
      const insuranceAgent = new InsuranceAgent(supabaseUrl, supabaseKey);
      return await insuranceAgent.processIntent({
        userId,
        conversationId,
        agentId,
        intent
      });
    }

    default:
      return {
        success: false,
        message: `Agent ${agentSlug} not implemented yet`
      };
  }
}
