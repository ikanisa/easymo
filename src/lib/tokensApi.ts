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
  // Issue tokens via existing endpoint
  issue: async (payload: {
    whatsapp: string;
    user_code: string;
    amount: number;
    allow_any_shop: boolean;
    allowed_shop_ids?: string[];
  }) => {
    const { data, error } = await supabase.functions.invoke('issue_tokens', {
      body: payload,
      headers: {
        'x-admin-token': (function getAdminToken(): string {
          return import.meta.env.VITE_ADMIN_TOKEN || 
                 localStorage.getItem('admin_token') || 
                 '';
        })(),
      }
    });
    
    if (error) throw new Error(error.message);
    
    // Generate QR link from qr_secret if not provided
    if (data?.qr_secret && !data?.link) {
      data.link = `https://example.com/qr?secret=${data.qr_secret}`;
    }
    
    return data;
  },

  // Mock implementation - wallets table doesn't exist yet
  listWallets: async (query: { 
    q?: string; 
    status?: string; 
    limit?: number; 
    offset?: number 
  }) => {
    // Return mock data since wallets table doesn't exist
    console.warn("TokensApi.listWallets: Using mock data - wallets table not found");
    return [];
  },

  getWallet: async (id: string) => {
    console.warn("TokensApi.getWallet: Using mock data - wallets table not found");
    return null;
  },

  getBalance: async (wallet_id: string) => {
    console.warn("TokensApi.getBalance: Using mock data - wallet balances table not found");
    return 0;
  },

  getBatchBalances: async (wallet_ids: string[]) => {
    console.warn("TokensApi.getBatchBalances: Using mock data - wallet balances table not found");
    const balances: Record<string, number> = {};
    wallet_ids.forEach(id => {
      balances[id] = 0;
    });
    return balances;
  },

  listShops: () =>
    fetch(`https://ezrriefbmhiiqfoxgjgz.supabase.co/rest/v1/shops?select=*&order=created_at.desc`, { 
      headers: { 
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      } 
    }).then(j),

  checkUserCodeExists: async (user_code: string) => {
    console.warn("TokensApi.checkUserCodeExists: Using mock data - wallets table not found");
    return false; // Always return false since we can't check
  },

  listTx: async (params: { 
    wallet_id?: string; 
    merchant_id?: string; 
    from?: string; 
    to?: string; 
    limit?: number; 
    offset?: number 
  }) => {
    console.warn("TokensApi.listTx: Using mock data - transactions table not found");
    return [];
  },
};