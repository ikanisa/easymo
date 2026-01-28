"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

interface Transaction {
  id: string;
  client_transaction_id: string | null;
  amount: number;
  provider: string;
  status: string;
  created_at: string;
  device_id: string;
  service_type: string;
}

interface TraceData {
  client_transaction_id: string;
  server_transaction_id: string;
  timeline: { timestamp: string; event: string; details: Record<string, unknown> }[];
  matched_record: { table: string; id: string; type: string } | null;
}

async function fetchTransactions(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && searchParams.set(k, String(v)));
  const res = await fetch(`/api/admin/momo-transactions?${searchParams}`);
  return res.json();
}

async function fetchTrace(id: string): Promise<TraceData> {
  const res = await fetch(`/api/admin/momo-transactions/${id}/trace`);
  return res.json();
}

export default function MomoTransactionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["momo-transactions", page, status, provider, search],
    queryFn: () => fetchTransactions({ page, per_page: 20, status: status || undefined, provider: provider || undefined, client_transaction_id: search || undefined }),
  });

  const { data: traceData, isLoading: traceLoading } = useQuery({
    queryKey: ["momo-trace", selectedTxn],
    queryFn: () => fetchTrace(selectedTxn!),
    enabled: !!selectedTxn,
  });

  const getStatusBadge = (s: string) => {
    const colors: Record<string, string> = { matched: "bg-green-100 text-green-800", pending: "bg-yellow-100 text-yellow-800", failed: "bg-red-100 text-red-800", manual_review: "bg-blue-100 text-blue-800" };
    return <Badge className={colors[s] || "bg-gray-100"}>{s}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">SMS Transactions</h1>

      <Card className="p-4">
        <div className="flex gap-4 mb-4 flex-wrap">
          <Input placeholder="Search by client_transaction_id..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="matched">Matched</option>
            <option value="manual_review">Manual Review</option>
            <option value="failed">Failed</option>
          </Select>
          <Select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="">All Providers</option>
            <option value="MTN">MTN</option>
            <option value="Airtel">Airtel</option>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Time</th>
                  <th className="text-left py-2">Client ID</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Provider</th>
                  <th className="text-left py-2">Service</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.transactions?.map((txn: Transaction) => (
                  <tr key={txn.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 text-sm">{new Date(txn.created_at).toLocaleTimeString()}</td>
                    <td className="py-3 font-mono text-xs">{txn.client_transaction_id?.slice(0, 8) || "—"}...</td>
                    <td className="py-3">{txn.amount?.toLocaleString()} RWF</td>
                    <td className="py-3">{txn.provider}</td>
                    <td className="py-3">{txn.service_type}</td>
                    <td className="py-3">{getStatusBadge(txn.status)}</td>
                    <td className="py-3">
                      <Button size="sm" variant="outline" onClick={() => setSelectedTxn(txn.id)}>View Trace</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">Total: {data?.total || 0}</div>
              <div className="flex gap-2">
                <Button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <Button disabled={!data?.transactions?.length || data.transactions.length < 20} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {selectedTxn && (
        <Modal isOpen={!!selectedTxn} onClose={() => setSelectedTxn(null)} title="Transaction Trace">
          {traceLoading ? (
            <div className="py-8 text-center">Loading trace...</div>
          ) : traceData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Server ID:</span> {traceData.server_transaction_id}</div>
                <div><span className="text-gray-500">Client ID:</span> {traceData.client_transaction_id || "—"}</div>
              </div>
              <div className="border-l-2 border-gray-200 pl-4 space-y-3">
                {traceData.timeline.map((evt, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-6 w-3 h-3 bg-blue-500 rounded-full" />
                    <div className="text-xs text-gray-500">{new Date(evt.timestamp).toLocaleString()}</div>
                    <div className="font-medium">{evt.event}</div>
                    <div className="text-sm text-gray-600">{JSON.stringify(evt.details)}</div>
                  </div>
                ))}
              </div>
              {traceData.matched_record && (
                <div className="bg-green-50 p-3 rounded">
                  <div className="font-medium text-green-800">Matched to: {traceData.matched_record.table}</div>
                  <div className="text-sm">ID: {traceData.matched_record.id}</div>
                </div>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
