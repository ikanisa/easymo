# Wallet Service Test Implementation Guide

## Overview
This guide provides templates and instructions for implementing comprehensive tests for the wallet service to achieve 95%+ coverage.

## Setup Instructions

1. **Install Test Dependencies**
```bash
cd services/wallet-service
pnpm add -D vitest @vitest/coverage-v8 @types/node
```

2. **Create Test Directory Structure**
```bash
mkdir -p src/__tests__
mkdir -p src/__tests__/fixtures
```

3. **Create Vitest Configuration**

Create `vitest.config.ts` in `services/wallet-service/`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/**/index.ts',
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'src/transfer/**': {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        'src/balance/**': {
          statements: 90,
          branches: 90,
          functions: 90,
          lines: 90,
        },
      },
    },
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

4. **Create Test Setup File**

Create `src/__tests__/setup.ts`:

```typescript
import { beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Clean database before tests
  await prisma.$transaction([
    prisma.walletEntry.deleteMany({}),
    prisma.walletTransaction.deleteMany({}),
    prisma.walletAccount.deleteMany({}),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

5. **Add NPM Scripts**

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

## Test Files to Create

### 1. Transfer Operations (`src/__tests__/transfer.test.ts`)

See the complete test template at the bottom of this file.

**Coverage Goals**:
- Successful transfers with double-entry bookkeeping
- Idempotency verification
- Insufficient funds rejection
- Invalid amount rejection (negative, zero)
- Same account rejection
- Non-existent account handling
- Concurrent transfer handling
- Race condition prevention
- Transaction atomicity
- Audit trail creation

**Expected Coverage**: 95%+

### 2. Balance Operations (`src/__tests__/balance.test.ts`)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { WalletService } from '../wallet.service';

describe('WalletService - Balance Operations', () => {
  // Test getBalance()
  // Test calculateAvailableBalance()
  // Test balance history
  // Test balance with pending transactions
  // Test multi-currency balances
});
```

**Expected Coverage**: 90%+

### 3. Reconciliation (`src/__tests__/reconciliation.test.ts`)

```typescript
import { describe, it, expect } from 'vitest';

describe('WalletService - Reconciliation', () => {
  // Test double-entry balance verification
  // Test detecting orphaned entries
  // Test balance mismatch detection
  // Test reconciliation reports
});
```

**Expected Coverage**: 90%+

## Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# With UI
pnpm test:ui
```

## Coverage Requirements

| Module | Target | Priority |
|--------|--------|----------|
| src/transfer/ | 95% | P0 |
| src/balance/ | 90% | P0 |
| src/reconciliation/ | 90% | P0 |
| src/webhooks/ | 85% | P1 |

## CI Integration

The tests will be automatically run in CI via the root `package.json`:

```json
{
  "scripts": {
    "test:ci": "... && pnpm --filter @easymo/wallet-service test -- --coverage --runInBand"
  }
}
```

## Complete Transfer Test Template

\`\`\`typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WalletService } from '../wallet.service';
import { PrismaClient } from '@prisma/client';

describe('WalletService - Transfer Operations', () => {
  let walletService: WalletService;
  let prisma: PrismaClient;
  
  beforeEach(async () => {
    prisma = new PrismaClient();
    walletService = new WalletService(prisma);
    
    await prisma.walletAccount.createMany({
      data: [
        { id: 'source-account', userId: 'user-1', balance: 10000, currency: 'RWF' },
        { id: 'dest-account', userId: 'user-2', balance: 5000, currency: 'RWF' },
      ],
    });
  });
  
  afterEach(async () => {
    await prisma.walletEntry.deleteMany({});
    await prisma.walletTransaction.deleteMany({});
    await prisma.walletAccount.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Successful Transfers', () => {
    it('should transfer funds with double-entry bookkeeping', async () => {
      const result = await walletService.transfer({
        sourceAccountId: 'source-account',
        destinationAccountId: 'dest-account',
        amount: 1000,
        currency: 'RWF',
        idempotencyKey: 'test-transfer-1',
      });
      
      expect(result.transaction).toBeDefined();
      expect(result.entries).toHaveLength(2);
      
      const debitEntry = result.entries.find(e => e.type === 'DEBIT');
      expect(debitEntry?.amount).toBe(-1000);
      
      const creditEntry = result.entries.find(e => e.type === 'CREDIT');
      expect(creditEntry?.amount).toBe(1000);
      
      const sourceAccount = await prisma.walletAccount.findUnique({
        where: { id: 'source-account' },
      });
      expect(sourceAccount?.balance).toBe(9000);
    });

    it('should be idempotent', async () => {
      const key = 'idempotent-test-1';
      
      const result1 = await walletService.transfer({
        sourceAccountId: 'source-account',
        destinationAccountId: 'dest-account',
        amount: 500,
        currency: 'RWF',
        idempotencyKey: key,
      });
      
      const result2 = await walletService.transfer({
        sourceAccountId: 'source-account',
        destinationAccountId: 'dest-account',
        amount: 500,
        currency: 'RWF',
        idempotencyKey: key,
      });
      
      expect(result1.transaction.id).toBe(result2.transaction.id);
      
      const sourceAccount = await prisma.walletAccount.findUnique({
        where: { id: 'source-account' },
      });
      expect(sourceAccount?.balance).toBe(9500);
    });
  });

  describe('Error Handling', () => {
    it('should prevent overdraft', async () => {
      await expect(
        walletService.transfer({
          sourceAccountId: 'source-account',
          destinationAccountId: 'dest-account',
          amount: 999999,
          currency: 'RWF',
          idempotencyKey: 'overdraft-test',
        })
      ).rejects.toThrow('Insufficient funds');
    });

    it('should reject negative amounts', async () => {
      await expect(
        walletService.transfer({
          sourceAccountId: 'source-account',
          destinationAccountId: 'dest-account',
          amount: -100,
          currency: 'RWF',
          idempotencyKey: 'negative-test',
        })
      ).rejects.toThrow('Amount must be positive');
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent transfers', async () => {
      const transfers = Array(10).fill(null).map((_, i) =>
        walletService.transfer({
          sourceAccountId: 'source-account',
          destinationAccountId: 'dest-account',
          amount: 100,
          currency: 'RWF',
          idempotencyKey: `concurrent-${i}`,
        })
      );
      
      const results = await Promise.allSettled(transfers);
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(10);
      
      const account = await prisma.walletAccount.findUnique({
        where: { id: 'source-account' },
      });
      expect(account?.balance).toBe(9000);
    });

    it('should prevent race condition overdrafts', async () => {
      await prisma.walletAccount.update({
        where: { id: 'source-account' },
        data: { balance: 500 },
      });
      
      const transfers = Array(10).fill(null).map((_, i) =>
        walletService.transfer({
          sourceAccountId: 'source-account',
          destinationAccountId: 'dest-account',
          amount: 100,
          currency: 'RWF',
          idempotencyKey: `race-${i}`,
        })
      );
      
      const results = await Promise.allSettled(transfers);
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(5);
      
      const account = await prisma.walletAccount.findUnique({
        where: { id: 'source-account' },
      });
      expect(account?.balance).toBe(0);
    });
  });
});
\`\`\`

## Troubleshooting

### Database Connection Issues
If tests fail with database connection errors, ensure:
1. `DATABASE_URL` is set in `.env.test`
2. Database is running and accessible
3. Migrations have been applied

### Coverage Not Meeting Thresholds
1. Run `pnpm test:coverage` to see detailed report
2. Check `coverage/index.html` for visual coverage report
3. Focus on untested branches and edge cases

## Next Steps

1. Create the test files following the templates above
2. Run tests locally: `pnpm test:coverage`
3. Verify coverage meets thresholds (95%+ for transfer, 90%+ for balance)
4. Commit tests and verify CI passes
5. Deploy to production with confidence
