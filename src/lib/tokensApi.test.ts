import { beforeEach, describe, expect, it } from 'vitest';
import { TokensApi, __resetTokensState } from './tokensApi';

beforeEach(() => {
  window.localStorage.clear();
  __resetTokensState();
});

describe('TokensApi mock implementation', () => {
  it('returns seeded wallets and filters by status', async () => {
    const allWallets = await TokensApi.listWallets({});
    expect(allWallets.length).toBeGreaterThan(0);

    const activeWallets = await TokensApi.listWallets({ status: 'active' });
    expect(activeWallets.every((wallet) => wallet.status === 'active')).toBe(true);
  });

  it('computes balances based on mock transactions', async () => {
    const balance = await TokensApi.getBalance('wallet-001');
    expect(balance).toBe(6500);

    const balances = await TokensApi.getBatchBalances(['wallet-001', 'wallet-002']);
    expect(balances['wallet-001']).toBe(6500);
    expect(balances['wallet-002']).toBe(6000);
  });

  it('filters transactions by merchant id', async () => {
    const transactions = await TokensApi.listTx({ merchant_id: 'shop-001' });
    expect(transactions.length).toBeGreaterThan(0);
    expect(transactions.every((tx) => tx.merchant_id === 'shop-001')).toBe(true);
  });

  it('issues new wallet tokens and persists them', async () => {
    const startWallets = await TokensApi.listWallets({});

    const response = await TokensApi.issue({
      whatsapp: '+250788444444',
      user_code: 'NEW01',
      amount: 2500,
      allow_any_shop: false,
      allowed_shop_ids: ['shop-001'],
    });

    expect(response.ok).toBe(true);
    expect(response.wallet_id).toBeTruthy();

    const endWallets = await TokensApi.listWallets({});
    expect(endWallets.length).toBe(startWallets.length + 1);

    const wallet = await TokensApi.getWallet(response.wallet_id);
    expect(wallet?.user_code).toBe('NEW01');

    const balance = await TokensApi.getBalance(response.wallet_id);
    expect(balance).toBe(2500);
  });

  it('never allows spend transactions to exceed current balance', async () => {
    const { wallet_id } = await TokensApi.issue({
      whatsapp: '+250788555555',
      user_code: 'BALTEST',
      amount: 300,
      allow_any_shop: true,
    });

    const spend = await TokensApi.spend(wallet_id, 'shop-002');
    expect(spend.amount).toBe(300);

    const remaining = await TokensApi.getBalance(wallet_id);
    expect(remaining).toBe(0);
  });
});
