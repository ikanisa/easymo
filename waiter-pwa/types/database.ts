export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string
          user_id: string
          restaurant_id: string
          language: string
          table_number: string | null
          status: 'active' | 'completed' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          restaurant_id: string
          language?: string
          table_number?: string | null
          status?: 'active' | 'completed' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          restaurant_id?: string
          language?: string
          table_number?: string | null
          status?: 'active' | 'completed' | 'archived'
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata: Record<string, any> | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          metadata?: Record<string, any> | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          metadata?: Record<string, any> | null
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
