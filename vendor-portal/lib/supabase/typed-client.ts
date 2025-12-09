/**
 * Typed wrappers for Supabase operations
 * 
 * This module provides type-safe wrappers around Supabase operations
 * that would otherwise require 'any' casts, maintaining type safety while
 * allowing access to admin features and non-standard table operations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

/**
 * Supabase Auth Admin API interface
 * Provides type definitions for the admin auth operations
 */
export interface SupabaseAuthAdmin {
  createUser(params: {
    email: string;
    password: string;
    email_confirm: boolean;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  }): Promise<{
    data: { user: { id: string } | null } | null;
    error: Error | null;
  }>;

  inviteUserByEmail(
    email: string,
    options?: { redirectTo?: string }
  ): Promise<{
    data: { user: { id: string } | null } | null;
    error: Error | null;
  }>;

  updateUserById(
    userId: string,
    attributes: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    }
  ): Promise<{
    data: { user: { id: string } | null } | null;
    error: Error | null;
  }>;

  deleteUser(userId: string): Promise<{
    data: { user: null } | null;
    error: Error | null;
  }>;
}

/**
 * Get typed auth admin API from Supabase client
 * 
 * @param client - Supabase client instance
 * @returns Typed auth admin interface
 */
export function getSupabaseAuthAdmin(
  client: SupabaseClient<Database>
): SupabaseAuthAdmin {
  // We know this exists at runtime, but TypeScript doesn't
  // Using a minimal any cast to maintain type safety on the return
  return (client as any).auth.admin as SupabaseAuthAdmin;
}

/**
 * Extended Supabase client with schema access
 * Allows typed access to non-public schemas
 */
export interface ExtendedSupabaseClient extends SupabaseClient<Database> {
  schema<T extends string>(
    schema: T
  ): {
    from<TableName extends string>(
      table: TableName
    ): ReturnType<SupabaseClient<Database>['from']>;
    rpc<FunctionName extends string, FunctionArgs = Record<string, unknown>>(
      fn: FunctionName,
      args?: FunctionArgs
    ): ReturnType<SupabaseClient<Database>['rpc']>;
  };
}

/**
 * Cast a Supabase client to include schema method
 * 
 * @param client - Standard Supabase client
 * @returns Client with schema access
 */
export function getExtendedClient(
  client: SupabaseClient<Database>
): ExtendedSupabaseClient {
  return client as ExtendedSupabaseClient;
}

/**
 * RPC call result type helper
 * Makes RPC call types more explicit
 */
export type RPCResult<T> = {
  data: T | null;
  error: Error | null;
};

/**
 * Make an RPC call with better type inference
 * 
 * @param client - Supabase client
 * @param functionName - RPC function name
 * @param args - Function arguments
 * @returns Promise with typed result
 */
export async function callRPC<TResult, TArgs = Record<string, unknown>>(
  client: SupabaseClient<Database>,
  functionName: string,
  args?: TArgs
): Promise<RPCResult<TResult>> {
  const result = await (client as any).rpc(functionName, args);
  return result as RPCResult<TResult>;
}
