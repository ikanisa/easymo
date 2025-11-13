import { z } from 'zod';
import type { Tool } from '../../core/types';
import { createClient } from '@supabase/supabase-js';

const SendMoneySchema = z.object({
  from_user_id: z.string().uuid(),
  to_phone_number: z.string().min(10),
  amount: z.number().positive(),
  currency: z.string().optional().default('USD'),
  description: z.string().optional(),
  pin: z.string().optional(), // For verification
});

export const sendMoneyTool: Tool = {
  name: 'send_money',
  description: 'Send money from one user to another via phone number. Requires PIN verification.',
  parameters: SendMoneySchema,
  category: 'payment',
  requiresAuth: true,
  handler: async (args, context) => {
    const { from_user_id, to_phone_number, amount, currency, description, pin } = args;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // 1. Find recipient by phone number
      const { data: recipient, error: recipientError } = await supabase
        .from('users')
        .select('id, phone_number, name')
        .eq('phone_number', to_phone_number)
        .single();

      if (recipientError || !recipient) {
        return {
          success: false,
          error: 'Recipient not found',
          message: `I couldn't find a user with phone number ${to_phone_number}. Please verify the number.`,
        };
      }

      // 2. Check sender's balance
      const { data: senderWallet } = await supabase
        .from('wallets')
        .select('balance, currency, status')
        .eq('user_id', from_user_id)
        .single();

      if (!senderWallet || senderWallet.status !== 'active') {
        return {
          success: false,
          error: 'Wallet not active',
          message: "Your wallet is not active. Please contact support.",
        };
      }

      const senderBalance = parseFloat(senderWallet.balance);
      if (senderBalance < amount) {
        return {
          success: false,
          error: 'Insufficient balance',
          message: `Insufficient balance. You have ${currency} ${senderBalance.toFixed(2)} but need ${currency} ${amount.toFixed(2)}.`,
          current_balance: senderBalance,
          required_amount: amount,
        };
      }

      // 3. Verify PIN (if provided)
      if (pin) {
        const { data: userAuth } = await supabase
          .from('user_security')
          .select('transaction_pin')
          .eq('user_id', from_user_id)
          .single();

        // Simple PIN check (in production, use bcrypt/hash)
        if (!userAuth || userAuth.transaction_pin !== pin) {
          return {
            success: false,
            error: 'Invalid PIN',
            message: "The PIN you entered is incorrect. Please try again.",
          };
        }
      } else {
        // PIN required but not provided
        return {
          success: false,
          error: 'PIN required',
          message: "Please provide your transaction PIN to complete this transfer.",
          requires_pin: true,
        };
      }

      // 4. Create transaction record
      const transactionId = crypto.randomUUID();
      
      const { error: txError } = await supabase.rpc('process_transfer', {
        p_transaction_id: transactionId,
        p_from_user_id: from_user_id,
        p_to_user_id: recipient.id,
        p_amount: amount,
        p_currency: currency,
        p_description: description || `Transfer to ${recipient.name || to_phone_number}`,
      });

      if (txError) {
        return {
          success: false,
          error: txError.message,
          message: "The transfer failed. Please try again or contact support.",
        };
      }

      // 5. Get updated balance
      const { data: updatedWallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', from_user_id)
        .single();

      return {
        success: true,
        transaction_id: transactionId,
        amount,
        currency,
        recipient: {
          phone_number: to_phone_number,
          name: recipient.name,
        },
        new_balance: parseFloat(updatedWallet?.balance || '0'),
        message: `Successfully sent ${currency} ${amount.toFixed(2)} to ${recipient.name || to_phone_number}. Your new balance is ${currency} ${parseFloat(updatedWallet?.balance || '0').toFixed(2)}.`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: "An error occurred while processing your transfer. Please try again.",
      };
    }
  },
};
