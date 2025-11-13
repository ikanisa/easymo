import { z } from 'zod';
import type { Tool } from '../../core/types';
import { createClient } from '@supabase/supabase-js';

const GetUserProfileSchema = z.object({
  user_id: z.string().uuid().optional(),
  phone_number: z.string().optional(),
  include_stats: z.boolean().optional().default(false),
  include_wallet: z.boolean().optional().default(false),
}).refine(
  (data) => data.user_id || data.phone_number,
  { message: 'Either user_id or phone_number must be provided' }
);

export const getUserProfileTool: Tool = {
  name: 'get_user_profile',
  description: 'Get user profile information including personal details, stats, and wallet info.',
  parameters: GetUserProfileSchema,
  category: 'profile',
  handler: async (args, context) => {
    const { user_id, phone_number, include_stats, include_wallet } = args;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Build query
      let query = supabase.from('users').select(`
        id,
        name,
        email,
        phone_number,
        country,
        language,
        status,
        created_at,
        last_active_at,
        preferences,
        metadata
      `);

      if (user_id) {
        query = query.eq('id', user_id);
      } else if (phone_number) {
        query = query.eq('phone_number', phone_number);
      }

      const { data: user, error: userError } = await query.single();

      if (userError || !user) {
        return {
          success: false,
          error: 'User not found',
          message: "I couldn't find your profile. Please try again.",
        };
      }

      const profile: any = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        country: user.country,
        language: user.language || 'en',
        status: user.status,
        member_since: user.created_at,
        last_active: user.last_active_at,
        preferences: user.preferences || {},
      };

      // Add wallet info if requested
      if (include_wallet) {
        const { data: wallet } = await supabase
          .from('wallets')
          .select('balance, currency, status')
          .eq('user_id', user.id)
          .single();

        if (wallet) {
          profile.wallet = {
            balance: parseFloat(wallet.balance),
            currency: wallet.currency || 'USD',
            status: wallet.status,
            formatted: `${wallet.currency || 'USD'} ${parseFloat(wallet.balance).toFixed(2)}`,
          };
        }
      }

      // Add stats if requested
      if (include_stats) {
        // Get booking stats
        const { data: bookingStats } = await supabase
          .rpc('get_user_booking_stats', { p_user_id: user.id });

        // Get transaction stats
        const { data: transactionStats } = await supabase
          .rpc('get_user_transaction_stats', { p_user_id: user.id });

        profile.stats = {
          total_bookings: bookingStats?.total_bookings || 0,
          completed_bookings: bookingStats?.completed_bookings || 0,
          cancelled_bookings: bookingStats?.cancelled_bookings || 0,
          total_spent: parseFloat(transactionStats?.total_spent || '0'),
          average_rating: parseFloat(bookingStats?.average_rating || '0'),
        };
      }

      return {
        success: true,
        profile,
        message: `Profile loaded for ${user.name || user.phone_number}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: "An error occurred while loading your profile. Please try again.",
      };
    }
  },
};
