"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import type { TenantOption } from "@/components/admin/panel/types";
import { cn } from "@/lib/utils";

interface TenantSwitcherProps {
  options: TenantOption[];
  className?: string;
}

export function TenantSwitcher({ options, className }: TenantSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentValue = useMemo(() => {
    const fromSearch = searchParams?.get("sacco");
    if (fromSearch) return fromSearch;
    return options[0]?.id ?? "";
  }, [options, searchParams]);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const params = new URLSearchParams(searchParams ?? undefined);
    if (!value) {
      params.delete("sacco");
    } else {
      params.set("sacco", value);
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";
    router.replace(`${pathname}${query}`);
  };

  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.25em] text-neutral-2 shadow-sm shadow-black/20",
        className
      )}
    >
      <Building2 className="h-4 w-4 text-neutral-3" />
      <span className="hidden sm:inline">Tenant</span>
      <select
        value={currentValue}
        onChange={handleChange}
        className="bg-transparent text-sm font-medium tracking-normal text-neutral-0 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id} className="bg-neutral-950 text-neutral-0">
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
