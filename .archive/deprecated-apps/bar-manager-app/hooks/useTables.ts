import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'dirty' | 'blocked';

export interface Table {
  id: string;
  table_number: string;
  capacity: number;
  status: TableStatus;
  section?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  shape?: 'rectangle' | 'circle' | 'square';
  current_order_id?: string;
  server_id?: string;
  created_at: string;
  updated_at: string;
}

export function useTables() {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchTables = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('table_number');

      if (error) throw error;

      setTables(data || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
      setIsLoading(false);
    }
  }, [supabase]);

  const updateTable = useCallback(async (tableId: string, updates: Partial<Table>) => {
    try {
      const { error } = await supabase
        .from('tables')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', tableId);

      if (error) throw error;

      setTables(prev => prev.map(table => 
        table.id === tableId ? { ...table, ...updates } : table
      ));
    } catch (error) {
      console.error('Failed to update table:', error);
      throw error;
    }
  }, [supabase]);

  const createTable = useCallback(async (tableData: Omit<Table, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('tables')
        .insert([tableData])
        .select()
        .single();

      if (error) throw error;

      setTables(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Failed to create table:', error);
      throw error;
    }
  }, [supabase]);

  const deleteTable = useCallback(async (tableId: string) => {
    try {
      const { error } = await supabase
        .from('tables')
        .delete()
        .eq('id', tableId);

      if (error) throw error;

      setTables(prev => prev.filter(table => table.id !== tableId));
    } catch (error) {
      console.error('Failed to delete table:', error);
      throw error;
    }
  }, [supabase]);

  useEffect(() => {
    fetchTables();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('tables')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tables',
      }, () => {
        fetchTables();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchTables, supabase]);

  return {
    tables,
    isLoading,
    refetch: fetchTables,
    updateTable,
    createTable,
    deleteTable,
  };
}
