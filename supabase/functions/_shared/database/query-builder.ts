/**
 * Query Builder
 * Optimized query construction with common patterns
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

// ============================================================================
// TYPES
// ============================================================================

export type QueryOptions = {
  select?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  filters?: Record<string, any>;
};

export type PaginationOptions = {
  page: number;
  pageSize: number;
};

export type QueryResult<T> = {
  data: T[] | null;
  error: Error | null;
  count?: number;
};

// ============================================================================
// QUERY BUILDER CLASS
// ============================================================================

export class QueryBuilder<T = any> {
  private supabase: SupabaseClient;
  private tableName: string;
  private selectColumns: string = "*";
  private filters: Array<{ column: string; operator: string; value: any }> = [];
  private orderByColumn: string | null = null;
  private orderDirection: "asc" | "desc" = "desc";
  private limitCount: number | null = null;
  private offsetCount: number | null = null;
  private shouldCount: boolean = false;

  constructor(supabase: SupabaseClient, tableName: string) {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  /**
   * Select specific columns
   */
  select(columns: string): this {
    this.selectColumns = columns;
    return this;
  }

  /**
   * Add equality filter
   */
  eq(column: string, value: any): this {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  /**
   * Add not equal filter
   */
  neq(column: string, value: any): this {
    this.filters.push({ column, operator: "neq", value });
    return this;
  }

  /**
   * Add greater than filter
   */
  gt(column: string, value: any): this {
    this.filters.push({ column, operator: "gt", value });
    return this;
  }

  /**
   * Add greater than or equal filter
   */
  gte(column: string, value: any): this {
    this.filters.push({ column, operator: "gte", value });
    return this;
  }

  /**
   * Add less than filter
   */
  lt(column: string, value: any): this {
    this.filters.push({ column, operator: "lt", value });
    return this;
  }

  /**
   * Add less than or equal filter
   */
  lte(column: string, value: any): this {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  /**
   * Add IN filter
   */
  in(column: string, values: any[]): this {
    this.filters.push({ column, operator: "in", value: values });
    return this;
  }

  /**
   * Add LIKE filter
   */
  like(column: string, pattern: string): this {
    this.filters.push({ column, operator: "like", value: pattern });
    return this;
  }

  /**
   * Add ILIKE filter (case insensitive)
   */
  ilike(column: string, pattern: string): this {
    this.filters.push({ column, operator: "ilike", value: pattern });
    return this;
  }

  /**
   * Add IS NULL filter
   */
  isNull(column: string): this {
    this.filters.push({ column, operator: "is", value: null });
    return this;
  }

  /**
   * Add IS NOT NULL filter
   */
  isNotNull(column: string): this {
    this.filters.push({ column, operator: "not.is", value: null });
    return this;
  }

  /**
   * Set order by
   */
  orderBy(column: string, direction: "asc" | "desc" = "desc"): this {
    this.orderByColumn = column;
    this.orderDirection = direction;
    return this;
  }

  /**
   * Set limit
   */
  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  /**
   * Set offset
   */
  offset(count: number): this {
    this.offsetCount = count;
    return this;
  }

  /**
   * Enable count
   */
  withCount(): this {
    this.shouldCount = true;
    return this;
  }

  /**
   * Apply pagination
   */
  paginate(options: PaginationOptions): this {
    this.limitCount = options.pageSize;
    this.offsetCount = (options.page - 1) * options.pageSize;
    this.shouldCount = true;
    return this;
  }

  /**
   * Execute query
   */
  async execute(): Promise<QueryResult<T>> {
    let query = this.supabase
      .from(this.tableName)
      .select(this.selectColumns, { count: this.shouldCount ? "exact" : undefined });

    // Apply filters
    for (const filter of this.filters) {
      switch (filter.operator) {
        case "eq":
          query = query.eq(filter.column, filter.value);
          break;
        case "neq":
          query = query.neq(filter.column, filter.value);
          break;
        case "gt":
          query = query.gt(filter.column, filter.value);
          break;
        case "gte":
          query = query.gte(filter.column, filter.value);
          break;
        case "lt":
          query = query.lt(filter.column, filter.value);
          break;
        case "lte":
          query = query.lte(filter.column, filter.value);
          break;
        case "in":
          query = query.in(filter.column, filter.value);
          break;
        case "like":
          query = query.like(filter.column, filter.value);
          break;
        case "ilike":
          query = query.ilike(filter.column, filter.value);
          break;
        case "is":
          query = query.is(filter.column, filter.value);
          break;
        case "not.is":
          query = query.not(filter.column, "is", filter.value);
          break;
      }
    }

    // Apply ordering
    if (this.orderByColumn) {
      query = query.order(this.orderByColumn, { ascending: this.orderDirection === "asc" });
    }

    // Apply limit and offset
    if (this.limitCount !== null) {
      query = query.limit(this.limitCount);
    }

    if (this.offsetCount !== null) {
      query = query.range(this.offsetCount, this.offsetCount + (this.limitCount || 10) - 1);
    }

    const { data, error, count } = await query;

    return {
      data: data as T[] | null,
      error: error ? new Error(error.message) : null,
      count: count ?? undefined,
    };
  }

  /**
   * Execute and get single result
   */
  async single(): Promise<{ data: T | null; error: Error | null }> {
    const result = await this.limit(1).execute();
    return {
      data: result.data?.[0] ?? null,
      error: result.error,
    };
  }
}

/**
 * Create query builder for table
 */
export function query<T = any>(supabase: SupabaseClient, tableName: string): QueryBuilder<T> {
  return new QueryBuilder<T>(supabase, tableName);
}
