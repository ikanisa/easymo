import { z } from 'zod';
import type { Tool } from '../../core/types';
import { createClient } from '@supabase/supabase-js';

const CheckBalanceSchema = z.object({
  user_id: z.string().uuid().optional(),
  phone_number: z.string().optional(),
  include_transactions: z.boolean().optional().default(false),
  transaction_limit: z.number().optional().default(5),
}).refine(
  (data) => data.user_id || data.phone_number,
  { message: 'Either user_id or phone_number must be provided' }
);

export const checkBalanceTool: Tool = {
  name: 'check_balance',
  description: 'Check the wallet balance for a user. Returns current balance and optionally recent transactions.',
  parameters: CheckBalanceSchema,
  category: 'payment',
  handler: async (args, context) => {
    const { user_id, phone_number, include_transactions, transaction_limit } = args;

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Get user if phone_number provided
      let userId = user_id;
      if (!userId && phone_number) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('phone_number', phone_number)
          .single();
        
        if (!user) {
          return {
            success: false,
            error: 'User not found',
            message: "I couldn't find an account with that phone number.",
          };
        }
        userId = user.id;
      }

      // Get wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance, currency, status')
        .eq('user_id', userId)
        .single();

      if (walletError || !wallet) {
        return {
          success: false,
          error: 'Wallet not found',
          message: "I couldn't find your wallet. Please contact support.",
        };
      }

      const response: any = {
        success: true,
        balance: wallet.balance,
        currency: wallet.currency || 'USD',
        status: wallet.status,
        formatted_balance: `${wallet.currency || 'USD'} ${parseFloat(wallet.balance).toFixed(2)}`,
        message: `Your current balance is ${wallet.currency || 'USD'} ${parseFloat(wallet.balance).toFixed(2)}`,
      };

      // Get recent transactions if requested
      if (include_transactions) {
        const { data: transactions } = await supabase
          .from('transactions')
          .select('id, type, amount, currency, status, description, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(transaction_limit);

        if (transactions) {
          response.recent_transactions = transactions.map((tx: any) => ({
            id: tx.id,
            type: tx.type,
            amount: parseFloat(tx.amount),
            currency: tx.currency,
            status: tx.status,
            description: tx.description,
            date: tx.created_at,
            formatted: `${tx.type === 'debit' ? '-' : '+'}${tx.currency} ${parseFloat(tx.amount).toFixed(2)}`,
          }));
        }
      }

      return response;
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: "I encountered an error checking your balance. Please try again.",
      };
    }
  },
};
