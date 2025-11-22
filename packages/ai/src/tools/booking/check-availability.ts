import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Tool } from '../../core/types';

const CheckAvailabilitySchema = z.object({
  service_type: z.enum(['taxi', 'shuttle', 'delivery', 'rental']).optional(),
  location_from: z.string().optional(),
  location_to: z.string().optional(),
  date: z.string().optional(), // ISO date string
  time: z.string().optional(), // HH:MM format
  passengers: z.number().optional().default(1),
  country: z.string().optional(),
});

export const checkAvailabilityTool: Tool = {
  name: 'check_availability',
  description: 'Check availability of vehicles or services for booking. Can filter by service type, location, date, and time.',
  parameters: CheckAvailabilitySchema,
  category: 'booking',
  handler: async (args, context) => {
    const { service_type, location_from, location_to, date, time, passengers, country } = args;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Build query
      let query = supabase
        .from('vehicles')
        .select(`
          id,
          vehicle_type,
          capacity,
          status,
          current_location,
          vendor:vendors (
            id,
            name,
            rating,
            country
          )
        `)
        .eq('status', 'available');

      // Filter by service type
      if (service_type) {
        query = query.eq('vehicle_type', service_type);
      }

      // Filter by country
      if (country) {
        query = query.eq('vendors.country', country);
      }

      // Filter by capacity (passengers)
      if (passengers) {
        query = query.gte('capacity', passengers);
      }

      const { data: vehicles, error } = await query;

      if (error) {
        return {
          success: false,
          error: error.message,
          message: "I couldn't check availability right now. Please try again.",
        };
      }

      if (!vehicles || vehicles.length === 0) {
        return {
          success: true,
          available: false,
          count: 0,
          message: "No vehicles are currently available for your criteria. Would you like to try different options?",
          suggestions: [
            "Try a different date or time",
            "Increase your search radius",
            "Consider a different vehicle type",
          ],
        };
      }

      // Calculate estimated prices if locations provided
      let priceEstimates: any[] | undefined;
      if (location_from && location_to) {
        // This would integrate with your pricing engine
        priceEstimates = vehicles.slice(0, 3).map((vehicle: any) => ({
          vehicle_id: vehicle.id,
          vehicle_type: vehicle.vehicle_type,
          vendor_name: vehicle.vendor?.name,
          estimated_price: calculateEstimate(vehicle.vehicle_type, location_from, location_to),
          currency: 'USD',
        }));
      }

      // Group by vehicle type
      const grouped = vehicles.reduce((acc: any, vehicle: any) => {
        const type = vehicle.vehicle_type;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(vehicle);
        return acc;
      }, {});

      return {
        success: true,
        available: true,
        count: vehicles.length,
        vehicles_by_type: Object.entries(grouped).map(([type, items]: [string, any]) => ({
          type,
          count: items.length,
          vehicles: items.slice(0, 5), // Top 5 per type
        })),
        price_estimates: priceEstimates,
        message: `Found ${vehicles.length} available vehicle${vehicles.length !== 1 ? 's' : ''} for your criteria.`,
        filters_applied: {
          service_type,
          location_from,
          location_to,
          date,
          time,
          passengers,
          country,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: "An error occurred while checking availability. Please try again.",
      };
    }
  },
};

// Helper function to calculate price estimate
function calculateEstimate(vehicleType: string, from: string, to: string): number {
  // Simple distance-based estimate (in production, use actual routing/pricing engine)
  const baseRates: Record<string, number> = {
    taxi: 5.0,
    shuttle: 3.0,
    delivery: 2.5,
    rental: 50.0, // per day
  };

  const base = baseRates[vehicleType] || 5.0;
  const distance = 10; // Mock distance in km
  const pricePerKm = 0.5;

  return base + (distance * pricePerKm);
}
