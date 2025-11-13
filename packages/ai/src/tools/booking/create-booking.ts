import { z } from 'zod';
import type { Tool } from '../../core/types';
import { createClient } from '@supabase/supabase-js';

const CreateBookingSchema = z.object({
  user_id: z.string().uuid(),
  vehicle_id: z.string().uuid().optional(),
  service_type: z.enum(['taxi', 'shuttle', 'delivery', 'rental']),
  pickup_location: z.string(),
  dropoff_location: z.string().optional(),
  pickup_time: z.string(), // ISO datetime
  passengers: z.number().optional().default(1),
  notes: z.string().optional(),
  payment_method: z.enum(['wallet', 'cash', 'card']).optional().default('wallet'),
});

export const createBookingTool: Tool = {
  name: 'create_booking',
  description: 'Create a new booking for taxi, shuttle, delivery, or rental service.',
  parameters: CreateBookingSchema,
  category: 'booking',
  requiresAuth: true,
  handler: async (args, context) => {
    const {
      user_id,
      vehicle_id,
      service_type,
      pickup_location,
      dropoff_location,
      pickup_time,
      passengers,
      notes,
      payment_method,
    } = args;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // 1. Validate user exists and has active wallet if paying by wallet
      const { data: user } = await supabase
        .from('users')
        .select('id, name, phone_number')
        .eq('id', user_id)
        .single();

      if (!user) {
        return {
          success: false,
          error: 'User not found',
          message: "I couldn't find your account. Please try again.",
        };
      }

      // 2. Check wallet balance if payment method is wallet
      if (payment_method === 'wallet') {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance, status')
          .eq('user_id', user_id)
          .single();

        if (!wallet || wallet.status !== 'active') {
          return {
            success: false,
            error: 'Wallet not active',
            message: "Your wallet is not active. Please use a different payment method.",
          };
        }

        // Estimate fare
        const estimatedFare = estimateFare(service_type, pickup_location, dropoff_location);
        const balance = parseFloat(wallet.balance);

        if (balance < estimatedFare) {
          return {
            success: false,
            error: 'Insufficient balance',
            message: `Insufficient balance. Estimated fare is USD ${estimatedFare.toFixed(2)} but you have USD ${balance.toFixed(2)}. Please top up or use a different payment method.`,
            estimated_fare: estimatedFare,
            current_balance: balance,
            requires_topup: true,
          };
        }
      }

      // 3. Find or assign vehicle
      let assignedVehicleId = vehicle_id;
      
      if (!assignedVehicleId) {
        // Auto-assign available vehicle
        const { data: availableVehicle } = await supabase
          .from('vehicles')
          .select('id')
          .eq('vehicle_type', service_type)
          .eq('status', 'available')
          .limit(1)
          .single();

        if (!availableVehicle) {
          return {
            success: false,
            error: 'No vehicles available',
            message: "Sorry, no vehicles are currently available. Would you like to try later?",
          };
        }

        assignedVehicleId = availableVehicle.id;
      }

      // 4. Create booking
      const bookingId = crypto.randomUUID();
      const estimatedFare = estimateFare(service_type, pickup_location, dropoff_location);

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          user_id,
          vehicle_id: assignedVehicleId,
          service_type,
          pickup_location,
          dropoff_location,
          pickup_time,
          passengers,
          notes,
          payment_method,
          estimated_fare: estimatedFare,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select(`
          id,
          service_type,
          pickup_location,
          dropoff_location,
          pickup_time,
          estimated_fare,
          status,
          vehicle:vehicles (
            id,
            vehicle_type,
            license_plate,
            vendor:vendors (
              name,
              phone_number,
              rating
            )
          )
        `)
        .single();

      if (bookingError) {
        return {
          success: false,
          error: bookingError.message,
          message: "Failed to create booking. Please try again.",
        };
      }

      // 5. Update vehicle status
      await supabase
        .from('vehicles')
        .update({ status: 'booked' })
        .eq('id', assignedVehicleId);

      // 6. Send confirmation (would trigger notification system)
      // await sendBookingConfirmation(booking);

      return {
        success: true,
        booking_id: bookingId,
        booking_details: {
          id: booking.id,
          service_type: booking.service_type,
          pickup_location: booking.pickup_location,
          dropoff_location: booking.dropoff_location,
          pickup_time: booking.pickup_time,
          estimated_fare: estimatedFare,
          currency: 'USD',
          status: booking.status,
          vehicle: booking.vehicle,
        },
        message: `✅ Booking confirmed!\n\nBooking ID: ${bookingId}\nService: ${service_type}\nPickup: ${pickup_location}\nTime: ${new Date(pickup_time).toLocaleString()}\nEstimated fare: USD ${estimatedFare.toFixed(2)}\n\nYour driver will contact you shortly.`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: "An error occurred while creating your booking. Please try again.",
      };
    }
  },
};

// Helper function to estimate fare
function estimateFare(serviceType: string, from: string, to?: string): number {
  const baseRates: Record<string, number> = {
    taxi: 5.0,
    shuttle: 3.0,
    delivery: 2.5,
    rental: 50.0,
  };

  const base = baseRates[serviceType] || 5.0;
  const distance = 10; // Mock distance (in production, use routing API)
  const pricePerKm = 0.5;

  return base + (distance * pricePerKm);
}
