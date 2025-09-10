/**
 * Tokens/Wallets API Client (Frontend Only)
 * Calls existing Edge Function endpoints
 */

import { API_BASE, ADMIN_HEADERS } from "./api-constants";

async function j(res: Response) { 
  if (!res.ok) throw new Error(await res.text()); 
  return res.json(); 
}

export const TokensApi = {
  // Issue tokens via existing endpoint
  issue: (payload: {
    whatsapp: string;
    user_code: string;
    amount: number;
    allow_any_shop: boolean;
    allowed_shop_ids?: string[];
  }) =>
    fetch(`${API_BASE}/issue_tokens`, { 
      method: "POST", 
      headers: ADMIN_HEADERS(), 
      body: JSON.stringify(payload) 
    }).then(j),

  // Read operations via REST API
  listWallets: (query: { 
    q?: string; 
    status?: string; 
    limit?: number; 
    offset?: number 
  }) => {
    const params: string[] = [
      "select=*",
      "order=created_at.desc",
      `limit=${query.limit ?? 20}`,
      `offset=${query.offset ?? 0}`
    ];
    
    // Add filters
    if (query.status && query.status !== 'all') {
      params.push(`status=eq.${query.status}`);
    }
    
    return fetch(`/rest/v1/wallets?${params.join("&")}`, { 
      headers: { 
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      } 
    }).then(j);
  },

  getWallet: (id: string) =>
    fetch(`/rest/v1/wallets?id=eq.${id}&select=*`, { 
      headers: { 
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      } 
    }).then(j).then((r) => r[0]),

  getBalance: (wallet_id: string) =>
    fetch(`/rest/v1/v_wallet_balances?wallet_id=eq.${wallet_id}&select=balance`, { 
      headers: { 
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      } 
    }).then(j).then((r) => r?.[0]?.balance ?? 0),

  getBatchBalances: (wallet_ids: string[]) => {
    if (wallet_ids.length === 0) return Promise.resolve({});
    
    const filters = wallet_ids.map(id => `wallet_id.eq.${id}`).join(',');
    return fetch(`/rest/v1/v_wallet_balances?or=(${filters})&select=wallet_id,balance`, { 
      headers: { 
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      } 
    }).then(j).then((rows) => {
      const balances: Record<string, number> = {};
      rows.forEach((row: any) => {
        balances[row.wallet_id] = row.balance;
      });
      return balances;
    });
  },

  listShops: () =>
    fetch(`/rest/v1/shops?select=*&order=created_at.desc`, { 
      headers: { 
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      } 
    }).then(j),

  checkUserCodeExists: (user_code: string) =>
    fetch(`/rest/v1/wallets?user_code=eq.${encodeURIComponent(user_code)}&select=id&limit=1`, { 
      headers: { 
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      } 
    }).then(j).then((r) => r.length > 0),

  listTx: (params: { 
    wallet_id?: string; 
    merchant_id?: string; 
    from?: string; 
    to?: string; 
    limit?: number; 
    offset?: number 
  }) => {
    const q: string[] = [
      "select=*,shops(name,short_code)",
      "order=created_at.desc",
      `limit=${params.limit ?? 50}`,
      `offset=${params.offset ?? 0}`
    ];
    
    // Add filters
    if (params.wallet_id) {
      q.push(`wallet_id=eq.${params.wallet_id}`);
    }
    if (params.merchant_id) {
      q.push(`merchant_id=eq.${params.merchant_id}`);
    }
    if (params.from) {
      q.push(`created_at=gte.${params.from}`);
    }
    if (params.to) {
      q.push(`created_at=lte.${params.to}`);
    }
    
    return fetch(`/rest/v1/transactions?${q.join("&")}`, { 
      headers: { 
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json"
      } 
    }).then(j);
  },
};