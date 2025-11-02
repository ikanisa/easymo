export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface AppDatabase {
  public: {
    Tables: {
      favorites: {
        Row: {
          id: string;
          user_id: string;
          driver_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          driver_id: string;
          created_at?: string;
        };
        Update: Partial<AppDatabase["public"]["Tables"]["favorites"]["Insert"]>;
        Relationships: [];
      };
      drivers: {
        Row: {
          id: string;
          name: string;
          rating: number;
          vehicle: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          rating: number;
          vehicle: string;
          updated_at?: string;
        };
        Update: Partial<AppDatabase["public"]["Tables"]["drivers"]["Insert"]>;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          rider_id: string;
          driver_id: string;
          pickup_time: string;
          status: "pending" | "confirmed" | "cancelled";
        };
        Insert: {
          id?: string;
          rider_id: string;
          driver_id: string;
          pickup_time: string;
          status?: "pending" | "confirmed" | "cancelled";
        };
        Update: Partial<AppDatabase["public"]["Tables"]["matches"]["Insert"]>;
        Relationships: [];
      };
      deeplinks: {
        Row: {
          id: string;
          target: string;
          url: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          target: string;
          url: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<AppDatabase["public"]["Tables"]["deeplinks"]["Insert"]>;
        Relationships: [];
      };
      broker_messages: {
        Row: {
          id: string;
          topic: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic: string;
          payload: Json;
          created_at?: string;
        };
        Update: Partial<AppDatabase["public"]["Tables"]["broker_messages"]["Insert"]>;
        Relationships: [];
      };
      admin_audit: {
        Row: {
          id: string;
          actor: string;
          action: string;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor: string;
          action: string;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<AppDatabase["public"]["Tables"]["admin_audit"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
