"use client";

import type { AdminVoucherList } from "@/lib/schemas";

interface Props extends AdminVoucherList {
  onSelect?: (voucherId: string) => void;
}

export function AdminVoucherList({
  vouchers,
  messages,
  onSelect,
}: Props) {
  return (
    <div className="space-y-4">
      {messages.length > 0 && (
        <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {messages.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
      )}
      <ul className="grid gap-3">
        {vouchers.map((voucher) => (
          <li
            key={voucher.id}
            className="rounded-md border border-border bg-card p-3 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {voucher.title}
                </p>
                {voucher.description && (
                  <p className="text-xs text-muted-foreground">
                    {voucher.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onSelect?.(voucher.id)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                View detail
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
