"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Transaction {
  id: string;
  amount: number;
  provider: string;
  status: string;
  created_at: string;
  sender_name: string | null;
}

interface Summary {
  received: number;
  sent: number;
  pending: number;
  total: number;
}

async function fetchTransactions(page: number) {
  const res = await fetch(`/api/merchant/transactions?page=${page}&per_page=20`);
  return res.json();
}

export default function MerchantTransactionsPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["merchant-transactions", page],
    queryFn: () => fetchTransactions(page),
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("merchant-momo-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "momo_transactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["merchant-transactions"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Calculate today's summary
  const todaySummary: Summary = (data?.transactions || []).reduce(
    (acc: Summary, txn: Transaction) => {
      const isToday = new Date(txn.created_at).toDateString() === new Date().toDateString();
      if (!isToday) return acc;
      if (txn.status === "pending") acc.pending += txn.amount || 0;
      else acc.received += txn.amount || 0;
      acc.total += txn.amount || 0;
      return acc;
    },
    { received: 0, sent: 0, pending: 0, total: 0 }
  );

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = { matched: "🟢", pending: "⏳", failed: "❌", manual_review: "🟡" };
    return icons[status] || "⚪";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">My Transactions</h1>
        <Button onClick={() => window.location.href = "/api/merchant/transactions/export"}>Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-green-50">
          <div className="text-sm text-gray-600">Received</div>
          <div className="text-2xl font-bold text-green-700">RWF {todaySummary.received.toLocaleString()}</div>
        </Card>
        <Card className="p-4 bg-blue-50">
          <div className="text-sm text-gray-600">Sent</div>
          <div className="text-2xl font-bold text-blue-700">RWF {todaySummary.sent.toLocaleString()}</div>
        </Card>
        <Card className="p-4 bg-yellow-50">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-2xl font-bold text-yellow-700">RWF {todaySummary.pending.toLocaleString()}</div>
        </Card>
        <Card className="p-4 bg-gray-50">
          <div className="text-sm text-gray-600">Total</div>
          <div className="text-2xl font-bold">RWF {todaySummary.total.toLocaleString()}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Recent Transactions</h2>
          <Badge className="bg-red-500 text-white animate-pulse">🔴 Live</Badge>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            <div className="space-y-3">
              {data?.transactions?.map((txn: Transaction) => (
                <div key={txn.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getStatusIcon(txn.status)}</span>
                    <div>
                      <div className="font-medium">+{txn.amount?.toLocaleString()} RWF</div>
                      <div className="text-sm text-gray-500">
                        From: {txn.sender_name || "Unknown"} • {txn.provider}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{new Date(txn.created_at).toLocaleTimeString()}</div>
                    <div className="text-xs text-gray-500">{new Date(txn.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center mt-4">
              <Button variant="outline" disabled={!data?.transactions?.length || data.transactions.length < 20} onClick={() => setPage(page + 1)}>
                Load More
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
