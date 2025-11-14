export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_alert_prefs: {
        Row: {
          admin_user_id: string | null
          alert_key: string | null
          channels: string[]
          enabled: boolean
          updated_at: string
          wa_id: string
          want_alerts: boolean
        }
        Insert: {
          admin_user_id?: string | null
          alert_key?: string | null
          channels?: string[]
          enabled?: boolean
          updated_at?: string
          wa_id: string
          want_alerts?: boolean
        }
        Update: {
          admin_user_id?: string | null
          alert_key?: string | null
          channels?: string[]
          enabled?: boolean
          updated_at?: string
          wa_id?: string
          want_alerts?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "admin_alert_prefs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      agents: {
        Row: {
          id: string
          name: string | null
          phone: string | null
          status: string | null
          wallet_balance: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name?: string | null
          phone?: string | null
          status?: string | null
          wallet_balance?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string | null
          phone?: string | null
          status?: string | null
          wallet_balance?: number | null
          created_at?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_wa: string | null
          admin_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          details: Json
          id: string
          reason: string | null
          target: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          actor_wa?: string | null
          admin_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          target?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_wa?: string | null
          admin_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          details?: Json
          id?: string
          reason?: string | null
          target?: string | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action: string
          actor: string
          changed_keys: Json | null
          created_at: string
          id: string
          ip: string | null
        }
        Insert: {
          action: string
          actor: string
          changed_keys?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
        }
        Update: {
          action?: string
          actor?: string
          changed_keys?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
        }
        Relationships: []
      }
      admin_pin_sessions: {
        Row: {
          created_at: string
          session_id: string
          unlocked_until: string
          wa_id: string
        }
        Insert: {
          created_at?: string
          session_id?: string
          unlocked_until: string
          wa_id: string
        }
        Update: {
          created_at?: string
          session_id?: string
          unlocked_until?: string
          wa_id?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          pin_ok_until: string | null
          updated_at: string
          wa_id: string
        }
        Insert: {
          pin_ok_until?: string | null
          updated_at?: string
          wa_id: string
        }
        Update: {
          pin_ok_until?: string | null
          updated_at?: string
          wa_id?: string
        }
        Relationships: []
      }
      admin_submissions: {
        Row: {
          applicant_name: string | null
          reference: string
          status: string
          submitted_at: string
        }
        Insert: {
          applicant_name?: string | null
          reference: string
          status?: string
          submitted_at?: string
        }
        Update: {
          applicant_name?: string | null
          reference?: string
          status?: string
          submitted_at?: string
        }
        Relationships: []
      }
      agent_chat_messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_chat_sessions: {
        Row: {
          agent_kind: string
          created_at: string
          id: string
          last_agent_message: string | null
          last_user_message: string | null
          metadata: Json
          profile_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_kind: string
          created_at?: string
          id?: string
          last_agent_message?: string | null
          last_user_message?: string | null
          metadata?: Json
          profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_kind?: string
          created_at?: string
          id?: string
          last_agent_message?: string | null
          last_user_message?: string | null
          metadata?: Json
          profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_chat_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      agent_conversations: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_deployments: {
        Row: {
          agent_id: string
          created_at: string
          environment: Database["public"]["Enums"]["deploy_env"]
          id: string
          status: string
          version_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          environment: Database["public"]["Enums"]["deploy_env"]
          id?: string
          status?: string
          version_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          environment?: Database["public"]["Enums"]["deploy_env"]
          id?: string
          status?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_deployments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_deployments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
          token_count: number | null
          updated_at: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
          token_count?: number | null
          updated_at?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          token_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "agent_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_document_embeddings: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: Json
          id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding: Json
          id?: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_document_embeddings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "agent_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_document_vectors: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_document_vectors_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "agent_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_documents: {
        Row: {
          agent_id: string
          created_at: string
          embedding_status: Database["public"]["Enums"]["ingest_status"]
          id: string
          metadata: Json
          source_url: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          embedding_status?: Database["public"]["Enums"]["ingest_status"]
          id?: string
          metadata?: Json
          source_url?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          embedding_status?: Database["public"]["Enums"]["ingest_status"]
          id?: string
          metadata?: Json
          source_url?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_metrics: {
        Row: {
          acceptance_rate_pct: number | null
          agent_type: string
          avg_quotes_per_session: number | null
          avg_response_time_seconds: number | null
          avg_time_to_3_quotes_seconds: number | null
          cancelled_sessions: number | null
          completed_sessions: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric_date: string
          recorded_at: string
          timeout_sessions: number | null
          total_sessions: number | null
          updated_at: string | null
        }
        Insert: {
          acceptance_rate_pct?: number | null
          agent_type: string
          avg_quotes_per_session?: number | null
          avg_response_time_seconds?: number | null
          avg_time_to_3_quotes_seconds?: number | null
          cancelled_sessions?: number | null
          completed_sessions?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string
          recorded_at?: string
          timeout_sessions?: number | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Update: {
          acceptance_rate_pct?: number | null
          agent_type?: string
          avg_quotes_per_session?: number | null
          avg_response_time_seconds?: number | null
          avg_time_to_3_quotes_seconds?: number | null
          cancelled_sessions?: number | null
          completed_sessions?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string
          recorded_at?: string
          timeout_sessions?: number | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_metrics_agent_type_fkey"
            columns: ["agent_type"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["agent_type"]
          },
        ]
      }
      agent_negotiations: {
        Row: {
          counter_price: number | null
          created_at: string
          final_price: number | null
          id: string
          negotiation_rounds: number | null
          original_price: number | null
          quote_id: string
          session_id: string
          status: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          counter_price?: number | null
          created_at?: string
          final_price?: number | null
          id?: string
          negotiation_rounds?: number | null
          original_price?: number | null
          quote_id: string
          session_id: string
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          counter_price?: number | null
          created_at?: string
          final_price?: number | null
          id?: string
          negotiation_rounds?: number | null
          original_price?: number | null
          quote_id?: string
          session_id?: string
          status?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_negotiations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "agent_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_negotiations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_personas: {
        Row: {
          created_at: string
          default_language: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["agent_status"]
          summary: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_language?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["agent_status"]
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_language?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["agent_status"]
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_quotes: {
        Row: {
          counter_offer_data: Json | null
          created_at: string
          estimated_time_minutes: number | null
          expires_at: string | null
          id: string
          metadata: Json | null
          notes: string | null
          offer_data: Json
          price_amount: number | null
          price_currency: string | null
          ranking_score: number | null
          received_at: string | null
          responded_at: string | null
          sent_at: string | null
          session_id: string
          status: string
          updated_at: string
          vendor_id: string | null
          vendor_name: string | null
          vendor_phone: string | null
          vendor_type: string
        }
        Insert: {
          counter_offer_data?: Json | null
          created_at?: string
          estimated_time_minutes?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          offer_data?: Json
          price_amount?: number | null
          price_currency?: string | null
          ranking_score?: number | null
          received_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          session_id: string
          status?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
          vendor_phone?: string | null
          vendor_type: string
        }
        Update: {
          counter_offer_data?: Json | null
          created_at?: string
          estimated_time_minutes?: number | null
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          offer_data?: Json
          price_amount?: number | null
          price_currency?: string | null
          ranking_score?: number | null
          received_at?: string | null
          responded_at?: string | null
          sent_at?: string | null
          session_id?: string
          status?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string | null
          vendor_phone?: string | null
          vendor_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_quotes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      agent_registry: {
        Row: {
          agent_type: string
          auto_negotiation: boolean | null
          autonomy: string | null
          counter_offer_delta_pct: number | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          enabled_tools: string[] | null
          fan_out_limit: number | null
          feature_flag_scope: string | null
          guardrails: Json | null
          id: string
          instructions: string | null
          languages: string[] | null
          max_extensions: number | null
          name: string
          sla_minutes: number | null
          slug: string | null
          system_prompt: string | null
          updated_at: string | null
        }
        Insert: {
          agent_type: string
          auto_negotiation?: boolean | null
          autonomy?: string | null
          counter_offer_delta_pct?: number | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          enabled_tools?: string[] | null
          fan_out_limit?: number | null
          feature_flag_scope?: string | null
          guardrails?: Json | null
          id?: string
          instructions?: string | null
          languages?: string[] | null
          max_extensions?: number | null
          name: string
          sla_minutes?: number | null
          slug?: string | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          auto_negotiation?: boolean | null
          autonomy?: string | null
          counter_offer_delta_pct?: number | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          enabled_tools?: string[] | null
          fan_out_limit?: number | null
          feature_flag_scope?: string | null
          guardrails?: Json | null
          id?: string
          instructions?: string | null
          languages?: string[] | null
          max_extensions?: number | null
          name?: string
          sla_minutes?: number | null
          slug?: string | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          input: Json
          output: Json | null
          status: Database["public"]["Enums"]["run_status"]
          version_id: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          input?: Json
          output?: Json | null
          status?: Database["public"]["Enums"]["run_status"]
          version_id?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          input?: Json
          output?: Json | null
          status?: Database["public"]["Enums"]["run_status"]
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "agent_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessions: {
        Row: {
          agent_type: string | null
          cancellation_reason: string | null
          completed_at: string | null
          created_at: string
          deadline_at: string
          error_message: string | null
          extensions_count: number | null
          flow_type: string
          id: string
          metadata: Json | null
          quotes_collected: Json[] | null
          request_data: Json
          result_data: Json | null
          selected_quote_id: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_type?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          deadline_at: string
          error_message?: string | null
          extensions_count?: number | null
          flow_type: string
          id?: string
          metadata?: Json | null
          quotes_collected?: Json[] | null
          request_data?: Json
          result_data?: Json | null
          selected_quote_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_type?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          deadline_at?: string
          error_message?: string | null
          extensions_count?: number | null
          flow_type?: string
          id?: string
          metadata?: Json | null
          quotes_collected?: Json[] | null
          request_data?: Json
          result_data?: Json | null
          selected_quote_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_agent_type_fkey"
            columns: ["agent_type"]
            isOneToOne: false
            referencedRelation: "agent_registry"
            referencedColumns: ["agent_type"]
          },
          {
            foreignKeyName: "agent_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      agent_tasks: {
        Row: {
          agent_id: string
          assigned_to: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          payload: Json
          status: string
          title: string
        }
        Insert: {
          agent_id: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          payload?: Json
          status?: string
          title: string
        }
        Update: {
          agent_id?: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          payload?: Json
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tasks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tool_catalog: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          json_schema: Json
          metadata: Json | null
          rate_limit_per_minute: number | null
          tool_name: string
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          json_schema: Json
          metadata?: Json | null
          rate_limit_per_minute?: number | null
          tool_name: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          json_schema?: Json
          metadata?: Json | null
          rate_limit_per_minute?: number | null
          tool_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_toolkits: {
        Row: {
          agent_kind: string
          allowed_tools: Json | null
          created_at: string
          file_search_enabled: boolean
          file_search_max_results: number | null
          file_vector_store_id: string | null
          image_generation_enabled: boolean
          image_preset: Json | null
          metadata: Json
          model: string
          reasoning_effort: string
          retrieval_enabled: boolean
          retrieval_max_results: number | null
          retrieval_rewrite: boolean
          retrieval_vector_store_id: string | null
          streaming_partial_images: number | null
          suggestions: string[] | null
          text_verbosity: string
          updated_at: string
          web_search_allowed_domains: string[] | null
          web_search_enabled: boolean
          web_search_user_location: Json | null
        }
        Insert: {
          agent_kind: string
          allowed_tools?: Json | null
          created_at?: string
          file_search_enabled?: boolean
          file_search_max_results?: number | null
          file_vector_store_id?: string | null
          image_generation_enabled?: boolean
          image_preset?: Json | null
          metadata?: Json
          model?: string
          reasoning_effort?: string
          retrieval_enabled?: boolean
          retrieval_max_results?: number | null
          retrieval_rewrite?: boolean
          retrieval_vector_store_id?: string | null
          streaming_partial_images?: number | null
          suggestions?: string[] | null
          text_verbosity?: string
          updated_at?: string
          web_search_allowed_domains?: string[] | null
          web_search_enabled?: boolean
          web_search_user_location?: Json | null
        }
        Update: {
          agent_kind?: string
          allowed_tools?: Json | null
          created_at?: string
          file_search_enabled?: boolean
          file_search_max_results?: number | null
          file_vector_store_id?: string | null
          image_generation_enabled?: boolean
          image_preset?: Json | null
          metadata?: Json
          model?: string
          reasoning_effort?: string
          retrieval_enabled?: boolean
          retrieval_max_results?: number | null
          retrieval_rewrite?: boolean
          retrieval_vector_store_id?: string | null
          streaming_partial_images?: number | null
          suggestions?: string[] | null
          text_verbosity?: string
          updated_at?: string
          web_search_allowed_domains?: string[] | null
          web_search_enabled?: boolean
          web_search_user_location?: Json | null
        }
        Relationships: []
      }
      agent_tools: {
        Row: {
          created_at: string
          description: string
          enabled: boolean
          id: string
          metadata: Json | null
          name: string
          parameters: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          enabled?: boolean
          id?: string
          metadata?: Json | null
          name: string
          parameters?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          metadata?: Json | null
          name?: string
          parameters?: Json
          updated_at?: string
        }
        Relationships: []
      }
      agent_traces: {
        Row: {
          agent_name: string
          created_at: string
          duration_ms: number
          id: string
          query: string
          result: Json
          session_id: string | null
          tools_invoked: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_name: string
          created_at?: string
          duration_ms: number
          id?: string
          query: string
          result?: Json
          session_id?: string | null
          tools_invoked?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_name?: string
          created_at?: string
          duration_ms?: number
          id?: string
          query?: string
          result?: Json
          session_id?: string | null
          tools_invoked?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_traces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      agent_versions: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          instructions: string | null
          published: boolean
          tools: Json
          version: number
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          instructions?: string | null
          published?: boolean
          tools?: Json
          version: number
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          instructions?: string | null
          published?: boolean
          tools?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_versions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          context: Json | null
          correlation_id: string | null
          created_at: string
          event_category: string | null
          event_name: string
          id: string
          properties: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          event_category?: string | null
          event_name: string
          id?: string
          properties?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          event_category?: string | null
          event_name?: string
          id?: string
          properties?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_events_2026_04: {
        Row: {
          context: Json | null
          correlation_id: string | null
          created_at: string
          event_category: string | null
          event_name: string
          id: string
          properties: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          event_category?: string | null
          event_name: string
          id?: string
          properties?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          event_category?: string | null
          event_name?: string
          id?: string
          properties?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_events_2026_05: {
        Row: {
          context: Json | null
          correlation_id: string | null
          created_at: string
          event_category: string | null
          event_name: string
          id: string
          properties: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          event_category?: string | null
          event_name: string
          id?: string
          properties?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          correlation_id?: string | null
          created_at?: string
          event_category?: string | null
          event_name?: string
          id?: string
          properties?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          admin_numbers: string[] | null
          admin_pin_hash: string | null
          admin_pin_required: boolean
          created_at: string
          driver_initial_credits: number
          driver_subscription_tokens: number
          id: number
          insurance_admin_numbers: string[]
          max_results: number | null
          momo_qr_logo_url: string | null
          openai_api_key: string | null
          redeem_catalog: Json | null
          referral_daily_cap: number
          referral_redeem_rules: string | null
          referral_short_domain: string | null
          search_radius_km: number | null
          subscription_price: number | null
          tokens_per_referral: number
          updated_at: string | null
          wa_bot_number_e164: string | null
          wallet_redeem_catalog: Json
          welcome_bonus_tokens: number
        }
        Insert: {
          admin_numbers?: string[] | null
          admin_pin_hash?: string | null
          admin_pin_required?: boolean
          created_at?: string
          driver_initial_credits?: number
          driver_subscription_tokens?: number
          id?: number
          insurance_admin_numbers?: string[]
          max_results?: number | null
          momo_qr_logo_url?: string | null
          openai_api_key?: string | null
          redeem_catalog?: Json | null
          referral_daily_cap?: number
          referral_redeem_rules?: string | null
          referral_short_domain?: string | null
          search_radius_km?: number | null
          subscription_price?: number | null
          tokens_per_referral?: number
          updated_at?: string | null
          wa_bot_number_e164?: string | null
          wallet_redeem_catalog?: Json
          welcome_bonus_tokens?: number
        }
        Update: {
          admin_numbers?: string[] | null
          admin_pin_hash?: string | null
          admin_pin_required?: boolean
          created_at?: string
          driver_initial_credits?: number
          driver_subscription_tokens?: number
          id?: number
          insurance_admin_numbers?: string[]
          max_results?: number | null
          momo_qr_logo_url?: string | null
          openai_api_key?: string | null
          redeem_catalog?: Json | null
          referral_daily_cap?: number
          referral_redeem_rules?: string | null
          referral_short_domain?: string | null
          search_radius_km?: number | null
          subscription_price?: number | null
          tokens_per_referral?: number
          updated_at?: string | null
          wa_bot_number_e164?: string | null
          wallet_redeem_catalog?: Json
          welcome_bonus_tokens?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          actor_id: string | null
          actor_type: string | null
          created_at: string
          diff: Json
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          diff?: Json
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          actor_id?: string | null
          actor_type?: string | null
          created_at?: string
          diff?: Json
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      background_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          error_message: string | null
          error_stack: string | null
          id: string
          idempotency_key: string | null
          job_name: string | null
          job_type: string
          max_attempts: number | null
          metadata: Json | null
          payload: Json
          priority: number | null
          result: Json | null
          scheduled_at: string
          started_at: string | null
          status: string | null
          timeout_seconds: number | null
          updated_at: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          error_stack?: string | null
          id?: string
          idempotency_key?: string | null
          job_name?: string | null
          job_type: string
          max_attempts?: number | null
          metadata?: Json | null
          payload: Json
          priority?: number | null
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string | null
          timeout_seconds?: number | null
          updated_at?: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          error_stack?: string | null
          id?: string
          idempotency_key?: string | null
          job_name?: string | null
          job_type?: string
          max_attempts?: number | null
          metadata?: Json | null
          payload?: Json
          priority?: number | null
          result?: Json | null
          scheduled_at?: string
          started_at?: string | null
          status?: string | null
          timeout_seconds?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      bar_managers: {
        Row: {
          bar_id: string
          created_at: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_managers_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bar_numbers: {
        Row: {
          added_by: string | null
          bar_id: string
          created_at: string
          id: string
          invited_at: string | null
          is_active: boolean
          last_seen_at: string | null
          number_e164: string
          role: Database["public"]["Enums"]["bar_contact_role"]
          updated_at: string
          verification_attempts: number
          verification_code_hash: string | null
          verification_expires_at: string | null
          verified_at: string | null
        }
        Insert: {
          added_by?: string | null
          bar_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          number_e164: string
          role?: Database["public"]["Enums"]["bar_contact_role"]
          updated_at?: string
          verification_attempts?: number
          verification_code_hash?: string | null
          verification_expires_at?: string | null
          verified_at?: string | null
        }
        Update: {
          added_by?: string | null
          bar_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          number_e164?: string
          role?: Database["public"]["Enums"]["bar_contact_role"]
          updated_at?: string
          verification_attempts?: number
          verification_code_hash?: string | null
          verification_expires_at?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bar_numbers_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_settings: {
        Row: {
          allow_direct_customer_chat: boolean
          bar_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          allow_direct_customer_chat?: boolean
          bar_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          allow_direct_customer_chat?: boolean
          bar_id?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_settings_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: true
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bar_tables: {
        Row: {
          bar_id: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          last_scan_at: string | null
          qr_payload: string
          token_nonce: string | null
          updated_at: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          last_scan_at?: string | null
          qr_payload: string
          token_nonce?: string | null
          updated_at?: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          last_scan_at?: string | null
          qr_payload?: string
          token_nonce?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_tables_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bars: {
        Row: {
          city_area: string | null
          country: string | null
          created_at: string
          currency: string | null
          google_maps_url: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          location: unknown
          location_text: string | null
          momo_code: string | null
          name: string
          phone_number: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          city_area?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          location?: unknown
          location_text?: string | null
          momo_code?: string | null
          name: string
          phone_number?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          city_area?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          google_maps_url?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          location?: unknown
          location_text?: string | null
          momo_code?: string | null
          name?: string
          phone_number?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      business: {
        Row: {
          catalog_url: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          location: unknown
          location_text: string | null
          name: string
          name_embedding: string | null
          owner_user_id: string | null
          owner_whatsapp: string | null
          status: string | null
        }
        Insert: {
          catalog_url?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          location?: unknown
          location_text?: string | null
          name: string
          name_embedding?: string | null
          owner_user_id?: string | null
          owner_whatsapp?: string | null
          status?: string | null
        }
        Update: {
          catalog_url?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          location?: unknown
          location_text?: string | null
          name?: string
          name_embedding?: string | null
          owner_user_id?: string | null
          owner_whatsapp?: string | null
          status?: string | null
        }
        Relationships: []
      }
      business_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      business_whatsapp_numbers: {
        Row: {
          added_at: string | null
          added_by_whatsapp: string | null
          business_id: string
          id: string
          is_primary: boolean | null
          updated_at: string | null
          verified: boolean | null
          whatsapp_e164: string
        }
        Insert: {
          added_at?: string | null
          added_by_whatsapp?: string | null
          business_id: string
          id?: string
          is_primary?: boolean | null
          updated_at?: string | null
          verified?: boolean | null
          whatsapp_e164: string
        }
        Update: {
          added_at?: string | null
          added_by_whatsapp?: string | null
          business_id?: string
          id?: string
          is_primary?: boolean | null
          updated_at?: string | null
          verified?: boolean | null
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_whatsapp_numbers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_category_menu_view"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "business_whatsapp_numbers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          catalog_url: string | null
          category_id: number | null
          category_name: string | null
          created_at: string | null
          description: string | null
          geo: unknown
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          location: unknown
          location_text: string | null
          name: string
          name_embedding: string | null
          owner_user_id: string | null
          owner_whatsapp: string
          status: string | null
        }
        Insert: {
          catalog_url?: string | null
          category_id?: number | null
          category_name?: string | null
          created_at?: string | null
          description?: string | null
          geo?: unknown
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          location?: unknown
          location_text?: string | null
          name: string
          name_embedding?: string | null
          owner_user_id?: string | null
          owner_whatsapp: string
          status?: string | null
        }
        Update: {
          catalog_url?: string | null
          category_id?: number | null
          category_name?: string | null
          created_at?: string | null
          description?: string | null
          geo?: unknown
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          location?: unknown
          location_text?: string | null
          name?: string
          name_embedding?: string | null
          owner_user_id?: string | null
          owner_whatsapp?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_category_menu_view"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "businesses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "marketplace_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      cache_entries: {
        Row: {
          cache_type: string | null
          created_at: string
          expires_at: string
          key: string
          metadata: Json | null
          tags: string[] | null
          updated_at: string
          value: Json
        }
        Insert: {
          cache_type?: string | null
          created_at?: string
          expires_at: string
          key: string
          metadata?: Json | null
          tags?: string[] | null
          updated_at?: string
          value: Json
        }
        Update: {
          cache_type?: string | null
          created_at?: string
          expires_at?: string
          key?: string
          metadata?: Json | null
          tags?: string[] | null
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      call_consents: {
        Row: {
          audio_url: string | null
          call_id: string | null
          consent_result: boolean | null
          consent_text: string | null
          id: string
          t: string | null
        }
        Insert: {
          audio_url?: string | null
          call_id?: string | null
          consent_result?: boolean | null
          consent_text?: string | null
          id?: string
          t?: string | null
        }
        Update: {
          audio_url?: string | null
          call_id?: string | null
          consent_result?: boolean | null
          consent_text?: string | null
          id?: string
          t?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_consents_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_events: {
        Row: {
          call_sid: string
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          call_sid: string
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          call_sid?: string
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_sid: string | null
          created_at: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          metadata: Json | null
          phone_number: string
          recording_url: string | null
          session_id: string | null
          started_at: string | null
          status: string
          transcript: string | null
          vendor_id: string | null
        }
        Insert: {
          call_sid?: string | null
          created_at?: string | null
          direction: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          phone_number: string
          recording_url?: string | null
          session_id?: string | null
          started_at?: string | null
          status: string
          transcript?: string | null
          vendor_id?: string | null
        }
        Update: {
          call_sid?: string | null
          created_at?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          metadata?: Json | null
          phone_number?: string
          recording_url?: string | null
          session_id?: string | null
          started_at?: string | null
          status?: string
          transcript?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_sid: string
          created_at: string | null
          direction: string | null
          from_number: string | null
          id: string
          intent: string | null
          meta: Json | null
          status: string | null
          to_number: string | null
          transcript: string | null
          updated_at: string | null
        }
        Insert: {
          call_sid: string
          created_at?: string | null
          direction?: string | null
          from_number?: string | null
          id?: string
          intent?: string | null
          meta?: Json | null
          status?: string | null
          to_number?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Update: {
          call_sid?: string
          created_at?: string | null
          direction?: string | null
          from_number?: string | null
          id?: string
          intent?: string | null
          meta?: Json | null
          status?: string | null
          to_number?: string | null
          transcript?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_target_archives: {
        Row: {
          archived_at: string
          campaign_id: string
          error_code: string | null
          id: string
          last_update_at: string | null
          metadata: Json
          msisdn_hash: string
          msisdn_masked: string
          status: string | null
          target_id: string
        }
        Insert: {
          archived_at?: string
          campaign_id: string
          error_code?: string | null
          id?: string
          last_update_at?: string | null
          metadata?: Json
          msisdn_hash: string
          msisdn_masked: string
          status?: string | null
          target_id: string
        }
        Update: {
          archived_at?: string
          campaign_id?: string
          error_code?: string | null
          id?: string
          last_update_at?: string | null
          metadata?: Json
          msisdn_hash?: string
          msisdn_masked?: string
          status?: string | null
          target_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          flags_snapshot: Json
          id: string
          item_id: string | null
          item_name: string
          item_snapshot: Json
          line_total_minor: number
          modifiers_snapshot: Json
          qty: number
          unit_price_minor: number
        }
        Insert: {
          cart_id: string
          created_at?: string
          flags_snapshot?: Json
          id?: string
          item_id?: string | null
          item_name: string
          item_snapshot?: Json
          line_total_minor: number
          modifiers_snapshot?: Json
          qty: number
          unit_price_minor: number
        }
        Update: {
          cart_id?: string
          created_at?: string
          flags_snapshot?: Json
          id?: string
          item_id?: string | null
          item_name?: string
          item_snapshot?: Json
          line_total_minor?: number
          modifiers_snapshot?: Json
          qty?: number
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          bar_id: string
          created_at: string
          expires_at: string | null
          id: string
          profile_id: string
          service_charge_minor: number
          status: Database["public"]["Enums"]["cart_status"]
          subtotal_minor: number
          table_label: string | null
          total_minor: number
          updated_at: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id: string
          service_charge_minor?: number
          status?: Database["public"]["Enums"]["cart_status"]
          subtotal_minor?: number
          table_label?: string | null
          total_minor?: number
          updated_at?: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          profile_id?: string
          service_charge_minor?: number
          status?: Database["public"]["Enums"]["cart_status"]
          subtotal_minor?: number
          table_label?: string | null
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_profile_fk"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      categories: {
        Row: {
          bar_id: string
          created_at: string
          id: string
          is_deleted: boolean
          menu_id: string
          name: string
          parent_category_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          menu_id: string
          name: string
          parent_category_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          menu_id?: string
          name?: string
          parent_category_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "published_menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          state: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          state?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          state?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_state: {
        Row: {
          state: Json
          state_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          state?: Json
          state_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          state_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      configuration_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          config_key: string
          configuration_id: string
          created_at: string
          environment: string
          id: string
          new_value: Json | null
          old_value: Json | null
          service_name: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          config_key: string
          configuration_id: string
          created_at?: string
          environment: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          service_name: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          config_key?: string
          configuration_id?: string
          created_at?: string
          environment?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          service_name?: string
        }
        Relationships: []
      }
      configurations: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          created_by: string | null
          description: string | null
          environment: string
          id: string
          is_secret: boolean | null
          metadata: Json | null
          service_name: string
          updated_at: string
          updated_by: string | null
          value_type: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment?: string
          id?: string
          is_secret?: boolean | null
          metadata?: Json | null
          service_name: string
          updated_at?: string
          updated_by?: string | null
          value_type?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment?: string
          id?: string
          is_secret?: boolean | null
          metadata?: Json | null
          service_name?: string
          updated_at?: string
          updated_by?: string | null
          value_type?: string | null
        }
        Relationships: []
      }
      contact_preferences: {
        Row: {
          consent_topics: Json | null
          created_at: string
          id: string
          metadata: Json | null
          notification_preferences: Json | null
          opt_out_at: string | null
          opt_out_reason: string | null
          opted_out: boolean | null
          preferred_locale: string | null
          profile_id: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string | null
          updated_at: string
          wa_id: string
        }
        Insert: {
          consent_topics?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_preferences?: Json | null
          opt_out_at?: string | null
          opt_out_reason?: string | null
          opted_out?: boolean | null
          preferred_locale?: string | null
          profile_id?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string
          wa_id: string
        }
        Update: {
          consent_topics?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_preferences?: Json | null
          opt_out_at?: string | null
          opt_out_reason?: string | null
          opted_out?: boolean | null
          preferred_locale?: string | null
          profile_id?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      contacts: {
        Row: {
          attributes: Json | null
          city: string | null
          created_at: string
          full_name: string | null
          id: number
          last_inbound_at: string | null
          last_inbound_ts: string | null
          msisdn_e164: string
          opt_in_source: string | null
          opt_in_ts: string | null
          opt_out_ts: string | null
          opted_in: boolean
          opted_out: boolean
          profile_id: string | null
          sector: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          attributes?: Json | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: number
          last_inbound_at?: string | null
          last_inbound_ts?: string | null
          msisdn_e164: string
          opt_in_source?: string | null
          opt_in_ts?: string | null
          opt_out_ts?: string | null
          opted_in?: boolean
          opted_out?: boolean
          profile_id?: string | null
          sector?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          attributes?: Json | null
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: number
          last_inbound_at?: string | null
          last_inbound_ts?: string | null
          msisdn_e164?: string
          opt_in_source?: string | null
          opt_in_ts?: string | null
          opt_out_ts?: string | null
          opted_in?: boolean
          opted_out?: boolean
          profile_id?: string | null
          sector?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string | null
          driver_id: string | null
          id: string
          metadata: Json | null
          role: string
          wa_thread_id: string | null
        }
        Insert: {
          channel?: string
          contact_id?: string | null
          created_at?: string | null
          driver_id?: string | null
          id?: string
          metadata?: Json | null
          role: string
          wa_thread_id?: string | null
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string | null
          driver_id?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          wa_thread_id?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          currency_code: string
          currency_symbol: string | null
          flag_emoji: string | null
          id: string
          is_active: boolean
          mobile_money_brand: string
          mobile_money_provider: string
          name: string
          phone_prefix: string
          sort_order: number | null
          timezone: string | null
          updated_at: string
          ussd_pay_merchant: string
          ussd_send_to_phone: string
        }
        Insert: {
          code: string
          created_at?: string
          currency_code: string
          currency_symbol?: string | null
          flag_emoji?: string | null
          id?: string
          is_active?: boolean
          mobile_money_brand: string
          mobile_money_provider: string
          name: string
          phone_prefix: string
          sort_order?: number | null
          timezone?: string | null
          updated_at?: string
          ussd_pay_merchant: string
          ussd_send_to_phone: string
        }
        Update: {
          code?: string
          created_at?: string
          currency_code?: string
          currency_symbol?: string | null
          flag_emoji?: string | null
          id?: string
          is_active?: boolean
          mobile_money_brand?: string
          mobile_money_provider?: string
          name?: string
          phone_prefix?: string
          sort_order?: number | null
          timezone?: string | null
          updated_at?: string
          ussd_pay_merchant?: string
          ussd_send_to_phone?: string
        }
        Relationships: []
      }
      deeplink_events: {
        Row: {
          actor_msisdn: string | null
          created_at: string
          event: string
          id: string
          meta: Json | null
          token_id: string
        }
        Insert: {
          actor_msisdn?: string | null
          created_at?: string
          event: string
          id?: string
          meta?: Json | null
          token_id: string
        }
        Update: {
          actor_msisdn?: string | null
          created_at?: string
          event?: string
          id?: string
          meta?: Json | null
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deeplink_events_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "deeplink_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      deeplink_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          flow: string
          id: string
          last_resolved_at: string | null
          metadata: Json
          msisdn_e164: string | null
          multi_use: boolean
          payload: Json
          resolved_count: number
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          flow: string
          id?: string
          last_resolved_at?: string | null
          metadata?: Json
          msisdn_e164?: string | null
          multi_use?: boolean
          payload: Json
          resolved_count?: number
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          flow?: string
          id?: string
          last_resolved_at?: string | null
          metadata?: Json
          msisdn_e164?: string | null
          multi_use?: boolean
          payload?: Json
          resolved_count?: number
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      driver_availability: {
        Row: {
          active: boolean
          created_at: string
          days_of_week: number[]
          driver_id: string
          end_time_local: string
          id: string
          parking_id: string | null
          start_time_local: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week: number[]
          driver_id: string
          end_time_local: string
          id?: string
          parking_id?: string | null
          start_time_local: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          driver_id?: string
          end_time_local?: string
          id?: string
          parking_id?: string | null
          start_time_local?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_driver_id_fkey1"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_availability_parking_id_fkey"
            columns: ["parking_id"]
            isOneToOne: false
            referencedRelation: "driver_parking"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_availability_legacy: {
        Row: {
          at: string | null
          available: boolean | null
          driver_id: string | null
          id: string
          loc: unknown
        }
        Insert: {
          at?: string | null
          available?: boolean | null
          driver_id?: string | null
          id?: string
          loc: unknown
        }
        Update: {
          at?: string | null
          available?: boolean | null
          driver_id?: string | null
          id?: string
          loc?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_parking: {
        Row: {
          active: boolean
          created_at: string
          driver_id: string
          geog: unknown
          id: string
          label: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_id: string
          geog: unknown
          id?: string
          label: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_id?: string
          geog?: unknown
          id?: string
          label?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_parking_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      driver_presence: {
        Row: {
          last_seen: string
          lat: number | null
          lng: number | null
          ref_code: string | null
          user_id: string
          vehicle_type: string
          whatsapp_e164: string | null
        }
        Insert: {
          last_seen?: string
          lat?: number | null
          lng?: number | null
          ref_code?: string | null
          user_id: string
          vehicle_type: string
          whatsapp_e164?: string | null
        }
        Update: {
          last_seen?: string
          lat?: number | null
          lng?: number | null
          ref_code?: string | null
          user_id?: string
          vehicle_type?: string
          whatsapp_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      driver_status: {
        Row: {
          last_seen: string | null
          lat: number | null
          lng: number | null
          location: unknown
          online: boolean | null
          updated_at: string
          user_id: string
          vehicle_type: string | null
        }
        Insert: {
          last_seen?: string | null
          lat?: number | null
          lng?: number | null
          location?: unknown
          online?: boolean | null
          updated_at?: string
          user_id: string
          vehicle_type?: string | null
        }
        Update: {
          last_seen?: string | null
          lat?: number | null
          lng?: number | null
          location?: unknown
          online?: boolean | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          phone_e164: string
          rating: number | null
          vehicle_desc: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_kind"] | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          phone_e164: string
          rating?: number | null
          vehicle_desc?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_kind"] | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          phone_e164?: string
          rating?: number | null
          vehicle_desc?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_kind"] | null
        }
        Relationships: []
      }
      event_store: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          event_version: number
          id: string
          metadata: Json | null
          payload: Json
          user_id: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          event_version?: number
          id?: string
          metadata?: Json | null
          payload: Json
          user_id?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          event_version?: number
          id?: string
          metadata?: Json | null
          payload?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      event_store_2026_04: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          event_version: number
          id: string
          metadata: Json | null
          payload: Json
          user_id: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          event_version?: number
          id?: string
          metadata?: Json | null
          payload: Json
          user_id?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          event_version?: number
          id?: string
          metadata?: Json | null
          payload?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      event_store_2026_05: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          causation_id: string | null
          correlation_id: string | null
          created_at: string
          event_type: string
          event_version: number
          id: string
          metadata: Json | null
          payload: Json
          user_id: string | null
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type: string
          event_version?: number
          id?: string
          metadata?: Json | null
          payload: Json
          user_id?: string | null
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          causation_id?: string | null
          correlation_id?: string | null
          created_at?: string
          event_type?: string
          event_version?: number
          id?: string
          metadata?: Json | null
          payload?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      feature_flag_evaluations: {
        Row: {
          created_at: string
          evaluation_reason: string | null
          evaluation_result: boolean
          flag_key: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          evaluation_reason?: string | null
          evaluation_result: boolean
          flag_key: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          evaluation_reason?: string | null
          evaluation_result?: boolean
          flag_key?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          environment: string | null
          id: string
          key: string
          metadata: Json | null
          name: string
          rollout_percentage: number | null
          rollout_strategy: string | null
          target_users: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          environment?: string | null
          id?: string
          key: string
          metadata?: Json | null
          name: string
          rollout_percentage?: number | null
          rollout_strategy?: string | null
          target_users?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          environment?: string | null
          id?: string
          key?: string
          metadata?: Json | null
          name?: string
          rollout_percentage?: number | null
          rollout_strategy?: string | null
          target_users?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      flow_submissions: {
        Row: {
          action_id: string | null
          flow_id: string
          id: string
          payload: Json
          received_at: string
          screen_id: string | null
          wa_id: string | null
        }
        Insert: {
          action_id?: string | null
          flow_id: string
          id?: string
          payload?: Json
          received_at?: string
          screen_id?: string | null
          wa_id?: string | null
        }
        Update: {
          action_id?: string | null
          flow_id?: string
          id?: string
          payload?: Json
          received_at?: string
          screen_id?: string | null
          wa_id?: string | null
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          key: string
          payload: Json
        }
        Insert: {
          created_at?: string
          key: string
          payload: Json
        }
        Update: {
          created_at?: string
          key?: string
          payload?: Json
        }
        Relationships: []
      }
      insurance_documents: {
        Row: {
          checksum: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          intent_id: string | null
          kind: Database["public"]["Enums"]["doc_type"]
          ocr_confidence: number | null
          ocr_json: Json | null
          ocr_state: Database["public"]["Enums"]["ocr_status"]
          storage_path: string
        }
        Insert: {
          checksum?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          intent_id?: string | null
          kind: Database["public"]["Enums"]["doc_type"]
          ocr_confidence?: number | null
          ocr_json?: Json | null
          ocr_state?: Database["public"]["Enums"]["ocr_status"]
          storage_path: string
        }
        Update: {
          checksum?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          intent_id?: string | null
          kind?: Database["public"]["Enums"]["doc_type"]
          ocr_confidence?: number | null
          ocr_json?: Json | null
          ocr_state?: Database["public"]["Enums"]["ocr_status"]
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_documents_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "insurance_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_intents: {
        Row: {
          contact_id: string | null
          created_at: string | null
          id: string
          insurer_preference: string | null
          notes: string | null
          status: Database["public"]["Enums"]["insurance_status"]
          updated_at: string | null
          vehicle_plate: string | null
          vehicle_type: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          insurer_preference?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["insurance_status"]
          updated_at?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          id?: string
          insurer_preference?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["insurance_status"]
          updated_at?: string | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_intents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_leads: {
        Row: {
          created_at: string | null
          extracted: Json | null
          extracted_json: Json | null
          file_path: string | null
          id: string
          raw_ocr: Json | null
          status: string
          user_id: string | null
          whatsapp: string
        }
        Insert: {
          created_at?: string | null
          extracted?: Json | null
          extracted_json?: Json | null
          file_path?: string | null
          id?: string
          raw_ocr?: Json | null
          status?: string
          user_id?: string | null
          whatsapp: string
        }
        Update: {
          created_at?: string | null
          extracted?: Json | null
          extracted_json?: Json | null
          file_path?: string | null
          id?: string
          raw_ocr?: Json | null
          status?: string
          user_id?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_leads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insurance_media: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string | null
          mime_type: string | null
          storage_path: string
          wa_media_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          storage_path: string
          wa_media_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          storage_path?: string
          wa_media_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_media_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "insurance_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_media_queue: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          mime_type: string | null
          profile_id: string | null
          status: string
          storage_path: string
          wa_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          profile_id?: string | null
          status?: string
          storage_path: string
          wa_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          profile_id?: string | null
          status?: string
          storage_path?: string
          wa_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_media_queue_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      insurance_quotes: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          insurer: string | null
          premium: number | null
          reviewer_comment: string | null
          status: string
          updated_at: string | null
          uploaded_docs: string[]
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          insurer?: string | null
          premium?: number | null
          reviewer_comment?: string | null
          status?: string
          updated_at?: string | null
          uploaded_docs?: string[]
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          insurer?: string | null
          premium?: number | null
          reviewer_comment?: string | null
          status?: string
          updated_at?: string | null
          uploaded_docs?: string[]
          user_id?: string | null
        }
        Relationships: []
      }
      item_modifiers: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          item_id: string
          modifier_type: Database["public"]["Enums"]["item_modifier_type"]
          name: string
          options: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          item_id: string
          modifier_type: Database["public"]["Enums"]["item_modifier_type"]
          name: string
          options?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          item_id?: string
          modifier_type?: Database["public"]["Enums"]["item_modifier_type"]
          name?: string
          options?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_modifiers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_modifiers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "menu_items_snapshot"
            referencedColumns: ["item_id"]
          },
        ]
      }
      items: {
        Row: {
          bar_id: string
          category_id: string | null
          created_at: string
          currency: string | null
          flags: Json
          id: string
          is_available: boolean
          menu_id: string
          metadata: Json
          name: string
          price_minor: number
          short_description: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bar_id: string
          category_id?: string | null
          created_at?: string
          currency?: string | null
          flags?: Json
          id?: string
          is_available?: boolean
          menu_id: string
          metadata?: Json
          name: string
          price_minor: number
          short_description?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bar_id?: string
          category_id?: string | null
          created_at?: string
          currency?: string | null
          flags?: Json
          id?: string
          is_available?: boolean
          menu_id?: string
          metadata?: Json
          name?: string
          price_minor?: number
          short_description?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "published_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_notifications: {
        Row: {
          last_dropped_at: string | null
          last_entered_at: string | null
          user_id: string
          window: string
        }
        Insert: {
          last_dropped_at?: string | null
          last_entered_at?: string | null
          user_id: string
          window: string
        }
        Update: {
          last_dropped_at?: string | null
          last_entered_at?: string | null
          user_id?: string
          window?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      leaderboard_snapshots: {
        Row: {
          generated_at: string
          id: string | null
          payload: Json
          snapshot_window: string | null
          top9: Json | null
          window: string
          your_rank_map: Json | null
        }
        Insert: {
          generated_at?: string
          id?: string | null
          payload: Json
          snapshot_window?: string | null
          top9?: Json | null
          window: string
          your_rank_map?: Json | null
        }
        Update: {
          generated_at?: string
          id?: string | null
          payload?: Json
          snapshot_window?: string | null
          top9?: Json | null
          window?: string
          your_rank_map?: Json | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          accuracy_meters: number | null
          address: string | null
          altitude_meters: number | null
          city: string | null
          coordinates: unknown
          country: string | null
          created_at: string
          id: string
          is_active: boolean | null
          location_type: string
          metadata: Json | null
          place_id: string | null
          place_name: string | null
          postal_code: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accuracy_meters?: number | null
          address?: string | null
          altitude_meters?: number | null
          city?: string | null
          coordinates: unknown
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_type: string
          metadata?: Json | null
          place_id?: string | null
          place_name?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accuracy_meters?: number | null
          address?: string | null
          altitude_meters?: number | null
          city?: string | null
          coordinates?: unknown
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          location_type?: string
          metadata?: Json | null
          place_id?: string | null
          place_name?: string | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      marketplace_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: number
          is_active: boolean
          menu_item_id: string | null
          name: string
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: number
          is_active?: boolean
          menu_item_id?: string | null
          name: string
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: number
          is_active?: boolean
          menu_item_id?: string | null
          name?: string
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_categories_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "business_category_menu_view"
            referencedColumns: ["menu_item_id"]
          },
          {
            foreignKeyName: "marketplace_categories_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_home_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_categories_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_menu_by_country"
            referencedColumns: ["menu_item_id"]
          },
        ]
      }
      mcp_tool_calls: {
        Row: {
          args: Json | null
          call_id: string | null
          id: string
          result: Json | null
          server: string | null
          success: boolean | null
          t: string | null
          tool: string | null
        }
        Insert: {
          args?: Json | null
          call_id?: string | null
          id?: string
          result?: Json | null
          server?: string | null
          success?: boolean | null
          t?: string | null
          tool?: string | null
        }
        Update: {
          args?: Json | null
          call_id?: string | null
          id?: string
          result?: Json | null
          server?: string | null
          success?: boolean | null
          t?: string | null
          tool?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tool_calls_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_upload_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bar_id: string
          created_at: string
          error_message: string | null
          file_type: string
          file_url: string
          id: string
          items_extracted: number | null
          processed_at: string | null
          status: string
          uploaded_by: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bar_id: string
          created_at?: string
          error_message?: string | null
          file_type: string
          file_url: string
          id?: string
          items_extracted?: number | null
          processed_at?: string | null
          status?: string
          uploaded_by: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bar_id?: string
          created_at?: string
          error_message?: string | null
          file_type?: string
          file_url?: string
          id?: string
          items_extracted?: number | null
          processed_at?: string | null
          status?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_upload_requests_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          bar_id: string
          created_at: string
          created_by: string | null
          id: string
          published_at: string | null
          source: Database["public"]["Enums"]["menu_source"]
          source_file_ids: string[]
          status: Database["public"]["Enums"]["menu_status"]
          updated_at: string
          version: number
        }
        Insert: {
          bar_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          source?: Database["public"]["Enums"]["menu_source"]
          source_file_ids?: string[]
          status?: Database["public"]["Enums"]["menu_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          bar_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          published_at?: string | null
          source?: Database["public"]["Enums"]["menu_source"]
          source_file_ids?: string[]
          status?: Database["public"]["Enums"]["menu_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "menus_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          correlation_id: string | null
          created_at: string
          error_message: string | null
          error_stack: string | null
          id: string
          idempotency_key: string | null
          max_retries: number | null
          message_type: string
          metadata: Json | null
          payload: Json
          priority: number | null
          processed_at: string | null
          queue_name: string
          retry_count: number | null
          scheduled_at: string
          started_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          error_stack?: string | null
          id?: string
          idempotency_key?: string | null
          max_retries?: number | null
          message_type: string
          metadata?: Json | null
          payload: Json
          priority?: number | null
          processed_at?: string | null
          queue_name: string
          retry_count?: number | null
          scheduled_at?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          error_stack?: string | null
          id?: string
          idempotency_key?: string | null
          max_retries?: number | null
          message_type?: string
          metadata?: Json | null
          payload?: Json
          priority?: number | null
          processed_at?: string | null
          queue_name?: string
          retry_count?: number | null
          scheduled_at?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: Json
          conversation_id: string | null
          created_at: string | null
          dir: string
          id: number
        }
        Insert: {
          body: Json
          conversation_id?: string | null
          created_at?: string | null
          dir: string
          id?: never
        }
        Update: {
          body?: Json
          conversation_id?: string | null
          created_at?: string | null
          dir?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_metadata: {
        Row: {
          agent_conversation_id: string | null
          agent_message_id: string | null
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          expires_at: string
          message_id: number
          message_type: string | null
          metadata: Json
          read_at: string | null
          recipient_msisdn: string | null
          sender_msisdn: string | null
          sent_at: string | null
          status: string
          status_reason: string | null
          updated_at: string
          wa_message_id: string | null
        }
        Insert: {
          agent_conversation_id?: string | null
          agent_message_id?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          expires_at?: string
          message_id: number
          message_type?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_msisdn?: string | null
          sender_msisdn?: string | null
          sent_at?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Update: {
          agent_conversation_id?: string | null
          agent_message_id?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          expires_at?: string
          message_id?: number
          message_type?: string | null
          metadata?: Json
          read_at?: string | null
          recipient_msisdn?: string | null
          sender_msisdn?: string | null
          sent_at?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_metadata_agent_conversation_id_fkey"
            columns: ["agent_conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_metadata_agent_message_id_fkey"
            columns: ["agent_message_id"]
            isOneToOne: false
            referencedRelation: "agent_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_metadata_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_metadata_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mobility_pro_access: {
        Row: {
          created_at: string
          credits_left: number
          granted_until: string | null
          last_credit_used_at: string | null
          last_subscription_paid_at: string | null
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_left?: number
          granted_until?: string | null
          last_credit_used_at?: string | null
          last_subscription_paid_at?: string | null
          plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_left?: number
          granted_until?: string | null
          last_credit_used_at?: string | null
          last_subscription_paid_at?: string | null
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mobility_pro_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      momo_parsed_txns: {
        Row: {
          amount: number | null
          currency: string | null
          id: string
          inbox_id: string | null
          msisdn_e164: string | null
          parsed_json: Json
          sender_name: string | null
          txn_id: string | null
          txn_ts: string | null
        }
        Insert: {
          amount?: number | null
          currency?: string | null
          id?: string
          inbox_id?: string | null
          msisdn_e164?: string | null
          parsed_json?: Json
          sender_name?: string | null
          txn_id?: string | null
          txn_ts?: string | null
        }
        Update: {
          amount?: number | null
          currency?: string | null
          id?: string
          inbox_id?: string | null
          msisdn_e164?: string | null
          parsed_json?: Json
          sender_name?: string | null
          txn_id?: string | null
          txn_ts?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "momo_parsed_txns_inbox_id_fkey"
            columns: ["inbox_id"]
            isOneToOne: false
            referencedRelation: "momo_sms_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      momo_qr_requests: {
        Row: {
          amount: number | null
          amount_minor: number | null
          amount_rwf: number | null
          created_at: string
          id: string
          kind: string
          momo_value: string
          msisdn_or_code: string | null
          qr_url: string
          requester_wa_id: string | null
          share_url: string | null
          target_type: string | null
          target_value: string | null
          tel_uri: string
          user_id: string | null
          ussd: string | null
          ussd_code: string | null
          ussd_text: string
          whatsapp_e164: string
        }
        Insert: {
          amount?: number | null
          amount_minor?: number | null
          amount_rwf?: number | null
          created_at?: string
          id?: string
          kind: string
          momo_value: string
          msisdn_or_code?: string | null
          qr_url: string
          requester_wa_id?: string | null
          share_url?: string | null
          target_type?: string | null
          target_value?: string | null
          tel_uri: string
          user_id?: string | null
          ussd?: string | null
          ussd_code?: string | null
          ussd_text: string
          whatsapp_e164: string
        }
        Update: {
          amount?: number | null
          amount_minor?: number | null
          amount_rwf?: number | null
          created_at?: string
          id?: string
          kind?: string
          momo_value?: string
          msisdn_or_code?: string | null
          qr_url?: string
          requester_wa_id?: string | null
          share_url?: string | null
          target_type?: string | null
          target_value?: string | null
          tel_uri?: string
          user_id?: string | null
          ussd?: string | null
          ussd_code?: string | null
          ussd_text?: string
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "momo_qr_requests_user_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      momo_sms_inbox: {
        Row: {
          id: string
          msisdn_raw: string | null
          raw_text: string | null
          received_at: string
        }
        Insert: {
          id?: string
          msisdn_raw?: string | null
          raw_text?: string | null
          received_at?: string
        }
        Update: {
          id?: string
          msisdn_raw?: string | null
          raw_text?: string | null
          received_at?: string
        }
        Relationships: []
      }
      momo_unmatched: {
        Row: {
          created_at: string
          id: string
          parsed_id: string | null
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          parsed_id?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          parsed_id?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "momo_unmatched_parsed_id_fkey"
            columns: ["parsed_id"]
            isOneToOne: false
            referencedRelation: "momo_parsed_txns"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_audit_log: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          notification_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          notification_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          notification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_audit_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          campaign_id: string | null
          correlation_id: string | null
          created_at: string
          domain: string | null
          error_message: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          metadata: Json
          msisdn: string | null
          next_attempt_at: string | null
          notification_type: string
          order_id: string | null
          payload: Json
          quiet_hours_override: boolean | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          to_role: string | null
          to_wa_id: string
          type: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          correlation_id?: string | null
          created_at?: string
          domain?: string | null
          error_message?: string | null
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          metadata?: Json
          msisdn?: string | null
          next_attempt_at?: string | null
          notification_type: string
          order_id?: string | null
          payload?: Json
          quiet_hours_override?: boolean | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          to_role?: string | null
          to_wa_id: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          correlation_id?: string | null
          created_at?: string
          domain?: string | null
          error_message?: string | null
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          metadata?: Json
          msisdn?: string | null
          next_attempt_at?: string | null
          notification_type?: string
          order_id?: string | null
          payload?: Json
          quiet_hours_override?: boolean | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          to_role?: string | null
          to_wa_id?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ocr_jobs: {
        Row: {
          attempts: number
          bar_id: string
          created_at: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          menu_id: string | null
          result_path: string | null
          source_file_id: string | null
          status: Database["public"]["Enums"]["ocr_job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          bar_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          menu_id?: string | null
          result_path?: string | null
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["ocr_job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          bar_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          menu_id?: string | null
          result_path?: string | null
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["ocr_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_jobs_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_jobs_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "published_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_details_encrypted: string | null
          account_name: string | null
          account_number_masked: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_default: boolean | null
          is_verified: boolean | null
          metadata: Json | null
          provider: string
          provider_account_id: string | null
          status: string | null
          type: string
          updated_at: string
          user_id: string
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          account_details_encrypted?: string | null
          account_name?: string | null
          account_number_masked?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          metadata?: Json | null
          provider: string
          provider_account_id?: string | null
          status?: string | null
          type: string
          updated_at?: string
          user_id: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          account_details_encrypted?: string | null
          account_name?: string | null
          account_number_masked?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_default?: boolean | null
          is_verified?: boolean | null
          metadata?: Json | null
          provider?: string
          provider_account_id?: string | null
          status?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      petrol_stations: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          owner_contact: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          owner_contact?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_contact?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      policy_throttle_counters: {
        Row: {
          bucket_id: string
          count: number
          expires_at: string
          inserted_at: string
          limit_cap: number
          metadata: Json
          updated_at: string
          window_start: string
        }
        Insert: {
          bucket_id: string
          count?: number
          expires_at: string
          inserted_at?: string
          limit_cap?: number
          metadata?: Json
          updated_at?: string
          window_start: string
        }
        Update: {
          bucket_id?: string
          count?: number
          expires_at?: string
          inserted_at?: string
          limit_cap?: number
          metadata?: Json
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      product_inquiries: {
        Row: {
          created_at: string | null
          id: string
          products: string[]
          response_data: Json | null
          session_id: string | null
          shop_id: string | null
          status: string
          updated_at: string | null
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          products: string[]
          response_data?: Json | null
          session_id?: string | null
          shop_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          products?: string[]
          response_data?: Json | null
          session_id?: string | null
          shop_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_inquiries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inquiries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inquiries_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credits_balance: number | null
          locale: string | null
          metadata: Json
          ref_code: string | null
          updated_at: string
          user_id: string
          vehicle_plate: string | null
          vehicle_type: string | null
          whatsapp_e164: string | null
        }
        Insert: {
          created_at?: string
          credits_balance?: number | null
          locale?: string | null
          metadata?: Json
          ref_code?: string | null
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
          whatsapp_e164?: string | null
        }
        Update: {
          created_at?: string
          credits_balance?: number | null
          locale?: string | null
          metadata?: Json
          ref_code?: string | null
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
          vehicle_type?: string | null
          whatsapp_e164?: string | null
        }
        Relationships: []
      }
      promo_rules: {
        Row: {
          daily_cap_per_sharer: number | null
          id: number
          tokens_per_new_user: number
          welcome_bonus: number | null
        }
        Insert: {
          daily_cap_per_sharer?: number | null
          id?: number
          tokens_per_new_user?: number
          welcome_bonus?: number | null
        }
        Update: {
          daily_cap_per_sharer?: number | null
          id?: number
          tokens_per_new_user?: number
          welcome_bonus?: number | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: string[] | null
          available_from: string | null
          bathrooms: number | null
          bedrooms: number
          created_at: string | null
          description: string | null
          id: string
          image_analysis: string | null
          images: string[] | null
          location: unknown
          minimum_stay: number | null
          owner_id: string
          price: number
          rental_type: string
          status: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_analysis?: string | null
          images?: string[] | null
          location?: unknown
          minimum_stay?: number | null
          owner_id: string
          price: number
          rental_type: string
          status?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_analysis?: string | null
          images?: string[] | null
          location?: unknown
          minimum_stay?: number | null
          owner_id?: string
          price?: number
          rental_type?: string
          status?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      property_inquiries: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          property_id: string | null
          session_id: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          property_id?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          property_id?: string | null
          session_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_inquiries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      property_listings: {
        Row: {
          address: string | null
          amenities: string[] | null
          available_from: string | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string
          id: string
          images: string[] | null
          location: Json
          owner_id: string
          price: number | null
          rental_type: string
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          images?: string[] | null
          location: Json
          owner_id: string
          price?: number | null
          rental_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string
          id?: string
          images?: string[] | null
          location?: Json
          owner_id?: string
          price?: number | null
          rental_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          property_id: string | null
          rating: number
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          property_id?: string | null
          rating: number
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          property_id?: string | null
          rating?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_tokens: {
        Row: {
          created_at: string
          id: string
          last_scan_at: string | null
          printed: boolean
          station_id: string | null
          table_label: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_scan_at?: string | null
          printed?: boolean
          station_id?: string | null
          table_label: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          last_scan_at?: string | null
          printed?: boolean
          station_id?: string | null
          table_label?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_tokens_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_trips: {
        Row: {
          active: boolean
          created_at: string
          days_of_week: number[]
          dest_favorite_id: string
          id: string
          last_triggered_at: string | null
          origin_favorite_id: string
          radius_km: number
          time_local: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          days_of_week: number[]
          dest_favorite_id: string
          id?: string
          last_triggered_at?: string | null
          origin_favorite_id: string
          radius_km?: number
          time_local: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          days_of_week?: number[]
          dest_favorite_id?: string
          id?: string
          last_triggered_at?: string | null
          origin_favorite_id?: string
          radius_km?: number
          time_local?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_trips_dest_favorite_id_fkey"
            columns: ["dest_favorite_id"]
            isOneToOne: false
            referencedRelation: "user_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_origin_favorite_id_fkey"
            columns: ["origin_favorite_id"]
            isOneToOne: false
            referencedRelation: "user_favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referral_attributions: {
        Row: {
          code: string
          created_at: string
          credited: boolean
          credited_tokens: number
          first_message_at: string
          id: string
          joiner_user_id: string
          reason: string | null
          sharer_user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          credited?: boolean
          credited_tokens?: number
          first_message_at: string
          id?: string
          joiner_user_id: string
          reason?: string | null
          sharer_user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          credited?: boolean
          credited_tokens?: number
          first_message_at?: string
          id?: string
          joiner_user_id?: string
          reason?: string | null
          sharer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_attributions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "referral_attributions_joiner_user_id_fkey"
            columns: ["joiner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "referral_attributions_sharer_user_id_fkey"
            columns: ["sharer_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referral_clicks: {
        Row: {
          clicked_at: string
          code: string | null
          country_guess: string | null
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          code?: string | null
          country_guess?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          code?: string | null
          country_guess?: string | null
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      referral_links: {
        Row: {
          active: boolean
          code: string
          created_at: string
          last_shared_at: string | null
          short_url: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          last_shared_at?: string | null
          short_url?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          last_shared_at?: string | null
          short_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      reliability_jobs: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          metadata: Json
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          metadata?: Json
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          metadata?: Json
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_menu_items: {
        Row: {
          bar_id: string
          category: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          menu_id: string | null
          name: string
          ocr_confidence: number | null
          ocr_extracted: boolean
          price: number
          updated_at: string
        }
        Insert: {
          bar_id: string
          category: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          menu_id?: string | null
          name: string
          ocr_confidence?: number | null
          ocr_extracted?: boolean
          price: number
          updated_at?: string
        }
        Update: {
          bar_id?: string
          category?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          menu_id?: string | null
          name?: string
          ocr_confidence?: number | null
          ocr_extracted?: boolean
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "published_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_candidates: {
        Row: {
          created_at: string | null
          currency: string | null
          driver_id: string | null
          driver_message: string | null
          eta_minutes: number | null
          id: string
          offer_price: number | null
          ride_id: string | null
          status: Database["public"]["Enums"]["candidate_status"] | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          driver_id?: string | null
          driver_message?: string | null
          eta_minutes?: number | null
          id?: string
          offer_price?: number | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["candidate_status"] | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          driver_id?: string | null
          driver_message?: string | null
          eta_minutes?: number | null
          id?: string
          offer_price?: number | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["candidate_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_candidates_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_candidates_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          contact_id: string | null
          created_at: string | null
          dropoff: unknown
          id: string
          pickup: unknown
          status: Database["public"]["Enums"]["ride_status"]
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_kind"]
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          dropoff?: unknown
          id?: string
          pickup: unknown
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_kind"]
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          dropoff?: unknown
          id?: string
          pickup?: unknown
          status?: Database["public"]["Enums"]["ride_status"]
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "rides_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "wa_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      router_destinations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          priority: number
          route_key: string
          slug: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          priority?: number
          route_key: string
          slug: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          priority?: number
          route_key?: string
          slug?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      router_idempotency: {
        Row: {
          created_at: string
          from_number: string | null
          message_id: string
        }
        Insert: {
          created_at?: string
          from_number?: string | null
          message_id: string
        }
        Update: {
          created_at?: string
          from_number?: string | null
          message_id?: string
        }
        Relationships: []
      }
      router_keyword_map: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          metadata: Json
          route_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          metadata?: Json
          route_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          metadata?: Json
          route_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      router_logs: {
        Row: {
          created_at: string
          id: string
          message_id: string
          metadata: Json
          route_key: string | null
          status_code: string
          text_snippet: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          metadata?: Json
          route_key?: string | null
          status_code: string
          text_snippet?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          metadata?: Json
          route_key?: string | null
          status_code?: string
          text_snippet?: string | null
        }
        Relationships: []
      }
      router_message_gate: {
        Row: {
          message_id: string
          metadata: Json
          processed_at: string
          route_key: string
          wa_from: string
        }
        Insert: {
          message_id: string
          metadata?: Json
          processed_at?: string
          route_key: string
          wa_from: string
        }
        Update: {
          message_id?: string
          metadata?: Json
          processed_at?: string
          route_key?: string
          wa_from?: string
        }
        Relationships: []
      }
      router_rate_limits: {
        Row: {
          count: number
          last_message_at: string
          sender: string
          window_start: string
        }
        Insert: {
          count?: number
          last_message_at?: string
          sender: string
          window_start: string
        }
        Update: {
          count?: number
          last_message_at?: string
          sender?: string
          window_start?: string
        }
        Relationships: []
      }
      router_telemetry: {
        Row: {
          created_at: string
          event: string
          id: number
          keyword: string | null
          message_id: string | null
          metadata: Json
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          keyword?: string | null
          message_id?: string | null
          metadata?: Json
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          keyword?: string | null
          message_id?: string | null
          metadata?: Json
        }
        Relationships: []
      }
      routes: {
        Row: {
          cached_until: string
          created_at: string
          destination_coordinates: unknown
          destination_location_id: string | null
          distance_meters: number
          duration_seconds: number
          id: string
          metadata: Json | null
          origin_coordinates: unknown
          origin_location_id: string | null
          path: unknown
          provider: string | null
          provider_route_id: string | null
          route_polyline: string | null
          traffic_multiplier: number | null
          waypoints: Json | null
        }
        Insert: {
          cached_until: string
          created_at?: string
          destination_coordinates: unknown
          destination_location_id?: string | null
          distance_meters: number
          duration_seconds: number
          id?: string
          metadata?: Json | null
          origin_coordinates: unknown
          origin_location_id?: string | null
          path?: unknown
          provider?: string | null
          provider_route_id?: string | null
          route_polyline?: string | null
          traffic_multiplier?: number | null
          waypoints?: Json | null
        }
        Update: {
          cached_until?: string
          created_at?: string
          destination_coordinates?: unknown
          destination_location_id?: string | null
          distance_meters?: number
          duration_seconds?: number
          id?: string
          metadata?: Json | null
          origin_coordinates?: unknown
          origin_location_id?: string | null
          path?: unknown
          provider?: string | null
          provider_route_id?: string | null
          route_polyline?: string | null
          traffic_multiplier?: number | null
          waypoints?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_campaigns: {
        Row: {
          channel: string
          completed_at: string | null
          created_at: string | null
          id: string
          message_template: string | null
          metadata: Json | null
          name: string
          optout_count: number | null
          rate_limit_per_day: number | null
          replied_count: number | null
          scheduled_at: string | null
          segment: string
          sent_count: number | null
          started_at: string | null
          status: string
          target_count: number | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          message_template?: string | null
          metadata?: Json | null
          name: string
          optout_count?: number | null
          rate_limit_per_day?: number | null
          replied_count?: number | null
          scheduled_at?: string | null
          segment: string
          sent_count?: number | null
          started_at?: string | null
          status?: string
          target_count?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          message_template?: string | null
          metadata?: Json | null
          name?: string
          optout_count?: number | null
          rate_limit_per_day?: number | null
          replied_count?: number | null
          scheduled_at?: string | null
          segment?: string
          sent_count?: number | null
          started_at?: string | null
          status?: string
          target_count?: number | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sales_contacts: {
        Row: {
          campaign_id: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          metadata: Json | null
          phone_number: string | null
          segment: string
        }
        Insert: {
          campaign_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          phone_number?: string | null
          segment: string
        }
        Update: {
          campaign_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          phone_number?: string | null
          segment?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sales_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_tasks: {
        Row: {
          campaign_id: string | null
          channel: string
          contact_id: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          message_sent: string | null
          metadata: Json | null
          notes: string | null
          replied_at: string | null
          reply_text: string | null
          sent_at: string | null
          status: string
          template: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel: string
          contact_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message_sent?: string | null
          metadata?: Json | null
          notes?: string | null
          replied_at?: string | null
          reply_text?: string | null
          sent_at?: string | null
          status?: string
          template?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel?: string
          contact_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message_sent?: string | null
          metadata?: Json | null
          notes?: string | null
          replied_at?: string | null
          reply_text?: string | null
          sent_at?: string | null
          status?: string
          template?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sales_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "sales_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_trips: {
        Row: {
          created_at: string | null
          dropoff_address: string | null
          dropoff_location: unknown
          flexibility_minutes: number | null
          id: string
          is_active: boolean | null
          last_processed: string | null
          matched_driver_id: string | null
          max_price: number | null
          next_run_at: string | null
          notes: string | null
          notification_minutes: number | null
          pickup_address: string | null
          pickup_location: unknown
          preferred_drivers: string[] | null
          recurrence: string | null
          scheduled_time: string
          status: string | null
          updated_at: string | null
          user_id: string
          vehicle_preference: string | null
        }
        Insert: {
          created_at?: string | null
          dropoff_address?: string | null
          dropoff_location: unknown
          flexibility_minutes?: number | null
          id?: string
          is_active?: boolean | null
          last_processed?: string | null
          matched_driver_id?: string | null
          max_price?: number | null
          next_run_at?: string | null
          notes?: string | null
          notification_minutes?: number | null
          pickup_address?: string | null
          pickup_location: unknown
          preferred_drivers?: string[] | null
          recurrence?: string | null
          scheduled_time: string
          status?: string | null
          updated_at?: string | null
          user_id: string
          vehicle_preference?: string | null
        }
        Update: {
          created_at?: string | null
          dropoff_address?: string | null
          dropoff_location?: unknown
          flexibility_minutes?: number | null
          id?: string
          is_active?: boolean | null
          last_processed?: string | null
          matched_driver_id?: string | null
          max_price?: number | null
          next_run_at?: string | null
          notes?: string | null
          notification_minutes?: number | null
          pickup_address?: string | null
          pickup_location?: unknown
          preferred_drivers?: string[] | null
          recurrence?: string | null
          scheduled_time?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
          vehicle_preference?: string | null
        }
        Relationships: []
      }
      segments: {
        Row: {
          created_at: string | null
          description: string | null
          filter: Json
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          filter?: Json
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          filter?: Json
          id?: number
          name?: string
        }
        Relationships: []
      }
      send_logs: {
        Row: {
          delivery_status: string | null
          error: string | null
          id: number
          msisdn_e164: string
          provider_msg_id: string | null
          queue_id: number | null
          sent_at: string | null
        }
        Insert: {
          delivery_status?: string | null
          error?: string | null
          id?: number
          msisdn_e164: string
          provider_msg_id?: string | null
          queue_id?: number | null
          sent_at?: string | null
        }
        Update: {
          delivery_status?: string | null
          error?: string | null
          id?: number
          msisdn_e164?: string
          provider_msg_id?: string | null
          queue_id?: number | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "send_logs_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "send_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      send_queue: {
        Row: {
          attempt: number | null
          id: number
          msisdn_e164: string
          next_attempt_at: string | null
          payload: Json
          status: string | null
        }
        Insert: {
          attempt?: number | null
          id?: number
          msisdn_e164: string
          next_attempt_at?: string | null
          payload: Json
          status?: string | null
        }
        Update: {
          attempt?: number | null
          id?: number
          msisdn_e164?: string
          next_attempt_at?: string | null
          payload?: Json
          status?: string | null
        }
        Relationships: []
      }
      service_registry: {
        Row: {
          capabilities: Json | null
          configuration: Json | null
          created_at: string
          dependencies: Json | null
          endpoint: string
          health_check_interval: number | null
          health_check_url: string | null
          id: string
          last_health_check_at: string | null
          last_heartbeat_at: string | null
          metadata: Json | null
          metrics: Json | null
          registered_by: string | null
          service_name: string
          service_type: string
          status: string | null
          updated_at: string
          version: string
        }
        Insert: {
          capabilities?: Json | null
          configuration?: Json | null
          created_at?: string
          dependencies?: Json | null
          endpoint: string
          health_check_interval?: number | null
          health_check_url?: string | null
          id?: string
          last_health_check_at?: string | null
          last_heartbeat_at?: string | null
          metadata?: Json | null
          metrics?: Json | null
          registered_by?: string | null
          service_name: string
          service_type: string
          status?: string | null
          updated_at?: string
          version: string
        }
        Update: {
          capabilities?: Json | null
          configuration?: Json | null
          created_at?: string
          dependencies?: Json | null
          endpoint?: string
          health_check_interval?: number | null
          health_check_url?: string | null
          id?: string
          last_health_check_at?: string | null
          last_heartbeat_at?: string | null
          metadata?: Json | null
          metrics?: Json | null
          registered_by?: string | null
          service_name?: string
          service_type?: string
          status?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          bar_id: string | null
          context: Json
          created_at: string
          current_flow: string | null
          flow_state: Json
          id: string
          last_interaction_at: string
          profile_id: string | null
          role: Database["public"]["Enums"]["session_role"]
          updated_at: string
          wa_id: string
        }
        Insert: {
          bar_id?: string | null
          context?: Json
          created_at?: string
          current_flow?: string | null
          flow_state?: Json
          id?: string
          last_interaction_at?: string
          profile_id?: string | null
          role: Database["public"]["Enums"]["session_role"]
          updated_at?: string
          wa_id: string
        }
        Update: {
          bar_id?: string | null
          context?: Json
          created_at?: string
          current_flow?: string | null
          flow_state?: Json
          id?: string
          last_interaction_at?: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["session_role"]
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_profile_fk"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      settings: {
        Row: {
          admin_whatsapp_numbers: string | null
          created_at: string | null
          id: number
          max_results: number
          momo_payee_number: string
          search_radius_km: number
          subscription_price: number
          support_phone_e164: string
          updated_at: string | null
        }
        Insert: {
          admin_whatsapp_numbers?: string | null
          created_at?: string | null
          id?: number
          max_results?: number
          momo_payee_number: string
          search_radius_km?: number
          subscription_price: number
          support_phone_e164: string
          updated_at?: string | null
        }
        Update: {
          admin_whatsapp_numbers?: string | null
          created_at?: string | null
          id?: number
          max_results?: number
          momo_payee_number?: string
          search_radius_km?: number
          subscription_price?: number
          support_phone_e164?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      shop_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          helpful_count: number | null
          id: string
          rating: number
          shop_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          rating: number
          shop_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          rating?: number
          shop_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          categories: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          location: unknown
          name: string
          opening_hours: string | null
          owner_id: string | null
          phone: string | null
          rating: number | null
          short_code: string
          status: string | null
          verified: boolean | null
          whatsapp_catalog_url: string | null
        }
        Insert: {
          categories?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: unknown
          name: string
          opening_hours?: string | null
          owner_id?: string | null
          phone?: string | null
          rating?: number | null
          short_code: string
          status?: string | null
          verified?: boolean | null
          whatsapp_catalog_url?: string | null
        }
        Update: {
          categories?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          location?: unknown
          name?: string
          opening_hours?: string | null
          owner_id?: string | null
          phone?: string | null
          rating?: number | null
          short_code?: string
          status?: string | null
          verified?: boolean | null
          whatsapp_catalog_url?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      station_numbers: {
        Row: {
          active: boolean
          created_at: string
          role: string
          station_id: string
          wa_e164: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          role?: string
          station_id: string
          wa_e164: string
        }
        Update: {
          active?: boolean
          created_at?: string
          role?: string
          station_id?: string
          wa_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_numbers_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "petrol_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          created_at: string
          engencode: string
          id: string
          location_point: unknown
          name: string
          owner_contact: string | null
          status: string
        }
        Insert: {
          created_at?: string
          engencode: string
          id?: string
          location_point?: unknown
          name: string
          owner_contact?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          engencode?: string
          id?: string
          location_point?: unknown
          name?: string
          owner_contact?: string | null
          status?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string | null
          expires_at: string | null
          id: number
          proof_url: string | null
          rejection_reason: string | null
          started_at: string | null
          status: string
          txn_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          expires_at?: string | null
          id?: number
          proof_url?: string | null
          rejection_reason?: string | null
          started_at?: string | null
          status: string
          txn_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          expires_at?: string | null
          id?: number
          proof_url?: string | null
          rejection_reason?: string | null
          started_at?: string | null
          status?: string
          txn_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      system_audit_logs: {
        Row: {
          action: string
          actor_identifier: string
          actor_type: string
          correlation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          session_id: string | null
          status: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_identifier: string
          actor_type: string
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          session_id?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_identifier?: string
          actor_type?: string
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          session_id?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_audit_logs_2026_04: {
        Row: {
          action: string
          actor_identifier: string
          actor_type: string
          correlation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          session_id: string | null
          status: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_identifier: string
          actor_type: string
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          session_id?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_identifier?: string
          actor_type?: string
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          session_id?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_audit_logs_2026_05: {
        Row: {
          action: string
          actor_identifier: string
          actor_type: string
          correlation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          new_data: Json | null
          old_data: Json | null
          request_id: string | null
          resource_id: string | null
          resource_type: string
          session_id: string | null
          status: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_identifier: string
          actor_type: string
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type: string
          session_id?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_identifier?: string
          actor_type?: string
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          new_data?: Json | null
          old_data?: Json | null
          request_id?: string | null
          resource_id?: string | null
          resource_type?: string
          session_id?: string | null
          status?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          service_name: string
          tags: Json | null
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          service_name: string
          tags?: Json | null
          unit?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          service_name?: string
          tags?: Json | null
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      system_metrics_2026_04: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          service_name: string
          tags: Json | null
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          service_name: string
          tags?: Json | null
          unit?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          service_name?: string
          tags?: Json | null
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      system_metrics_2026_05: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_name: string
          metric_type: string
          service_name: string
          tags: Json | null
          unit: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_type: string
          service_name: string
          tags?: Json | null
          unit?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_type?: string
          service_name?: string
          tags?: Json | null
          unit?: string | null
          value?: number
        }
        Relationships: []
      }
      transaction_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          new_status: string | null
          previous_status: string | null
          transaction_id: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          transaction_id: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          new_status?: string | null
          previous_status?: string | null
          transaction_id?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          description: string | null
          destination_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          initiated_at: string
          metadata: Json | null
          payment_method_id: string | null
          source_id: string | null
          status: string | null
          transaction_ref: string
          type: string
          updated_at: string
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          metadata?: Json | null
          payment_method_id?: string | null
          source_id?: string | null
          status?: string | null
          transaction_ref: string
          type: string
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          metadata?: Json | null
          payment_method_id?: string | null
          source_id?: string | null
          status?: string | null
          transaction_ref?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: []
      }
      transactions_2026_04: {
        Row: {
          amount: number
          category: string | null
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          description: string | null
          destination_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          initiated_at: string
          metadata: Json | null
          payment_method_id: string | null
          source_id: string | null
          status: string | null
          transaction_ref: string
          type: string
          updated_at: string
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          metadata?: Json | null
          payment_method_id?: string | null
          source_id?: string | null
          status?: string | null
          transaction_ref: string
          type: string
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          metadata?: Json | null
          payment_method_id?: string | null
          source_id?: string | null
          status?: string | null
          transaction_ref?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: []
      }
      transactions_2026_05: {
        Row: {
          amount: number
          category: string | null
          completed_at: string | null
          correlation_id: string | null
          created_at: string
          currency: string
          description: string | null
          destination_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          initiated_at: string
          metadata: Json | null
          payment_method_id: string | null
          source_id: string | null
          status: string | null
          transaction_ref: string
          type: string
          updated_at: string
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          metadata?: Json | null
          payment_method_id?: string | null
          source_id?: string | null
          status?: string | null
          transaction_ref: string
          type: string
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          completed_at?: string | null
          correlation_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          initiated_at?: string
          metadata?: Json | null
          payment_method_id?: string | null
          source_id?: string | null
          status?: string | null
          transaction_ref?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: []
      }
      transcripts: {
        Row: {
          call_id: string | null
          content: string | null
          id: string
          lang: string | null
          role: string | null
          t: string | null
        }
        Insert: {
          call_id?: string | null
          content?: string | null
          id?: string
          lang?: string | null
          role?: string | null
          t?: string | null
        }
        Update: {
          call_id?: string | null
          content?: string | null
          id?: string
          lang?: string | null
          role?: string | null
          t?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_patterns: {
        Row: {
          created_at: string | null
          day_of_week: number
          dropoff_location: unknown
          frequency_count: number | null
          hour: number
          id: string
          pickup_location: unknown
          user_id: string
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          dropoff_location?: unknown
          frequency_count?: number | null
          hour: number
          id?: string
          pickup_location?: unknown
          user_id: string
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          dropoff_location?: unknown
          frequency_count?: number | null
          hour?: number
          id?: string
          pickup_location?: unknown
          user_id?: string
          vehicle_type?: string | null
        }
        Relationships: []
      }
      trip_predictions: {
        Row: {
          accepted: boolean | null
          based_on_pattern_count: number | null
          confidence_score: number | null
          created_at: string | null
          id: string
          predicted_day_of_week: number | null
          predicted_hour: number | null
          predicted_route: Json | null
          suggested_at: string | null
          user_id: string | null
        }
        Insert: {
          accepted?: boolean | null
          based_on_pattern_count?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          predicted_day_of_week?: number | null
          predicted_hour?: number | null
          predicted_route?: Json | null
          suggested_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepted?: boolean | null
          based_on_pattern_count?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          predicted_day_of_week?: number | null
          predicted_hour?: number | null
          predicted_route?: Json | null
          suggested_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          agent_session_id: string | null
          auto_match_enabled: boolean | null
          created_at: string | null
          creator_user_id: string | null
          dropoff: unknown
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_lon: number | null
          dropoff_radius_m: number
          dropoff_text: string | null
          id: string
          pickup: unknown
          pickup_at: string
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_lon: number | null
          pickup_radius_m: number
          pickup_text: string | null
          recurrence_rule: string | null
          role: string | null
          scheduled_at: string | null
          status: string | null
          updated_at: string
          vehicle_type: string | null
        }
        Insert: {
          agent_session_id?: string | null
          auto_match_enabled?: boolean | null
          created_at?: string | null
          creator_user_id?: string | null
          dropoff?: unknown
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_lon?: number | null
          dropoff_radius_m?: number
          dropoff_text?: string | null
          id?: string
          pickup?: unknown
          pickup_at?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_lon?: number | null
          pickup_radius_m?: number
          pickup_text?: string | null
          recurrence_rule?: string | null
          role?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Update: {
          agent_session_id?: string | null
          auto_match_enabled?: boolean | null
          created_at?: string | null
          creator_user_id?: string | null
          dropoff?: unknown
          dropoff_lat?: number | null
          dropoff_lng?: number | null
          dropoff_lon?: number | null
          dropoff_radius_m?: number
          dropoff_text?: string | null
          id?: string
          pickup?: unknown
          pickup_at?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          pickup_lon?: number | null
          pickup_radius_m?: number
          pickup_text?: string | null
          recurrence_rule?: string | null
          role?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_agent_session_id_fkey"
            columns: ["agent_session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          address: string | null
          created_at: string
          geog: unknown
          id: string
          is_default: boolean
          kind: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          geog: unknown
          id?: string
          is_default?: boolean
          kind: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          geog?: unknown
          id?: string
          is_default?: boolean
          kind?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vehicle_insurance_certificates: {
        Row: {
          carte_jaune_expiry: string | null
          carte_jaune_number: string | null
          certificate_number: string | null
          certificate_url: string | null
          created_at: string | null
          id: string
          insurer_name: string | null
          is_valid: boolean | null
          licensed_to_carry: number | null
          make: string | null
          media_id: string | null
          model: string | null
          ocr_data: Json | null
          ocr_extracted_at: string | null
          policy_expiry: string
          policy_inception: string | null
          policy_number: string | null
          profile_id: string | null
          registration_plate: string | null
          updated_at: string | null
          usage: string | null
          validation_errors: string[] | null
          vehicle_plate: string | null
          vehicle_year: number | null
          vin_chassis: string | null
          whatsapp_e164: string
        }
        Insert: {
          carte_jaune_expiry?: string | null
          carte_jaune_number?: string | null
          certificate_number?: string | null
          certificate_url?: string | null
          created_at?: string | null
          id?: string
          insurer_name?: string | null
          is_valid?: boolean | null
          licensed_to_carry?: number | null
          make?: string | null
          media_id?: string | null
          model?: string | null
          ocr_data?: Json | null
          ocr_extracted_at?: string | null
          policy_expiry: string
          policy_inception?: string | null
          policy_number?: string | null
          profile_id?: string | null
          registration_plate?: string | null
          updated_at?: string | null
          usage?: string | null
          validation_errors?: string[] | null
          vehicle_plate?: string | null
          vehicle_year?: number | null
          vin_chassis?: string | null
          whatsapp_e164: string
        }
        Update: {
          carte_jaune_expiry?: string | null
          carte_jaune_number?: string | null
          certificate_number?: string | null
          certificate_url?: string | null
          created_at?: string | null
          id?: string
          insurer_name?: string | null
          is_valid?: boolean | null
          licensed_to_carry?: number | null
          make?: string | null
          media_id?: string | null
          model?: string | null
          ocr_data?: Json | null
          ocr_extracted_at?: string | null
          policy_expiry?: string
          policy_inception?: string | null
          policy_number?: string | null
          profile_id?: string | null
          registration_plate?: string | null
          updated_at?: string | null
          usage?: string | null
          validation_errors?: string[] | null
          vehicle_plate?: string | null
          vehicle_year?: number | null
          vin_chassis?: string | null
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_insurance_certificates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vendor_commissions: {
        Row: {
          amount_tokens: number
          broker_profile_id: string | null
          created_at: string
          id: string
          metadata: Json
          paid_at: string | null
          referral_id: string | null
          status: string
          vendor_profile_id: string
        }
        Insert: {
          amount_tokens?: number
          broker_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          referral_id?: string | null
          status?: string
          vendor_profile_id: string
        }
        Update: {
          amount_tokens?: number
          broker_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          referral_id?: string | null
          status?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_commissions_broker_profile_id_fkey"
            columns: ["broker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "vendor_commissions_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      vendor_quote_responses: {
        Row: {
          channel: string
          created_at: string | null
          id: string
          metadata: Json | null
          quote_id: string | null
          received_at: string | null
          request_message: string | null
          response_message: string | null
          response_parsed: Json | null
          sent_at: string | null
          session_id: string
          vendor_id: string
          vendor_type: string
        }
        Insert: {
          channel: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          quote_id?: string | null
          received_at?: string | null
          request_message?: string | null
          response_message?: string | null
          response_parsed?: Json | null
          sent_at?: string | null
          session_id: string
          vendor_id: string
          vendor_type: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          quote_id?: string | null
          received_at?: string | null
          request_message?: string | null
          response_message?: string | null
          response_parsed?: Json | null
          sent_at?: string | null
          session_id?: string
          vendor_id?: string
          vendor_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_quote_responses_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "agent_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quote_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          helpful_count: number | null
          id: string
          rating: number
          user_id: string | null
          vendor_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          rating: number
          user_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          rating?: number
          user_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          location: unknown
          metadata: Json | null
          name: string
          opening_hours: string | null
          owner_id: string | null
          phone: string | null
          rating: number | null
          status: string
          updated_at: string | null
          vendor_type: string
          verified: boolean | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          location: unknown
          metadata?: Json | null
          name: string
          opening_hours?: string | null
          owner_id?: string | null
          phone?: string | null
          rating?: number | null
          status?: string
          updated_at?: string | null
          vendor_type: string
          verified?: boolean | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          location?: unknown
          metadata?: Json | null
          name?: string
          opening_hours?: string | null
          owner_id?: string | null
          phone?: string | null
          rating?: number | null
          status?: string
          updated_at?: string | null
          vendor_type?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      video_approvals: {
        Row: {
          approved_at: string | null
          changes_requested_at: string | null
          created_at: string
          id: string
          job_id: string
          last_whatsapp_click_at: string | null
          metadata: Json
          recorded_at: string
          requested_changes: string | null
          reviewer_id: string | null
          reviewer_name: string | null
          status: string
          summary: string | null
          updated_at: string
          whatsapp_clicks: number
        }
        Insert: {
          approved_at?: string | null
          changes_requested_at?: string | null
          created_at?: string
          id?: string
          job_id: string
          last_whatsapp_click_at?: string | null
          metadata?: Json
          recorded_at?: string
          requested_changes?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          whatsapp_clicks?: number
        }
        Update: {
          approved_at?: string | null
          changes_requested_at?: string | null
          created_at?: string
          id?: string
          job_id?: string
          last_whatsapp_click_at?: string | null
          metadata?: Json
          recorded_at?: string
          requested_changes?: string | null
          reviewer_id?: string | null
          reviewer_name?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
          whatsapp_clicks?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_approvals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "video_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      video_jobs: {
        Row: {
          approvals_count: number
          campaign_id: string | null
          changes_requested_count: number
          created_at: string
          cta_variant: string | null
          hook_id: string | null
          hook_label: string | null
          id: string
          last_approval_at: string | null
          last_requested_change_at: string | null
          last_whatsapp_click_at: string | null
          metadata: Json
          notes: string | null
          render_cost_cents: number
          render_currency: string
          renders: number
          rights_expiry_at: string | null
          script_version: string | null
          slot: string
          status: string
          template_id: string | null
          template_label: string | null
          updated_at: string
          whatsapp_clicks: number
        }
        Insert: {
          approvals_count?: number
          campaign_id?: string | null
          changes_requested_count?: number
          created_at?: string
          cta_variant?: string | null
          hook_id?: string | null
          hook_label?: string | null
          id?: string
          last_approval_at?: string | null
          last_requested_change_at?: string | null
          last_whatsapp_click_at?: string | null
          metadata?: Json
          notes?: string | null
          render_cost_cents?: number
          render_currency?: string
          renders?: number
          rights_expiry_at?: string | null
          script_version?: string | null
          slot: string
          status?: string
          template_id?: string | null
          template_label?: string | null
          updated_at?: string
          whatsapp_clicks?: number
        }
        Update: {
          approvals_count?: number
          campaign_id?: string | null
          changes_requested_count?: number
          created_at?: string
          cta_variant?: string | null
          hook_id?: string | null
          hook_label?: string | null
          id?: string
          last_approval_at?: string | null
          last_requested_change_at?: string | null
          last_whatsapp_click_at?: string | null
          metadata?: Json
          notes?: string | null
          render_cost_cents?: number
          render_currency?: string
          renders?: number
          rights_expiry_at?: string | null
          script_version?: string | null
          slot?: string
          status?: string
          template_id?: string | null
          template_label?: string | null
          updated_at?: string
          whatsapp_clicks?: number
        }
        Relationships: []
      }
      video_performance: {
        Row: {
          approval_rate: number
          approvals: number
          changes_requested: number
          click_through_rate: number
          cost_per_render: number | null
          created_at: string
          cta_variant: string | null
          hook_id: string | null
          hook_label: string | null
          id: string
          insights: string | null
          interval: string
          interval_start: string
          job_id: string
          metadata: Json
          renders: number
          slot: string
          template_id: string | null
          template_label: string | null
          updated_at: string
          whatsapp_clicks: number
        }
        Insert: {
          approval_rate?: number
          approvals?: number
          changes_requested?: number
          click_through_rate?: number
          cost_per_render?: number | null
          created_at?: string
          cta_variant?: string | null
          hook_id?: string | null
          hook_label?: string | null
          id?: string
          insights?: string | null
          interval: string
          interval_start: string
          job_id: string
          metadata?: Json
          renders?: number
          slot: string
          template_id?: string | null
          template_label?: string | null
          updated_at?: string
          whatsapp_clicks?: number
        }
        Update: {
          approval_rate?: number
          approvals?: number
          changes_requested?: number
          click_through_rate?: number
          cost_per_render?: number | null
          created_at?: string
          cta_variant?: string | null
          hook_id?: string | null
          hook_label?: string | null
          id?: string
          insights?: string | null
          interval?: string
          interval_start?: string
          job_id?: string
          metadata?: Json
          renders?: number
          slot?: string
          template_id?: string | null
          template_label?: string | null
          updated_at?: string
          whatsapp_clicks?: number
        }
        Relationships: [
          {
            foreignKeyName: "video_performance_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "video_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_call_outcomes: {
        Row: {
          call_id: string | null
          created_at: string
          disposition: string | null
          id: string
          notes: string | null
          recorded_at: string
          status: string
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          disposition?: string | null
          id?: string
          notes?: string | null
          recorded_at?: string
          status: string
        }
        Update: {
          call_id?: string | null
          created_at?: string
          disposition?: string | null
          id?: string
          notes?: string | null
          recorded_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_outcomes_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_calls: {
        Row: {
          agent_profile: string | null
          agent_profile_confidence: string | null
          channel: string | null
          consent_obtained: boolean | null
          country: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          first_time_to_assistant_seconds: number | null
          from_e164: string | null
          handoff: boolean | null
          handoff_target: string | null
          id: string
          last_note: string | null
          lead_name: string | null
          lead_phone: string | null
          locale: string | null
          metadata: Json | null
          outcome: string | null
          project_id: string | null
          sip_session_id: string | null
          started_at: string | null
          status: string | null
          to_e164: string | null
          twilio_call_sid: string | null
        }
        Insert: {
          agent_profile?: string | null
          agent_profile_confidence?: string | null
          channel?: string | null
          consent_obtained?: boolean | null
          country?: string | null
          direction: string
          duration_seconds?: number | null
          ended_at?: string | null
          first_time_to_assistant_seconds?: number | null
          from_e164?: string | null
          handoff?: boolean | null
          handoff_target?: string | null
          id?: string
          last_note?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          locale?: string | null
          metadata?: Json | null
          outcome?: string | null
          project_id?: string | null
          sip_session_id?: string | null
          started_at?: string | null
          status?: string | null
          to_e164?: string | null
          twilio_call_sid?: string | null
        }
        Update: {
          agent_profile?: string | null
          agent_profile_confidence?: string | null
          channel?: string | null
          consent_obtained?: boolean | null
          country?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          first_time_to_assistant_seconds?: number | null
          from_e164?: string | null
          handoff?: boolean | null
          handoff_target?: string | null
          id?: string
          last_note?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          locale?: string | null
          metadata?: Json | null
          outcome?: string | null
          project_id?: string | null
          sip_session_id?: string | null
          started_at?: string | null
          status?: string | null
          to_e164?: string | null
          twilio_call_sid?: string | null
        }
        Relationships: []
      }
      voice_events: {
        Row: {
          call_id: string | null
          id: string
          payload: Json | null
          t: string | null
          type: string | null
        }
        Insert: {
          call_id?: string | null
          id?: string
          payload?: Json | null
          t?: string | null
          type?: string | null
        }
        Update: {
          call_id?: string | null
          id?: string
          payload?: Json | null
          t?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_followups: {
        Row: {
          call_id: string | null
          channel: string
          created_at: string
          id: string
          notes: string | null
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          call_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          call_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          notes?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_followups_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_memories: {
        Row: {
          country: string | null
          id: string
          last_seen_at: string | null
          msisdn: string | null
          prefs: Json | null
        }
        Insert: {
          country?: string | null
          id?: string
          last_seen_at?: string | null
          msisdn?: string | null
          prefs?: Json | null
        }
        Update: {
          country?: string | null
          id?: string
          last_seen_at?: string | null
          msisdn?: string | null
          prefs?: Json | null
        }
        Relationships: []
      }
      wa_contacts: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          locale: string | null
          phone_e164: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          locale?: string | null
          phone_e164: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          locale?: string | null
          phone_e164?: string
        }
        Relationships: []
      }
      wa_events: {
        Row: {
          created_at: string
          received_at: string
          wa_message_id: string
        }
        Insert: {
          created_at?: string
          received_at?: string
          wa_message_id: string
        }
        Update: {
          created_at?: string
          received_at?: string
          wa_message_id?: string
        }
        Relationships: []
      }
      wa_inbound: {
        Row: {
          from_msisdn: string | null
          received_at: string | null
          wa_msg_id: string
        }
        Insert: {
          from_msisdn?: string | null
          received_at?: string | null
          wa_msg_id: string
        }
        Update: {
          from_msisdn?: string | null
          received_at?: string | null
          wa_msg_id?: string
        }
        Relationships: []
      }
      wa_inbox: {
        Row: {
          created_at: string | null
          from_msisdn: string
          id: number
          payload: Json
          provider_msg_id: string | null
          to_msisdn: string | null
          type: string | null
          wa_timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          from_msisdn: string
          id?: number
          payload?: Json
          provider_msg_id?: string | null
          to_msisdn?: string | null
          type?: string | null
          wa_timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          from_msisdn?: string
          id?: number
          payload?: Json
          provider_msg_id?: string | null
          to_msisdn?: string | null
          type?: string | null
          wa_timestamp?: string | null
        }
        Relationships: []
      }
      wa_messages: {
        Row: {
          agent_display_name: string | null
          agent_profile: string | null
          content: string | null
          created_at: string | null
          direction: string
          id: string
          metadata: Json | null
          thread_id: string | null
        }
        Insert: {
          agent_display_name?: string | null
          agent_profile?: string | null
          content?: string | null
          created_at?: string | null
          direction: string
          id?: string
          metadata?: Json | null
          thread_id?: string | null
        }
        Update: {
          agent_display_name?: string | null
          agent_profile?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          metadata?: Json | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "wa_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_threads: {
        Row: {
          agent_display_name: string | null
          agent_profile: string | null
          call_id: string | null
          customer_msisdn: string | null
          id: string
          last_message_at: string | null
          metadata: Json | null
          state: string | null
          wa_conversation_id: string | null
        }
        Insert: {
          agent_display_name?: string | null
          agent_profile?: string | null
          call_id?: string | null
          customer_msisdn?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          state?: string | null
          wa_conversation_id?: string | null
        }
        Update: {
          agent_display_name?: string | null
          agent_profile?: string | null
          call_id?: string | null
          customer_msisdn?: string | null
          id?: string
          last_message_at?: string | null
          metadata?: Json | null
          state?: string | null
          wa_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_threads_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "voice_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_accounts: {
        Row: {
          balance_minor: number
          currency: string
          pending_minor: number
          profile_id: string
          tokens: number
          updated_at: string
        }
        Insert: {
          balance_minor?: number
          currency?: string
          pending_minor?: number
          profile_id: string
          tokens?: number
          updated_at?: string
        }
        Update: {
          balance_minor?: number
          currency?: string
          pending_minor?: number
          profile_id?: string
          tokens?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_earn_actions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          referral_code: string | null
          reward_tokens: number | null
          share_text: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          referral_code?: string | null
          reward_tokens?: number | null
          share_text?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          referral_code?: string | null
          reward_tokens?: number | null
          share_text?: string | null
          title?: string | null
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          created_at: string
          delta_tokens: number
          id: string
          meta: Json
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_tokens: number
          id?: string
          meta?: Json
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta_tokens?: number
          id?: string
          meta?: Json
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_promoters: {
        Row: {
          display_name: string | null
          id: string
          tokens: number
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          display_name?: string | null
          id?: string
          tokens?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          display_name?: string | null
          id?: string
          tokens?: number
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      wallet_redeem_options: {
        Row: {
          cost_tokens: number | null
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          is_active: boolean
          title: string | null
        }
        Insert: {
          cost_tokens?: number | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          title?: string | null
        }
        Update: {
          cost_tokens?: number | null
          created_at?: string
          description?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          title?: string | null
        }
        Relationships: []
      }
      wallet_redemptions: {
        Row: {
          cost_tokens: number
          created_at: string
          id: string
          meta: Json
          metadata: Json
          option_id: string | null
          processed_at: string | null
          processed_by: string | null
          profile_id: string | null
          requested_at: string
          reward_id: string
          reward_name: string
          status: string
          user_id: string
        }
        Insert: {
          cost_tokens: number
          created_at?: string
          id?: string
          meta?: Json
          metadata?: Json
          option_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          profile_id?: string | null
          requested_at?: string
          reward_id: string
          reward_name: string
          status?: string
          user_id: string
        }
        Update: {
          cost_tokens?: number
          created_at?: string
          id?: string
          meta?: Json
          metadata?: Json
          option_id?: string | null
          processed_at?: string | null
          processed_by?: string | null
          profile_id?: string | null
          requested_at?: string
          reward_id?: string
          reward_name?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_redemptions_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "wallet_redeem_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_redemptions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_redemptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_topups_momo: {
        Row: {
          amount_tokens: number
          completed_at: string | null
          created_at: string
          id: string
          metadata: Json
          momo_reference: string | null
          status: string
          vendor_profile_id: string
        }
        Insert: {
          amount_tokens?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          momo_reference?: string | null
          status?: string
          vendor_profile_id: string
        }
        Update: {
          amount_tokens?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          momo_reference?: string | null
          status?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_topups_momo_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount_minor: number
          currency: string
          description: string | null
          direction: string
          id: string
          occurred_at: string
          profile_id: string | null
        }
        Insert: {
          amount_minor: number
          currency?: string
          description?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          profile_id?: string | null
        }
        Update: {
          amount_minor?: number
          currency?: string
          description?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          endpoint: string
          error_message: string | null
          headers: Json
          id: number
          payload: Json
          received_at: string
          status_code: number | null
          wa_id: string | null
        }
        Insert: {
          endpoint: string
          error_message?: string | null
          headers?: Json
          id?: number
          payload?: Json
          received_at?: string
          status_code?: number | null
          wa_id?: string | null
        }
        Update: {
          endpoint?: string
          error_message?: string | null
          headers?: Json
          id?: number
          payload?: Json
          received_at?: string
          status_code?: number | null
          wa_id?: string | null
        }
        Relationships: []
      }
      whatsapp_home_menu_items: {
        Row: {
          active_countries: string[]
          country_specific_names: Json | null
          created_at: string
          display_order: number
          icon: string | null
          id: string
          is_active: boolean
          key: string
          menu_item_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          active_countries?: string[]
          country_specific_names?: Json | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          key: string
          menu_item_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          active_countries?: string[]
          country_specific_names?: Json | null
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          key?: string
          menu_item_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_intents: {
        Row: {
          audience: string
          category: string
          created_at: string
          description: string | null
          id: string
          metadata: Json
          payload_id: string
          template_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          category?: string
          created_at?: string
          description?: string | null
          id: string
          metadata?: Json
          payload_id: string
          template_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json
          payload_id?: string
          template_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_menu_items: {
        Row: {
          created_at: string
          description_override: string | null
          emoji: string | null
          id: string
          intent_id: string
          is_enabled: boolean
          menu_key: string
          position: number
          title_override: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_override?: string | null
          emoji?: string | null
          id?: string
          intent_id: string
          is_enabled?: boolean
          menu_key: string
          position: number
          title_override?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_override?: string | null
          emoji?: string | null
          id?: string
          intent_id?: string
          is_enabled?: boolean
          menu_key?: string
          position?: number
          title_override?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_menu_items_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_queue: {
        Row: {
          correlation_id: string | null
          created_at: string
          error_message: string | null
          id: string
          max_retries: number | null
          message_payload: Json
          message_type: string
          metadata: Json | null
          priority: number | null
          processed_at: string | null
          recipient_phone: string
          retry_count: number | null
          scheduled_at: string
          sent_at: string | null
          session_id: string | null
          status: string | null
          updated_at: string
          whatsapp_message_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message_payload: Json
          message_type: string
          metadata?: Json | null
          priority?: number | null
          processed_at?: string | null
          recipient_phone: string
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          session_id?: string | null
          status?: string | null
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message_payload?: Json
          message_type?: string
          metadata?: Json | null
          priority?: number | null
          processed_at?: string | null
          recipient_phone?: string
          retry_count?: number | null
          scheduled_at?: string
          sent_at?: string | null
          session_id?: string | null
          status?: string | null
          updated_at?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          created_at: string
          device_info: Json | null
          error_count: number | null
          expires_at: string | null
          id: string
          last_activity_at: string | null
          last_error: string | null
          last_error_at: string | null
          last_message_at: string | null
          message_count: number | null
          metadata: Json | null
          phone_number: string
          session_token: string
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          error_count?: number | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          phone_number: string
          session_token: string
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          error_count?: number | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          phone_number?: string
          session_token?: string
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          approval_status: string | null
          category: string
          created_at: string
          description: string | null
          domain: string
          id: string
          is_active: boolean | null
          locale: string
          meta_template_id: string | null
          metadata: Json | null
          retry_policy: Json | null
          template_key: string
          template_name: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          approval_status?: string | null
          category: string
          created_at?: string
          description?: string | null
          domain: string
          id?: string
          is_active?: boolean | null
          locale?: string
          meta_template_id?: string | null
          metadata?: Json | null
          retry_policy?: Json | null
          template_key: string
          template_name: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          approval_status?: string | null
          category?: string
          created_at?: string
          description?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          locale?: string
          meta_template_id?: string | null
          metadata?: Json | null
          retry_policy?: Json | null
          template_key?: string
          template_name?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      analytics_summary: {
        Row: {
          event_category: string | null
          event_count: number | null
          event_name: string | null
          last_event_at: string | null
          unique_users: number | null
        }
        Relationships: []
      }
      background_job_stats: {
        Row: {
          avg_duration_seconds: number | null
          failed_count: number | null
          job_count: number | null
          job_type: string | null
          status: string | null
        }
        Relationships: []
      }
      business_category_menu_view: {
        Row: {
          business_id: string | null
          business_name: string | null
          category_icon: string | null
          category_id: number | null
          category_name: string | null
          category_slug: string | null
          menu_active: boolean | null
          menu_countries: string[] | null
          menu_item_id: string | null
          menu_key: string | null
        }
        Relationships: []
      }
      cache_stats: {
        Row: {
          active_count: number | null
          avg_ttl_seconds: number | null
          cache_type: string | null
          entry_count: number | null
          expired_count: number | null
        }
        Relationships: []
      }
      client_settings: {
        Row: {
          created_at: string | null
          id: number | null
          max_results: number | null
          search_radius_km: number | null
          subscription_price: number | null
          support_phone_e164: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number | null
          max_results?: number | null
          search_radius_km?: number | null
          subscription_price?: number | null
          support_phone_e164?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number | null
          max_results?: number | null
          search_radius_km?: number | null
          subscription_price?: number | null
          support_phone_e164?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      configuration_summary: {
        Row: {
          config_count: number | null
          environment: string | null
          last_updated: string | null
          secret_count: number | null
          service_name: string | null
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          date: string | null
          event_category: string | null
          event_count: number | null
          event_name: string | null
          unique_sessions: number | null
          unique_users: number | null
        }
        Relationships: []
      }
      event_store_stats: {
        Row: {
          aggregate_type: string | null
          event_count: number | null
          event_type: string | null
          last_event_at: string | null
        }
        Relationships: []
      }
      feature_flag_overview: {
        Row: {
          enabled: boolean | null
          environment: string | null
          key: string | null
          name: string | null
          rollout_percentage: number | null
          rollout_strategy: string | null
          updated_at: string | null
        }
        Insert: {
          enabled?: boolean | null
          environment?: string | null
          key?: string | null
          name?: string | null
          rollout_percentage?: number | null
          rollout_strategy?: string | null
          updated_at?: string | null
        }
        Update: {
          enabled?: boolean | null
          environment?: string | null
          key?: string | null
          name?: string | null
          rollout_percentage?: number | null
          rollout_strategy?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      leaderboard_snapshots_v: {
        Row: {
          generated_at: string | null
          id: string | null
          top9: Json | null
          window: string | null
          your_rank_map: Json | null
        }
        Insert: {
          generated_at?: string | null
          id?: string | null
          top9?: Json | null
          window?: string | null
          your_rank_map?: Json | null
        }
        Update: {
          generated_at?: string | null
          id?: string | null
          top9?: Json | null
          window?: string | null
          your_rank_map?: Json | null
        }
        Relationships: []
      }
      menu_items_snapshot: {
        Row: {
          bar_id: string | null
          category_id: string | null
          currency: string | null
          flags: Json | null
          is_available: boolean | null
          item_id: string | null
          menu_id: string | null
          metadata: Json | null
          name: string | null
          price_minor: number | null
          short_description: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "published_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue_stats: {
        Row: {
          avg_retries: number | null
          message_count: number | null
          oldest_message: string | null
          queue_name: string | null
          status: string | null
        }
        Relationships: []
      }
      published_menus: {
        Row: {
          bar_id: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          published_at: string | null
          source: Database["public"]["Enums"]["menu_source"] | null
          source_file_ids: string[] | null
          status: Database["public"]["Enums"]["menu_status"] | null
          updated_at: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menus_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_metrics_by_service: {
        Row: {
          avg_value: number | null
          last_recorded_at: string | null
          max_value: number | null
          metric_name: string | null
          metric_type: string | null
          min_value: number | null
          sample_count: number | null
          service_name: string | null
        }
        Relationships: []
      }
      route_cache_stats: {
        Row: {
          active_count: number | null
          avg_distance_meters: number | null
          avg_duration_seconds: number | null
          provider: string | null
          route_count: number | null
        }
        Relationships: []
      }
      router_keyword_destinations: {
        Row: {
          destination_slug: string | null
          destination_url: string | null
          keyword: string | null
        }
        Relationships: []
      }
      service_health_overview: {
        Row: {
          health_status: string | null
          last_heartbeat_at: string | null
          seconds_since_heartbeat: number | null
          service_name: string | null
          service_type: string | null
          status: string | null
          version: string | null
        }
        Insert: {
          health_status?: never
          last_heartbeat_at?: string | null
          seconds_since_heartbeat?: never
          service_name?: string | null
          service_type?: string | null
          status?: string | null
          version?: string | null
        }
        Update: {
          health_status?: never
          last_heartbeat_at?: string | null
          seconds_since_heartbeat?: never
          service_name?: string | null
          service_type?: string | null
          status?: string | null
          version?: string | null
        }
        Relationships: []
      }
      transaction_summary: {
        Row: {
          avg_amount: number | null
          currency: string | null
          newest_transaction: string | null
          oldest_transaction: string | null
          status: string | null
          total_amount: number | null
          transaction_count: number | null
          type: string | null
        }
        Relationships: []
      }
      user_engagement_metrics: {
        Row: {
          first_event: string | null
          last_event: string | null
          session_count: number | null
          total_events: number | null
          unique_events: number | null
          user_id: string | null
        }
        Relationships: []
      }
      user_recent_transactions: {
        Row: {
          last_transaction_at: string | null
          total_credits: number | null
          total_debits: number | null
          transaction_count: number | null
          user_id: string | null
        }
        Relationships: []
      }
      voice_call_kpis: {
        Row: {
          average_duration_seconds: number | null
          channel: string | null
          completed_calls: number | null
          day: string | null
          failed_calls: number | null
          p95_assistant_seconds: number | null
          total_calls: number | null
        }
        Relationships: []
      }
      whatsapp_menu_by_country: {
        Row: {
          country_code: string | null
          country_name: string | null
          default_name: string | null
          display_order: number | null
          icon: string | null
          is_active: boolean | null
          localized_description: string | null
          localized_name: string | null
          menu_item_id: string | null
          menu_key: string | null
          mobile_money_brand: string | null
        }
        Relationships: []
      }
      whatsapp_menu_entries: {
        Row: {
          description: string | null
          emoji: string | null
          is_enabled: boolean | null
          menu_key: string | null
          payload_id: string | null
          position: number | null
          title: string | null
        }
        Relationships: []
      }
      whatsapp_queue_stats: {
        Row: {
          message_count: number | null
          newest_message: string | null
          oldest_message: string | null
          status: string | null
        }
        Relationships: []
      }
      whatsapp_session_stats: {
        Row: {
          avg_messages_per_session: number | null
          last_activity: string | null
          session_count: number | null
          status: string | null
          total_messages: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _drop_policy_if_exists: {
        Args: { pol_name: string; tbl: unknown }
        Returns: undefined
      }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      admin_sub_command: {
        Args: { _action: string; _actor: string; _reference: string }
        Returns: {
          status: string
        }[]
      }
      admin_sub_list_pending: {
        Args: { _limit?: number }
        Returns: {
          name: string
          reference: string
          submitted_at: string
        }[]
      }
      agent_doc_search_vec: {
        Args: { _agent_id: string; _embed: string; _top_k?: number }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          score: number
          storage_path: string
          title: string
        }[]
      }
      agent_vectors_summary: {
        Args: never
        Returns: {
          agent_id: string
          json_chunks: number
          ready_docs: number
          total_docs: number
          vec_chunks: number
        }[]
      }
      append_event: {
        Args: {
          p_aggregate_id: string
          p_aggregate_type: string
          p_correlation_id?: string
          p_event_type: string
          p_metadata?: Json
          p_payload: Json
        }
        Returns: string
      }
      auth_bar_id: { Args: never; Returns: string }
      auth_claim: { Args: { "": string }; Returns: string }
      auth_customer_id: { Args: never; Returns: string }
      auth_profile_id: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
      auth_wa_id: { Args: never; Returns: string }
      calculate_distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      calculate_next_retry: {
        Args: {
          p_base_seconds?: number
          p_max_seconds?: number
          p_retry_count: number
        }
        Returns: string
      }
      calculate_next_run: {
        Args: {
          p_current_time: string
          p_recurrence: string
          p_scheduled_time: string
        }
        Returns: string
      }
      check_similar_business_names: {
        Args: { p_name: string; p_owner_whatsapp?: string }
        Returns: {
          id: string
          is_own_business: boolean
          name: string
          owner_whatsapp: string
        }[]
      }
      cleanup_expired_cache: { Args: never; Returns: number }
      cleanup_expired_whatsapp_sessions: { Args: never; Returns: number }
      complete_job: {
        Args: { p_job_id: string; p_result?: Json }
        Returns: boolean
      }
      create_monthly_partition: {
        Args: { parent_table: string; partition_date: string }
        Returns: undefined
      }
      create_transaction: {
        Args: {
          p_amount: number
          p_currency?: string
          p_idempotency_key?: string
          p_metadata?: Json
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      daitch_mokotoff: { Args: { "": string }; Returns: string[] }
      dashboard_snapshot: { Args: never; Returns: Json }
      disablelongtransactions: { Args: never; Returns: string }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      enablelongtransactions: { Args: never; Returns: string }
      enqueue_message: {
        Args: {
          p_idempotency_key?: string
          p_message_type: string
          p_payload: Json
          p_priority?: number
          p_queue_name: string
          p_scheduled_at?: string
        }
        Returns: string
      }
      enqueue_whatsapp_message: {
        Args: {
          p_correlation_id?: string
          p_message_payload: Json
          p_message_type: string
          p_priority?: number
          p_recipient_phone: string
          p_scheduled_at?: string
        }
        Returns: string
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      extract_coordinates_from_google_maps_url: {
        Args: { url: string }
        Returns: {
          lat: number
          lng: number
        }[]
      }
      extract_coordinates_from_maps_url: {
        Args: { maps_url: string }
        Returns: {
          lat: number
          lng: number
        }[]
      }
      find_nearby_bars: {
        Args: {
          limit_count?: number
          radius_km?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          bar_id: string
          bar_name: string
          distance_km: number
          google_maps_url: string
          location_text: string
        }[]
      }
      find_nearby_businesses: {
        Args: {
          category_filter?: string
          limit_count?: number
          radius_km?: number
          user_lat: number
          user_lng: number
        }
        Returns: {
          business_id: string
          business_name: string
          catalog_url: string
          category_id: string
          distance_km: number
          location_text: string
        }[]
      }
      find_nearby_locations: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_location_type?: string
          p_radius_meters?: number
        }
        Returns: {
          address: string
          coordinates: unknown
          distance_meters: number
          id: string
          location_type: string
          user_id: string
        }[]
      }
      gate_pro_feature: {
        Args: { _user_id: string }
        Returns: {
          access: boolean
          credits_left: number
          used_credit: boolean
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_aggregate_events: {
        Args: {
          p_aggregate_id: string
          p_aggregate_type: string
          p_limit?: number
        }
        Returns: {
          created_at: string
          event_type: string
          event_version: number
          id: string
          payload: Json
        }[]
      }
      get_audit_trail: {
        Args: {
          p_limit?: number
          p_resource_id: string
          p_resource_type: string
        }
        Returns: {
          action: string
          correlation_id: string
          created_at: string
          id: string
          metadata: Json
          user_id: string
        }[]
      }
      get_cache: { Args: { p_key: string }; Returns: Json }
      get_cached_route: {
        Args: {
          p_dest_lat: number
          p_dest_lng: number
          p_max_age_minutes?: number
          p_origin_lat: number
          p_origin_lng: number
        }
        Returns: {
          distance_meters: number
          duration_seconds: number
          id: string
          is_cached: boolean
          route_polyline: string
        }[]
      }
      get_config: {
        Args: {
          p_config_key: string
          p_environment?: string
          p_service_name: string
        }
        Returns: Json
      }
      get_contact_locale: {
        Args: { p_fallback?: string; p_wa_id: string }
        Returns: string
      }
      get_events_by_correlation: {
        Args: { p_correlation_id: string; p_limit?: number }
        Returns: {
          created_at: string
          event_data: Json
          event_type: string
          id: string
          user_id: string
        }[]
      }
      get_expiring_agent_sessions: {
        Args: { minutes_threshold?: number }
        Returns: {
          deadline_at: string
          flow_type: string
          minutes_remaining: number
          quotes_count: number
          session_id: string
          status: string
          user_id: string
        }[]
      }
      get_notification_queue_stats: {
        Args: never
        Returns: {
          count: number
          oldest_queued: string
          status: string
        }[]
      }
      get_service_configs: {
        Args: {
          p_environment?: string
          p_include_secrets?: boolean
          p_service_name: string
        }
        Returns: {
          config_key: string
          config_value: Json
          description: string
          value_type: string
        }[]
      }
      get_template_by_key: {
        Args: {
          p_fallback_locale?: string
          p_locale?: string
          p_template_key: string
        }
        Returns: {
          category: string
          domain: string
          id: string
          retry_policy: Json
          template_name: string
          variables: Json
        }[]
      }
      get_user_travel_patterns: {
        Args: { p_days_back?: number; p_user_id: string }
        Returns: {
          average_frequency: number
          day_of_week: number
          hour: number
          most_common_vehicle: string
          trip_count: number
        }[]
      }
      get_user_wallet: {
        Args: { p_user_id: string }
        Returns: {
          balance: number
          currency: string
          last_transaction_at: string
          status: string
          wallet_id: string
        }[]
      }
      get_valid_vehicle_insurance: {
        Args: { p_plate: string }
        Returns: {
          id: string
          insurer_name: string
          is_valid: boolean
          policy_expiry: string
          policy_number: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      haversine_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      init_contact_preferences: {
        Args: { p_locale?: string; p_profile_id?: string; p_wa_id: string }
        Returns: string
      }
      insurance_queue_media: {
        Args: {
          _caption: string
          _mime_type: string
          _profile_id: string
          _storage_path: string
          _wa_id: string
        }
        Returns: undefined
      }
      invalidate_cache_by_tag: { Args: { p_tag: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_admin_reader: { Args: never; Returns: boolean }
      is_agent_session_expired: {
        Args: { session_id: string }
        Returns: boolean
      }
      is_feature_enabled: {
        Args: { p_environment?: string; p_flag_key: string; p_user_id?: string }
        Returns: boolean
      }
      is_in_quiet_hours: {
        Args: { p_check_time?: string; p_wa_id: string }
        Returns: boolean
      }
      is_opted_out: { Args: { p_wa_id: string }; Returns: boolean }
      km: { Args: { a: unknown; b: unknown }; Returns: number }
      log_audit_event: {
        Args: {
          p_action: string
          p_actor_identifier: string
          p_actor_type: string
          p_correlation_id?: string
          p_metadata?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: string
      }
      log_audit_event_enhanced: {
        Args: {
          p_action: string
          p_correlation_id?: string
          p_mask_pii?: boolean
          p_metadata?: Json
          p_resource_id: string
          p_resource_type: string
          p_user_id: string
        }
        Returns: string
      }
      log_notification_event: {
        Args: {
          p_details?: Json
          p_event_type: string
          p_notification_id: string
        }
        Returns: string
      }
      log_structured_event: {
        Args: {
          p_correlation_id?: string
          p_event_data?: Json
          p_event_type: string
          p_user_id?: string
        }
        Returns: string
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_driver_served: {
        Args: { driver_uuid: string; viewer_e164: string }
        Returns: undefined
      }
      mark_opted_out: {
        Args: { p_reason?: string; p_wa_id: string }
        Returns: boolean
      }
      mark_passenger_served: {
        Args: { trip_uuid: string; viewer_e164: string }
        Returns: undefined
      }
      mark_served: {
        Args: { _kind: string; _target_pk: string; _viewer: string }
        Returns: undefined
      }
      marketplace_add_business: {
        Args: {
          _catalog: string
          _description: string
          _lat: number
          _lng: number
          _name: string
          _owner: string
        }
        Returns: string
      }
      match_agent_document_chunks: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
          target_agent_id: string
        }
        Returns: {
          agent_id: string
          chunk_id: string
          chunk_index: number
          content: string
          document_id: string
          document_title: string
          similarity: number
        }[]
      }
      match_drivers: {
        Args: {
          p_limit?: number
          p_pickup_lat: number
          p_pickup_lng: number
          p_radius_km?: number
          p_vehicle_type?: string
        }
        Returns: {
          distance_km: number
          driver_name: string
          driver_user_id: string
          is_available: boolean
          rating: number
          vehicle_type: string
        }[]
      }
      match_drivers_for_trip_v2: {
        Args: {
          _limit?: number
          _prefer_dropoff?: boolean
          _radius_m?: number
          _trip_id: string
          _window_days?: number
        }
        Returns: {
          creator_user_id: string
          distance_km: number
          drop_bonus_m: number
          dropoff_text: string
          matched_at: string
          pickup_text: string
          ref_code: string
          trip_id: string
          whatsapp_e164: string
        }[]
      }
      match_passengers_for_trip_v2: {
        Args: {
          _limit?: number
          _prefer_dropoff?: boolean
          _radius_m?: number
          _trip_id: string
          _window_days?: number
        }
        Returns: {
          creator_user_id: string
          distance_km: number
          drop_bonus_m: number
          dropoff_text: string
          matched_at: string
          pickup_text: string
          ref_code: string
          trip_id: string
          whatsapp_e164: string
        }[]
      }
      match_search_candidates: {
        Args: {
          actor_kind: string
          dropoff_lat?: number
          dropoff_lng?: number
          limit_count?: number
          pickup_lat: number
          pickup_lng: number
          radius_km?: number
          require_dual?: boolean
        }
        Returns: {
          created_at: string
          dropoff_distance_km: number
          id: string
          kind: string
          pickup_distance_km: number
        }[]
      }
      mobility_buy_subscription: {
        Args: { _user_id: string }
        Returns: {
          expires_at: string
          message: string
          success: boolean
          wallet_balance: number
        }[]
      }
      nearby_businesses: {
        Args: { _lat: number; _limit?: number; _lng: number; _viewer: string }
        Returns: {
          description: string
          distance_km: number
          id: string
          location_text: string
          name: string
          owner_whatsapp: string
        }[]
      }
      nearest_drivers: {
        Args: {
          p_lat: number
          p_limit?: number
          p_lng: number
          p_vehicle: string
        }
        Returns: {
          distance_meters: number
          driver_id: string
          eta_minutes: number
        }[]
      }
      parse_plus_code_coordinates: {
        Args: { plus_code: string }
        Returns: {
          lat: number
          lng: number
        }[]
      }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      profile_ref_code: { Args: { _profile_id: string }; Returns: string }
      profile_wa: { Args: { _profile_id: string }; Returns: string }
      publish_agent_version: {
        Args: {
          _agent_id: string
          _env: Database["public"]["Enums"]["deploy_env"]
          _version_id: string
        }
        Returns: undefined
      }
      purge_expired_served: { Args: never; Returns: number }
      recent_businesses_near: {
        Args: {
          in_category_id: number
          in_lat: number
          in_lng: number
          in_max: number
          in_radius_km: number
        }
        Returns: {
          business_id: number
          created_at: string
          name: string
          owner_user_id: string
        }[]
      }
      recent_drivers_near:
        | {
            Args: {
              in_lat: number
              in_lng: number
              in_max: number
              in_radius_km: number
              in_vehicle_type: string
            }
            Returns: {
              last_seen: string
              ref_code: string
              user_id: string
              whatsapp_e164: string
            }[]
          }
        | {
            Args: {
              in_lat: number
              in_lng: number
              in_max: number
              in_radius_km: number
              in_vehicle_type: string
            }
            Returns: {
              last_seen: string
              ref_code: string
              whatsapp_e164: string
            }[]
          }
      recent_passenger_trips_near:
        | {
            Args: {
              in_lat: number
              in_lng: number
              in_max: number
              in_radius_km: number
              in_vehicle_type: string
            }
            Returns: {
              created_at: string
              creator_user_id: string
              trip_id: number
            }[]
          }
        | {
            Args: {
              in_lat: number
              in_lng: number
              in_max: number
              in_radius_km: number
              in_vehicle_type: string
            }
            Returns: {
              created_at: string
              ref_code: string
              trip_id: string
              whatsapp_e164: string
            }[]
          }
      record_metric:
        | {
            Args: {
              p_metric_name: string
              p_metric_type: string
              p_service_name: string
              p_tags?: Json
              p_unit?: string
              p_value: number
            }
            Returns: string
          }
        | {
            Args: { p_metadata?: Json; p_metric_name: string; p_value: number }
            Returns: undefined
          }
      record_trip: {
        Args: {
          p_creator_user_id: string
          p_distance_km?: number
          p_dropoff_address?: string
          p_dropoff_lat: number
          p_dropoff_lng: number
          p_fare_amount?: number
          p_metadata?: Json
          p_pickup_address?: string
          p_pickup_lat: number
          p_pickup_lng: number
          p_vehicle_type?: string
        }
        Returns: string
      }
      refresh_daily_metrics: { Args: never; Returns: undefined }
      refresh_menu_items_snapshot: { Args: never; Returns: undefined }
      refresh_video_performance: {
        Args: { job_uuid: string }
        Returns: undefined
      }
      register_service: {
        Args: {
          p_capabilities?: Json
          p_endpoint: string
          p_health_check_url?: string
          p_service_name: string
          p_service_type: string
          p_version: string
        }
        Returns: string
      }
      round: { Args: { ndigits: number; value: number }; Returns: number }
      router_check_rate_limit: {
        Args: {
          p_max_messages?: number
          p_now?: string
          p_sender: string
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
        }[]
      }
      router_claim_message: {
        Args: {
          p_message_id: string
          p_metadata?: Json
          p_route_key: string
          p_wa_from: string
        }
        Returns: boolean
      }
      router_enforce_rate_limit: {
        Args: { p_limit: number; p_sender: string; p_window_seconds: number }
        Returns: Json
      }
      safe_cast_uuid: { Args: { input: string }; Returns: string }
      schedule_job: {
        Args: {
          p_idempotency_key?: string
          p_job_name: string
          p_job_type: string
          p_payload: Json
          p_priority?: number
          p_scheduled_at?: string
        }
        Returns: string
      }
      search_businesses_by_location: {
        Args: {
          p_category_id?: number
          p_lat: number
          p_limit?: number
          p_lng: number
          p_max_distance_km?: number
        }
        Returns: {
          category_id: number
          description: string
          distance_meters: number
          id: string
          location_text: string
          name: string
        }[]
      }
      search_businesses_by_name_similarity: {
        Args: {
          match_count?: number
          min_similarity?: number
          query_embedding: string
        }
        Returns: {
          description: string
          id: string
          location_text: string
          name: string
          similarity: number
        }[]
      }
      search_live_market_candidates: {
        Args: {
          _actor_kind: string
          _dropoff_lat?: number
          _dropoff_lng?: number
          _limit?: number
          _pickup_lat: number
          _pickup_lng: number
          _radius_km?: number
        }
        Returns: {
          candidate_id: string
          candidate_kind: string
          candidate_user_id: string
          created_at: string
          dropoff_distance_km: number
          pickup_distance_km: number
        }[]
      }
      search_nearby_properties: {
        Args: {
          p_bedrooms?: number
          p_latitude: number
          p_longitude: number
          p_max_budget?: number
          p_min_budget?: number
          p_radius_km?: number
          p_rental_type?: string
        }
        Returns: {
          address: string
          amenities: string[]
          available_from: string
          bathrooms: number
          bedrooms: number
          distance: number
          id: string
          images: string[]
          owner_id: string
          owner_name: string
          price: number
          rental_type: string
          status: string
        }[]
      }
      search_nearby_shops: {
        Args: {
          p_category?: string
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_radius_km?: number
        }
        Returns: {
          categories: string[]
          description: string
          distance: number
          id: string
          name: string
          owner_id: string
          phone: string
          rating: number
          verified: boolean
          whatsapp_catalog_url: string
        }[]
      }
      search_nearby_vendors: {
        Args: {
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_radius_km?: number
          p_vendor_type: string
        }
        Returns: {
          description: string
          distance: number
          id: string
          metadata: Json
          name: string
          owner_id: string
          phone: string
          rating: number
          verified: boolean
        }[]
      }
      service_heartbeat: {
        Args: { p_metrics?: Json; p_service_name: string; p_status?: string }
        Returns: boolean
      }
      set_cache: {
        Args: {
          p_cache_type?: string
          p_key: string
          p_tags?: string[]
          p_ttl_seconds?: number
          p_value: Json
        }
        Returns: undefined
      }
      set_config: {
        Args: {
          p_config_key: string
          p_config_value: Json
          p_description?: string
          p_environment?: string
          p_is_secret?: boolean
          p_service_name: string
          p_value_type?: string
        }
        Returns: string
      }
      soundex: { Args: { "": string }; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      station_scope_matches: { Args: { target: string }; Returns: boolean }
      text_soundex: { Args: { "": string }; Returns: string }
      track_event: {
        Args: {
          p_context?: Json
          p_correlation_id?: string
          p_event_category?: string
          p_event_name: string
          p_properties?: Json
          p_session_id?: string
        }
        Returns: string
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_bars_coordinates_from_url: { Args: never; Returns: number }
      update_business_coordinates_from_url: { Args: never; Returns: number }
      update_transaction_status: {
        Args: {
          p_error_message?: string
          p_new_status: string
          p_transaction_id: string
        }
        Returns: boolean
      }
      update_wallet_balance: {
        Args: {
          p_amount: number
          p_description?: string
          p_metadata?: Json
          p_reference?: string
          p_transaction_type: string
          p_user_id: string
        }
        Returns: Json
      }
      update_whatsapp_session_activity: {
        Args: { p_increment_message_count?: boolean; p_phone_number: string }
        Returns: undefined
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_agent_doc_vector: {
        Args: {
          _chunk_index: number
          _content: string
          _document_id: string
          _embedding_json: Json
        }
        Returns: undefined
      }
      upsert_travel_pattern:
        | {
            Args: {
              p_day_of_week: number
              p_dropoff_location: unknown
              p_hour: number
              p_pickup_location: unknown
              p_user_id: string
              p_vehicle_type: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_day_of_week: number
              p_dropoff_location: unknown
              p_hour: number
              p_pickup_location: unknown
              p_user_id: string
              p_vehicle_type: string
            }
            Returns: undefined
          }
      upsert_video_performance_row: {
        Args: {
          approval_rate: number
          approvals: number
          bucket_interval: string
          bucket_start: string
          changes: number
          click_rate: number
          clicks: number
          cost_per_render: number
          insights: string
          job_row: Database["public"]["Tables"]["video_jobs"]["Row"]
          renders: number
        }
        Returns: undefined
      }
      wallet_apply_delta: {
        Args: {
          p_delta: number
          p_meta?: Json
          p_type?: string
          p_user_id: string
        }
        Returns: {
          balance_tokens: number
          ledger_id: string
        }[]
      }
      wallet_commission_pay: {
        Args: { _actor_vendor: string; _commission_id: string }
        Returns: {
          message: string
          success: boolean
          vendor_balance: number
        }[]
      }
      wallet_earn_actions: {
        Args: { _limit?: number; _profile_id: string }
        Returns: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          referral_code: string | null
          reward_tokens: number | null
          share_text: string | null
          title: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wallet_earn_actions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      wallet_momo_topup_credit: {
        Args: {
          _amount: number
          _metadata?: Json
          _reference: string
          _vendor_id: string
        }
        Returns: {
          message: string
          success: boolean
          vendor_balance: number
        }[]
      }
      wallet_redeem_execute: {
        Args: { _option_id: string; _profile_id: string }
        Returns: {
          balance_tokens: number
          message: string
          success: boolean
        }[]
      }
      wallet_redeem_options: {
        Args: { _profile_id: string }
        Returns: {
          cost_tokens: number | null
          created_at: string
          description: string | null
          id: string
          instructions: string | null
          is_active: boolean
          title: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wallet_redeem_options"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      wallet_summary: {
        Args: { _profile_id: string }
        Returns: {
          balance_minor: number
          currency: string
          pending_minor: number
          tokens: number
        }[]
      }
      wallet_top_promoters: {
        Args: { _limit?: number }
        Returns: {
          display_name: string
          tokens: number
          whatsapp: string
        }[]
      }
      wallet_transactions_recent: {
        Args: { _limit?: number; _profile_id: string }
        Returns: {
          amount_minor: number
          currency: string
          description: string | null
          direction: string
          id: string
          occurred_at: string
          profile_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "wallet_transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      wallet_transfer: {
        Args: {
          p_amount: number
          p_from: string
          p_meta?: Json
          p_reason?: string
          p_to: string
        }
        Returns: {
          from_balance: number
          ledger_from: string
          ledger_to: string
          to_balance: number
        }[]
      }
      wallet_vendor_summary: {
        Args: { _vendor_id: string }
        Returns: {
          pending_commissions_count: number
          pending_commissions_tokens: number
          recent: Json
          tokens: number
        }[]
      }
    }
    Enums: {
      agent_status: "draft" | "active" | "disabled"
      bar_contact_role: "manager" | "staff"
      candidate_status: "pending" | "accepted" | "rejected" | "timeout"
      cart_status: "open" | "locked" | "expired"
      deploy_env: "staging" | "production"
      doc_type: "logbook" | "yellow_card" | "old_policy" | "id_card" | "other"
      ingest_status: "pending" | "processing" | "ready" | "failed"
      insurance_status:
        | "collecting"
        | "ocr_pending"
        | "ready_review"
        | "submitted"
        | "completed"
        | "rejected"
      item_modifier_type: "single" | "multiple"
      menu_source: "ocr" | "manual"
      menu_status: "draft" | "published" | "archived"
      notification_status: "queued" | "sent" | "failed"
      ocr_job_status: "queued" | "processing" | "succeeded" | "failed"
      ocr_status: "pending" | "processing" | "done" | "failed"
      ride_status:
        | "searching"
        | "shortlisted"
        | "booked"
        | "completed"
        | "cancelled"
      run_status: "queued" | "running" | "succeeded" | "failed"
      session_role:
        | "customer"
        | "vendor"
        | "admin"
        | "system"
        | "vendor_manager"
        | "vendor_staff"
      sub_status: "pending_review" | "active" | "expired" | "rejected"
      vehicle_kind: "moto" | "sedan" | "suv" | "van" | "truck"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_status: ["draft", "active", "disabled"],
      bar_contact_role: ["manager", "staff"],
      candidate_status: ["pending", "accepted", "rejected", "timeout"],
      cart_status: ["open", "locked", "expired"],
      deploy_env: ["staging", "production"],
      doc_type: ["logbook", "yellow_card", "old_policy", "id_card", "other"],
      ingest_status: ["pending", "processing", "ready", "failed"],
      insurance_status: [
        "collecting",
        "ocr_pending",
        "ready_review",
        "submitted",
        "completed",
        "rejected",
      ],
      item_modifier_type: ["single", "multiple"],
      menu_source: ["ocr", "manual"],
      menu_status: ["draft", "published", "archived"],
      notification_status: ["queued", "sent", "failed"],
      ocr_job_status: ["queued", "processing", "succeeded", "failed"],
      ocr_status: ["pending", "processing", "done", "failed"],
      ride_status: [
        "searching",
        "shortlisted",
        "booked",
        "completed",
        "cancelled",
      ],
      run_status: ["queued", "running", "succeeded", "failed"],
      session_role: [
        "customer",
        "vendor",
        "admin",
        "system",
        "vendor_manager",
        "vendor_staff",
      ],
      sub_status: ["pending_review", "active", "expired", "rejected"],
      vehicle_kind: ["moto", "sedan", "suv", "van", "truck"],
    },
  },
} as const
