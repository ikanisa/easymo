import styles from "./IbiminaRegistryTable.module.css";
import type { SaccoRow } from "@/lib/baskets/baskets-service";

export type IbiminaFiltersState = {
  status: "all" | "pending" | "active" | "suspended";
  saccoId: string;
  search: string;
};

type IbiminaFiltersProps = {
  filters: IbiminaFiltersState;
  saccoOptions: SaccoRow[];
  onChange: (next: IbiminaFiltersState) => void;
};

export function IbiminaFilters({
  filters,
  saccoOptions,
  onChange,
}: IbiminaFiltersProps) {
  const updateFilters = <K extends keyof IbiminaFiltersState>(
    key: K,
    value: IbiminaFiltersState[K],
  ) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className={styles.filtersRow}>
      <label>
        <span>Status</span>
        <select
          value={filters.status}
          onChange={(event) =>
            updateFilters("status", event.target.value as IbiminaFiltersState["status"])}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </label>
      <label>
        <span>SACCO</span>
        <select
          value={filters.saccoId}
          onChange={(event) => updateFilters("saccoId", event.target.value)}
        >
          <option value="">All</option>
          {saccoOptions.map((sacco) => (
            <option key={sacco.id} value={sacco.id}>
              {sacco.name}
              {sacco.branchCode ? ` (${sacco.branchCode})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.searchField}>
        <span>Search</span>
        <input
          value={filters.search}
          onChange={(event) => updateFilters("search", event.target.value)}
          placeholder="Name or slug"
        />
      </label>
    </div>
  );
}
