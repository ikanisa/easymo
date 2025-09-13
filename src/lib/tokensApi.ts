/**
 * Tokens/Wallets API Client (Frontend Only)
 * Calls existing Edge Function endpoints
 */

import { API_BASE, ADMIN_HEADERS } from "./api-constants";
import { supabase } from "@/integrations/supabase/client";

async function j(res: Response) { 
  if (!res.ok) throw new Error(await res.text()); 
  return res.json(); 
}

export const TokensApi = {
  // Issue tokens via existing endpoint - correct function name
  issue: async (payload: {
    whatsapp: string;
    user_code: string;
    amount: number;
    allow_any_shop: boolean;
    allowed_shop_ids?: string[];
  }) => {
    const { data, error } = await supabase.functions.invoke('issue_token', {
      body: {
        amount: payload.amount,
        currency: 'RWF',
        memo: `Token for ${payload.user_code}`
      }
    });
    
    if (error) throw new Error(error.message);
    
    // Return properly formatted response
    return {
      wallet_id: data.token_id,
      token_id: data.token_id,
      qr_secret: data.token_id,
      link: data.claim_url || `https://wallet.example.com/claim?token_id=${data.token_id}`,
      ...data
    };
  },

  // Use qr_info edge function to get token information (simulates wallet list)
  listWallets: async (query: { 
    q?: string; 
    status?: string; 
    limit?: number; 
    offset?: number 
  }) => {
    // Since there's no wallets table, return empty array
    // Real implementation would query actual wallet database
    console.warn("TokensApi.listWallets: No wallet database - use tokens via qr_info");
    return [];
  },

  getWallet: async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('qr_info', {
        body: { token_id: id }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("TokensApi.getWallet error:", error);
      return null;
    }
  },

  getBalance: async (wallet_id: string) => {
    try {
      const wallet = await TokensApi.getWallet(wallet_id);
      return wallet?.amount || 0;
    } catch (error) {
      console.error("TokensApi.getBalance error:", error);
      return 0;
    }
  },

  getBatchBalances: async (wallet_ids: string[]) => {
    const balances: Record<string, number> = {};
    
    // Get balances for each wallet (in real app, this would be a batch API)
    await Promise.all(
      wallet_ids.map(async (id) => {
        try {
          const balance = await TokensApi.getBalance(id);
          balances[id] = balance;
        } catch (error) {
          console.error(`Failed to get balance for ${id}:`, error);
          balances[id] = 0;
        }
      })
    );
    
    return balances;
  },

  listShops: async () => {
    const { data, error } = await (supabase as any)
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  checkUserCodeExists: async (user_code: string) => {
    // Since no user_codes table exists, always return false
    console.warn("TokensApi.checkUserCodeExists: No user_codes table - allowing all codes");
    return false;
  },

  listTx: async (params: { 
    wallet_id?: string; 
    merchant_id?: string; 
    from?: string; 
    to?: string; 
    limit?: number; 
    offset?: number 
  }) => {
    // No transactions table in current schema - return empty
    console.warn("TokensApi.listTx: No transactions table in current schema");
    return [];
  },

  // Spend token using spend edge function
  spend: async (token_id: string, spent_by?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('spend', {
        body: { 
          token_id,
          by: spent_by 
        }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("TokensApi.spend error:", error);
      throw error;
    }
  },

  // Get token info using qr_info edge function  
  getTokenInfo: async (token_id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('qr_info', {
        body: { token_id }
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error("TokensApi.getTokenInfo error:", error);
      throw error;
    }
  },
};