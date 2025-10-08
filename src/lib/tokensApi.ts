/**
 * Tokens/Wallets mock API client
 * Phase-1 keeps data local so the admin UI works without backend support
 */

import type {
  IssueTokensRequest,
  IssueTokensResponse,
  Shop,
  Transaction,
  Wallet,
} from "./types";

const STORAGE_KEY = "tokens_mock_state";

interface TokensState {
  wallets: Wallet[];
  transactions: Array<Transaction & { wallet_id: string }>;
  shops: Shop[];
}

let memoryState: TokensState | null = null;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function cloneState<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

const DEFAULT_STATE: TokensState = {
  shops: [
    {
      id: "shop-001",
      name: "Kimironko Supermarket",
      short_code: "SHOP-001",
      is_active: true,
      created_at: daysAgo(30),
    },
    {
      id: "shop-002",
      name: "Downtown Eatery",
      short_code: "DIN-014",
      is_active: true,
      created_at: daysAgo(21),
    },
    {
      id: "shop-003",
      name: "Nyamirambo Market",
      short_code: "NYA-221",
      is_active: false,
      created_at: daysAgo(14),
    },
  ],
  wallets: [
    {
      id: "wallet-001",
      user_code: "USER001",
      whatsapp: "+250788111111",
      status: "active",
      allow_any_shop: true,
      created_at: daysAgo(10),
    },
    {
      id: "wallet-002",
      user_code: "USER002",
      whatsapp: "+250788222222",
      status: "frozen",
      allow_any_shop: false,
      allowed_shop_ids: ["shop-001", "shop-002"],
      created_at: daysAgo(20),
    },
    {
      id: "wallet-003",
      user_code: "USER003",
      whatsapp: "+250788333333",
      status: "expired",
      allow_any_shop: false,
      allowed_shop_ids: ["shop-003"],
      created_at: daysAgo(28),
    },
  ],
  transactions: [
    {
      id: "tx-001",
      wallet_id: "wallet-001",
      type: "issue",
      amount: 5000,
      created_at: daysAgo(10),
    },
    {
      id: "tx-002",
      wallet_id: "wallet-001",
      type: "spend",
      amount: 1500,
      created_at: daysAgo(9),
      merchant_id: "shop-002",
      shops: { name: "Downtown Eatery", short_code: "DIN-014" },
    },
    {
      id: "tx-003",
      wallet_id: "wallet-001",
      type: "issue",
      amount: 3000,
      created_at: daysAgo(3),
    },
    {
      id: "tx-004",
      wallet_id: "wallet-002",
      type: "issue",
      amount: 8000,
      created_at: daysAgo(18),
    },
    {
      id: "tx-005",
      wallet_id: "wallet-002",
      type: "spend",
      amount: 2000,
      created_at: daysAgo(15),
      merchant_id: "shop-001",
      shops: { name: "Kimironko Supermarket", short_code: "SHOP-001" },
    },
    {
      id: "tx-006",
      wallet_id: "wallet-003",
      type: "issue",
      amount: 4000,
      created_at: daysAgo(25),
    },
    {
      id: "tx-007",
      wallet_id: "wallet-003",
      type: "settlement",
      amount: 4000,
      created_at: daysAgo(5),
      merchant_id: "shop-003",
    },
  ],
};

function readState(): TokensState {
  if (memoryState) {
    return cloneState(memoryState);
  }

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        memoryState = JSON.parse(raw) as TokensState;
        return cloneState(memoryState);
      }
    }
  } catch (error) {
    console.warn("TokensApi.readState_failed", error);
  }

  memoryState = cloneState(DEFAULT_STATE);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
    }
  } catch (error) {
    console.warn("TokensApi.persist_default_failed", error);
  }
  return cloneState(memoryState);
}

function writeState(state: TokensState): void {
  memoryState = cloneState(state);
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState));
    }
  } catch (error) {
    console.warn("TokensApi.writeState_failed", error);
  }
}

let sequence = 0;
function generateId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

function calculateBalance(transactions: TokensState["transactions"], walletId: string): number {
  const multiplier: Record<Transaction["type"], number> = {
    issue: 1,
    spend: -1,
    reversal: 1,
    settlement: -1,
  };

  return transactions
    .filter((tx) => tx.wallet_id === walletId)
    .reduce((total, tx) => total + tx.amount * (multiplier[tx.type] ?? 0), 0);
}

function paginate<T>(items: T[], limit?: number, offset?: number): T[] {
  if (limit === undefined && offset === undefined) {
    return items;
  }

  const start = Math.max(offset ?? 0, 0);
  const end = limit !== undefined ? start + Math.max(limit, 0) : items.length;
  return items.slice(start, end);
}

