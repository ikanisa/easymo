// ═══════════════════════════════════════════════════════════════════════════
// Payments Table Component
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { formatCurrency, formatRelativeTime, getStatusColor, cn } from "@/lib/utils";
import type { Payment } from "@/types/payment";

interface PaymentsTableProps {
  payments: Payment[];
  isLoading?: boolean;
  onPaymentClick?: (payment: Payment) => void;
}

export function PaymentsTable({ payments, isLoading, onPaymentClick }: PaymentsTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading payments...</p>
        </div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">No payments found</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Member
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Reference
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Confidence
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {payments.map((payment) => (
            <tr
              key={payment.id}
              onClick={() => onPaymentClick?.(payment)}
              className={cn(
                "hover:bg-gray-50 transition-colors",
                onPaymentClick && "cursor-pointer"
              )}
            >
              <td className="px-4 py-3 text-sm">
                <div className="font-medium">{formatRelativeTime(payment.created_at)}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(payment.created_at).toLocaleDateString()}
                </div>
              </td>
              <td className="px-4 py-3 text-sm">
                {payment.member ? (
                  <div>
                    <div className="font-medium">{payment.member.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {payment.member.member_code || "No code"}
                    </div>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Unmatched</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm font-medium">
                {formatCurrency(payment.amount, payment.currency)}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {payment.reference || "-"}
              </td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={cn(
                    "inline-flex px-2 py-1 text-xs font-medium rounded-full",
                    getStatusColor(payment.status)
                  )}
                >
                  {payment.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                {payment.confidence ? (
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={cn(
                          "h-2 rounded-full",
                          payment.confidence >= 0.9 ? "bg-green-500" :
                          payment.confidence >= 0.7 ? "bg-yellow-500" : "bg-orange-500"
                        )}
                        style={{ width: `${payment.confidence * 100}%` }}
                      ></div>
                    </div>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {(payment.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
