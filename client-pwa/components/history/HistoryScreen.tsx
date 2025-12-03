'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  History,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { createClient } from '@/lib/supabase/client';
import { logStructuredEvent } from '@/lib/observability';

/**
 * Transaction History Screen
 * 
 * Refactored per requirements:
 * - Clean data fetching and state management
 * - Proper pagination/loading states
 * - No hardcoded data - all from Supabase
 */

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'payment';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  recipientName?: string;
  recipientPhone?: string;
  createdAt: string;
}

interface HistoryScreenProps {
  userId: string;
  currencySymbol?: string;
}

const PAGE_SIZE = 20;

export function HistoryScreen({ userId, currencySymbol = '' }: HistoryScreenProps) {
  const { trigger } = useHaptics();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const supabase = createClient();

  // Fetch transactions from Supabase
  const fetchTransactions = useCallback(
    async (pageNum: number, isRefresh = false) => {
      try {
        if (isRefresh) {
          setIsLoading(true);
        } else if (pageNum > 0) {
          setIsLoadingMore(true);
        }
        setError(null);

        const from = pageNum * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error: fetchError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (fetchError) {
          throw fetchError;
        }

        const mappedData: Transaction[] = (data ?? []).map((row) => ({
          id: row.id,
          type: row.type as 'send' | 'receive' | 'payment',
          amount: row.amount,
          currency: row.currency,
          status: row.status as 'pending' | 'completed' | 'failed',
          description: row.description || '',
          recipientName: row.recipient_name,
          recipientPhone: row.recipient_phone,
          createdAt: row.created_at,
        }));

        if (isRefresh) {
          setTransactions(mappedData);
        } else {
          setTransactions((prev) => [...prev, ...mappedData]);
        }

        setHasMore(mappedData.length === PAGE_SIZE);
        setPage(pageNum);

        await logStructuredEvent('HISTORY_FETCHED', {
          userId,
          page: pageNum,
          count: mappedData.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load transactions';
        setError(message);
        await logStructuredEvent('HISTORY_FETCH_ERROR', { userId, error: message });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [supabase, userId]
  );

  // Initial fetch
  useEffect(() => {
    fetchTransactions(0, true);
  }, [fetchTransactions]);

  const handleRefresh = useCallback(() => {
    trigger('light');
    fetchTransactions(0, true);
  }, [fetchTransactions, trigger]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      trigger('light');
      fetchTransactions(page + 1);
    }
  }, [fetchTransactions, hasMore, isLoadingMore, page, trigger]);

  // Group transactions by date
  const groupedTransactions = transactions.reduce<Record<string, Transaction[]>>(
    (groups, transaction) => {
      const date = new Date(transaction.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(transaction);
      return groups;
    },
    {}
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Transaction History</h1>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={isLoading}
          className="p-2 rounded-full hover:bg-accent"
        >
          <RefreshCw
            className={cn('w-5 h-5', isLoading && 'animate-spin')}
          />
        </motion.button>
      </div>

      {/* Content */}
      <div className="px-4 pb-8">
        {isLoading && transactions.length === 0 ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRefresh} />
        ) : transactions.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Transaction Groups */}
            <div className="space-y-6">
              {Object.entries(groupedTransactions).map(([date, items]) => (
                <div key={date}>
                  <h2 className="text-sm font-medium text-muted-foreground mb-3 px-2">
                    {date}
                  </h2>
                  <div className="bg-card rounded-2xl border border-border overflow-hidden">
                    {items.map((transaction, index) => (
                      <TransactionItem
                        key={transaction.id}
                        transaction={transaction}
                        currencySymbol={currencySymbol}
                        isLast={index === items.length - 1}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className={cn(
                    'px-6 py-3 rounded-full',
                    'bg-accent hover:bg-accent/80 transition-colors',
                    'font-medium flex items-center gap-2'
                  )}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TransactionItemProps {
  transaction: Transaction;
  currencySymbol: string;
  isLast: boolean;
}

function TransactionItem({ transaction, currencySymbol, isLast }: TransactionItemProps) {
  const isOutgoing = transaction.type === 'send' || transaction.type === 'payment';

  const statusConfig = {
    pending: {
      icon: <Clock className="w-4 h-4" />,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
    completed: {
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    failed: {
      icon: <XCircle className="w-4 h-4" />,
      color: 'text-red-600',
      bg: 'bg-red-100',
    },
  };

  const config = statusConfig[transaction.status];

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4',
        !isLast && 'border-b border-border'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          isOutgoing ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
        )}
      >
        {isOutgoing ? (
          <ArrowUpRight className="w-5 h-5" />
        ) : (
          <ArrowDownLeft className="w-5 h-5" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {transaction.recipientName || transaction.description || transaction.type}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
              config.bg,
              config.color
            )}
          >
            {config.icon}
            {transaction.status}
          </span>
          <span className="text-muted-foreground">
            {new Date(transaction.createdAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p
          className={cn(
            'font-semibold tabular-nums',
            isOutgoing ? 'text-red-600' : 'text-green-600'
          )}
        >
          {isOutgoing ? '-' : '+'}
          {currencySymbol}
          {transaction.amount.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">{transaction.currency}</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Loading transactions...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
        <History className="w-8 h-8 text-muted-foreground" />
      </div>
      <p className="font-medium mb-1">No transactions yet</p>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Your transaction history will appear here once you make your first payment or
        transfer.
      </p>
    </div>
  );
}

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <XCircle className="w-8 h-8 text-destructive" />
      </div>
      <p className="font-medium mb-1">Failed to load</p>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
        {error}
      </p>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={onRetry}
        className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-medium"
      >
        Try Again
      </motion.button>
    </div>
  );
}