export const TokensApi = {
  async issue(payload: IssueTokensRequest): Promise<IssueTokensResponse> {
    const state = readState();
    const walletId = generateId("wallet");
    const createdAt = new Date().toISOString();

    const wallet: Wallet = {
      id: walletId,
      user_code: payload.user_code.trim().toUpperCase(),
      whatsapp: payload.whatsapp.trim(),
      status: "active",
      allow_any_shop: payload.allow_any_shop,
      allowed_shop_ids: payload.allow_any_shop ? [] : payload.allowed_shop_ids ?? [],
      created_at: createdAt,
    };

    const issueTx: Transaction & { wallet_id: string } = {
      id: generateId("tx"),
      wallet_id: walletId,
      type: "issue",
      amount: payload.amount,
      created_at: createdAt,
    };

    state.wallets = [wallet, ...state.wallets];
    state.transactions = [issueTx, ...state.transactions];
    writeState(state);

    const link = `https://wallet.example.com/claim/${walletId}`;

    return {
      ok: true,
      wallet_id: walletId,
      qr_secret: walletId,
      link,
    };
  },

  async listWallets(query: {
    q?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Wallet[]> {
    const state = readState();
    const search = query.q?.trim().toLowerCase() ?? "";
    const statusFilter = query.status && query.status !== "all" ? query.status : undefined;

    const filtered = state.wallets
      .filter((wallet) => {
        if (statusFilter && wallet.status !== statusFilter) {
          return false;
        }
        if (!search) {
          return true;
        }
        return (
          wallet.user_code.toLowerCase().includes(search) ||
          wallet.whatsapp.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return paginate(filtered, query.limit, query.offset).map((wallet) => cloneState(wallet));
  },

  async getWallet(id: string): Promise<Wallet | null> {
    const state = readState();
    const wallet = state.wallets.find((item) => item.id === id);
    return wallet ? cloneState(wallet) : null;
  },

  async getBalance(walletId: string): Promise<number> {
    const state = readState();
    return calculateBalance(state.transactions, walletId);
  },

  async getBatchBalances(walletIds: string[]): Promise<Record<string, number>> {
    const state = readState();
    const balances: Record<string, number> = {};

    walletIds.forEach((walletId) => {
      balances[walletId] = calculateBalance(state.transactions, walletId);
    });

    return balances;
  },

  async listShops(): Promise<Shop[]> {
    const state = readState();
    return state.shops.map((shop) => cloneState(shop));
  },

  async checkUserCodeExists(userCode: string): Promise<boolean> {
    const state = readState();
    return state.wallets.some((wallet) => wallet.user_code.toLowerCase() === userCode.trim().toLowerCase());
  },

  async listTx(params: {
    wallet_id?: string;
    merchant_id?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }): Promise<Transaction[]> {
    const state = readState();
    const { wallet_id, merchant_id, from, to } = params;

    const filtered = state.transactions
      .filter((tx) => {
        if (wallet_id && tx.wallet_id !== wallet_id) {
          return false;
        }
        if (merchant_id && tx.merchant_id !== merchant_id) {
          return false;
        }
        if (from && new Date(tx.created_at) < new Date(from)) {
          return false;
        }
        if (to && new Date(tx.created_at) > new Date(to)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return paginate(filtered, params.limit, params.offset).map((tx) => cloneState(tx));
  },

  async spend(walletId: string, merchantId?: string): Promise<Transaction> {
    const state = readState();
    const wallet = state.wallets.find((item) => item.id === walletId);
    if (!wallet) {
      throw new Error("wallet_not_found");
    }

    const currentBalance = calculateBalance(state.transactions, walletId);
    if (currentBalance <= 0) {
      throw new Error("insufficient_balance");
    }

    const amount = Math.min(500, currentBalance);

    const tx: Transaction & { wallet_id: string } = {
      id: generateId("tx"),
      wallet_id: walletId,
      type: "spend",
      amount,
      created_at: new Date().toISOString(),
      merchant_id: merchantId,
      shops: merchantId
        ? { name: merchantId, short_code: merchantId.slice(0, 8).toUpperCase() }
        : undefined,
    };

    state.transactions = [tx, ...state.transactions];
    writeState(state);
    return cloneState(tx);
  },

  async getTokenInfo(tokenId: string): Promise<{ ok: boolean; wallet: Wallet | null; balance: number }> {
    const wallet = await this.getWallet(tokenId);
    if (!wallet) {
      return { ok: false, wallet: null, balance: 0 };
    }
    const balance = await this.getBalance(tokenId);
    return { ok: true, wallet, balance };
  },
};

export function __resetTokensState(): void {
  memoryState = cloneState(DEFAULT_STATE);
  writeState(memoryState);
}
