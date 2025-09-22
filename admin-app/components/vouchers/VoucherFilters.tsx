'use client';

import { useState } from 'react';

interface VoucherFiltersProps {
  onChange: (filters: { status?: string; search?: string }) => void;
}

export function VoucherFilters({ onChange }: VoucherFiltersProps) {
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');

  return (
    <form className="filters" aria-label="Voucher filters" onSubmit={(event) => event.preventDefault()}>
      <label className="filters__field">
        <span>Status</span>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            onChange({ status: event.target.value || undefined, search });
          }}
        >
          <option value="">All</option>
          <option value="issued">Issued</option>
          <option value="sent">Sent</option>
          <option value="redeemed">Redeemed</option>
          <option value="expired">Expired</option>
          <option value="void">Void</option>
        </select>
      </label>
      <label className="filters__field">
        <span>Search</span>
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            onChange({ status: status || undefined, search: event.target.value || undefined });
          }}
          placeholder="Voucher ID or MSISDN"
        />
      </label>
    </form>
  );
}
