'use client';

/**
 * Transactions Page
 * Full list of transactions with search and filters
 */

import { useState } from 'react';

import { PortalShell } from '@/components/vendor-portal/layout';
import { TransactionFilters, TransactionList } from '@/components/vendor-portal/transactions';
import { mockTransactions } from '@/lib/vendor-portal/mock-data';
import type { DateFilter, Transaction } from '@/lib/vendor-portal/types';

export default function TransactionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // Filter transactions based on search and date
  const filteredTransactions = mockTransactions.filter((txn) => {
    // Search filter
    const matchesSearch = 
      txn.payerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.payerPhone.includes(searchQuery);
    
    if (!matchesSearch) return false;
    
    // Date filter
    const now = new Date();
    const txnDate = new Date(txn.timestamp);
    
    switch (dateFilter) {
      case 'today': {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        return txnDate >= today;
      }
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return txnDate >= weekAgo;
      }
      case 'month': {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return txnDate >= monthAgo;
      }
      default:
        return true;
    }
  });

  const handleTransactionClick = (transaction: Transaction) => {
    // In a real app, this would open a detail sheet
    console.log('Transaction clicked:', transaction.id);
  };

  return (
    <PortalShell title="Transactions">
      <div className="space-y-4">
        <TransactionFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
        />
        
        <TransactionList
          transactions={filteredTransactions}
          onTransactionClick={handleTransactionClick}
        />
      </div>
    </PortalShell>
  );
}
