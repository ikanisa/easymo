export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          phone: string;
          status: "active" | "inactive" | string;
          created_at: string;
          wallet_balance: number | null;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          status?: "active" | "inactive" | string;
          created_at?: string;
          wallet_balance?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["agents"]["Insert"]>;
        Relationships: [];
      };
      drivers: {
        Row: {
          id: string;
          name: string;
          phone: string;
          status: string | null;
          created_at: string;
          vehicle_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          phone: string;
          status?: string | null;
          created_at?: string;
          vehicle_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["drivers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "drivers_vehicle_id_fkey";
            columns: ["vehicle_id"];
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          }
        ];
      };
      vehicles: {
        Row: {
          id: string;
          make: string | null;
          model: string | null;
          license_plate: string | null;
        };
        Insert: {
          id?: string;
          make?: string | null;
          model?: string | null;
          license_plate?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
        Relationships: [];
      };
      stations: {
        Row: {
          id: string;
          name: string;
          location: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          location?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stations"]["Insert"]>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          amount: number;
          created_at: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          amount: number;
          created_at?: string;
          description?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["transactions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type AgentRow = Database["public"]["Tables"]["agents"]["Row"];
export type DriverRow = Database["public"]["Tables"]["drivers"]["Row"];
export type VehicleRow = Database["public"]["Tables"]["vehicles"]["Row"];
export type StationRow = Database["public"]["Tables"]["stations"]["Row"];
export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
