export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string
          user_id: string | null
          restaurant_id: string | null
          table_number: string | null
          language: string
          metadata: Json
          started_at: string
          last_activity: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          restaurant_id?: string | null
          table_number?: string | null
          language?: string
          metadata?: Json
          started_at?: string
          last_activity?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          restaurant_id?: string | null
          table_number?: string | null
          language?: string
          metadata?: Json
          started_at?: string
          last_activity?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender: 'user' | 'assistant' | 'system'
          content: string
          metadata: Json
          timestamp: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender: 'user' | 'assistant' | 'system'
          content: string
          metadata?: Json
          timestamp?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender?: 'user' | 'assistant' | 'system'
          content?: string
          metadata?: Json
          timestamp?: string | null
          created_at?: string
        }
      }
      cart_items: {
        Row: {
          id: string
          conversation_id: string
          menu_item_id: string
          quantity: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          menu_item_id: string
          quantity?: number
          price: number
          created_at?: string
        }
        Update: {
          quantity?: number
          price?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
