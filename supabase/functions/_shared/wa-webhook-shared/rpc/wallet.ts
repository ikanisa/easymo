import type { SupabaseClient } from "../deps.ts";

export type WalletSummary = {
  balance_minor?: number | null;
  pending_minor?: number | null;
  currency?: string | null;
  tokens?: number | null;
};

export type WalletTransaction = {
  id: string;
  amount_minor?: number | null;
  currency?: string | null;
  direction?: "credit" | "debit" | string | null;
  description?: string | null;
  occurred_at?: string | null;
};

export type WalletEarnAction = {
  id: string;
  title?: string | null;
  description?: string | null;
  reward_tokens?: number | null;
  referral_code?: string | null;
  share_text?: string | null;
};

export type WalletRedeemOption = {
  id: string;
  title?: string | null;
  description?: string | null;
  cost_tokens?: number | null;
  instructions?: string | null;
};

export type WalletPromoter = {
  display_name?: string | null;
  whatsapp?: string | null;
  tokens?: number | null;
};

export type WalletPartner = {
  id: string;
  name?: string | null;
  whatsapp_e164?: string | null;
  category?: string | null;
};

export async function fetchWalletSummary(
  client: SupabaseClient,
  profileId: string,
): Promise<WalletSummary | null> {
  const { data, error } = await client.rpc("wallet_summary", {
    _profile_id: profileId,
  });
  if (error) throw error;
  if (!data || (Array.isArray(data) && !data.length)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as WalletSummary;
}

export async function listWalletPartners(
  client: SupabaseClient,
  limit = 20,
): Promise<WalletPartner[]> {
  const { data, error } = await client.rpc("wallet_list_token_partners", {
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as WalletPartner[];
}

export async function listWalletTransactions(
  client: SupabaseClient,
  profileId: string,
  limit = 5,
): Promise<WalletTransaction[]> {
  const { data, error } = await client.rpc("wallet_transactions_recent", {
    _profile_id: profileId,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as WalletTransaction[];
}

export async function listWalletEarnActions(
  client: SupabaseClient,
  profileId: string,
  limit = 10,
): Promise<WalletEarnAction[]> {
  const { data, error } = await client.rpc("wallet_earn_actions", {
    _profile_id: profileId,
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as WalletEarnAction[];
}

export async function listWalletRedeemOptions(
  client: SupabaseClient,
  profileId: string,
): Promise<WalletRedeemOption[]> {
  const { data, error } = await client.rpc("wallet_redeem_options", {
    _profile_id: profileId,
  });
  if (error) throw error;
  return (data ?? []) as WalletRedeemOption[];
}

export async function listWalletTopPromoters(
  client: SupabaseClient,
  limit = 9,
): Promise<WalletPromoter[]> {
  const { data, error } = await client.rpc("wallet_top_promoters", {
    _limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as WalletPromoter[];
}
