export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  app: {
    Tables: {
      accounts: {
        Row: {
          balance: number | null;
          created_at: string;
          currency: string;
          id: string;
          owner_id: string | null;
          owner_type: string;
          sacco_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          balance?: number | null;
          created_at?: string;
          currency?: string;
          id?: string;
          owner_id?: string | null;
          owner_type: string;
          sacco_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          balance?: number | null;
          created_at?: string;
          currency?: string;
          id?: string;
          owner_id?: string | null;
          owner_type?: string;
          sacco_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor: string | null;
          created_at: string;
          diff: Json | null;
          entity: string | null;
          entity_id: string | null;
          id: string;
          sacco_id: string | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          created_at?: string;
          diff?: Json | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          sacco_id?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          created_at?: string;
          diff?: Json | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          sacco_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      devices_trusted: {
        Row: {
          created_at: string;
          device_hash: string;
          device_label: string | null;
          expires_at: string;
          id: string;
          last_seen_at: string;
          metadata: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_hash: string;
          device_label?: string | null;
          expires_at?: string;
          id?: string;
          last_seen_at?: string;
          metadata?: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_hash?: string;
          device_label?: string | null;
          expires_at?: string;
          id?: string;
          last_seen_at?: string;
          metadata?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      financial_institutions: {
        Row: {
          created_at: string;
          district: string;
          id: string;
          kind: Database["app"]["Enums"]["financial_institution_kind"];
          metadata: Json;
          name: string;
          sacco_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          district: string;
          id?: string;
          kind: Database["app"]["Enums"]["financial_institution_kind"];
          metadata?: Json;
          name: string;
          sacco_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          district?: string;
          id?: string;
          kind?: Database["app"]["Enums"]["financial_institution_kind"];
          metadata?: Json;
          name?: string;
          sacco_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_institutions_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: true;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      ikimina: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
          sacco_id: string;
          settings_json: Json;
          status: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          sacco_id: string;
          settings_json?: Json;
          status?: string;
          type?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          sacco_id?: string;
          settings_json?: Json;
          status?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ikimina_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      import_files: {
        Row: {
          error: string | null;
          filename: string;
          id: string;
          sacco_id: string | null;
          status: string;
          type: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          error?: string | null;
          filename: string;
          id?: string;
          sacco_id?: string | null;
          status?: string;
          type: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          error?: string | null;
          filename?: string;
          id?: string;
          sacco_id?: string | null;
          status?: string;
          type?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "import_files_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount: number;
          created_at: string;
          credit_id: string;
          currency: string;
          debit_id: string;
          external_id: string | null;
          id: string;
          memo: string | null;
          sacco_id: string | null;
          value_date: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          credit_id: string;
          currency?: string;
          debit_id: string;
          external_id?: string | null;
          id?: string;
          memo?: string | null;
          sacco_id?: string | null;
          value_date?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          credit_id?: string;
          currency?: string;
          debit_id?: string;
          external_id?: string | null;
          id?: string;
          memo?: string | null;
          sacco_id?: string | null;
          value_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_credit_id_fkey";
            columns: ["credit_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_debit_id_fkey";
            columns: ["debit_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          ikimina_id: string;
          joined_at: string;
          member_code: string | null;
          msisdn: string;
          msisdn_encrypted: string | null;
          msisdn_hash: string | null;
          msisdn_masked: string | null;
          national_id: string | null;
          national_id_encrypted: string | null;
          national_id_hash: string | null;
          national_id_masked: string | null;
          sacco_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id?: string;
          ikimina_id: string;
          joined_at?: string;
          member_code?: string | null;
          msisdn: string;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          national_id?: string | null;
          national_id_encrypted?: string | null;
          national_id_hash?: string | null;
          national_id_masked?: string | null;
          sacco_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          ikimina_id?: string;
          joined_at?: string;
          member_code?: string | null;
          msisdn?: string;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          national_id?: string | null;
          national_id_encrypted?: string | null;
          national_id_hash?: string | null;
          national_id_masked?: string | null;
          sacco_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_ikimina_id_fkey";
            columns: ["ikimina_id"];
            isOneToOne: false;
            referencedRelation: "ikimina";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "members_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      mfa_email_codes: {
        Row: {
          attempt_count: number;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          salt: string;
          user_id: string;
        };
        Insert: {
          attempt_count?: number;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          salt: string;
          user_id: string;
        };
        Update: {
          attempt_count?: number;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          salt?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      momo_codes: {
        Row: {
          account_name: string | null;
          code: string;
          created_at: string;
          description: string | null;
          district: string;
          id: string;
          metadata: Json;
          provider: string;
          updated_at: string;
        };
        Insert: {
          account_name?: string | null;
          code: string;
          created_at?: string;
          description?: string | null;
          district: string;
          id?: string;
          metadata?: Json;
          provider?: string;
          updated_at?: string;
        };
        Update: {
          account_name?: string | null;
          code?: string;
          created_at?: string;
          description?: string | null;
          district?: string;
          id?: string;
          metadata?: Json;
          provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          ai_version: string | null;
          amount: number;
          channel: string;
          confidence: number | null;
          created_at: string;
          currency: string;
          id: string;
          ikimina_id: string | null;
          member_id: string | null;
          msisdn: string;
          msisdn_encrypted: string | null;
          msisdn_hash: string | null;
          msisdn_masked: string | null;
          occurred_at: string;
          reference: string | null;
          sacco_id: string;
          source_id: string | null;
          status: string;
          txn_id: string;
        };
        Insert: {
          ai_version?: string | null;
          amount: number;
          channel?: string;
          confidence?: number | null;
          created_at?: string;
          currency?: string;
          id?: string;
          ikimina_id?: string | null;
          member_id?: string | null;
          msisdn: string;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          occurred_at: string;
          reference?: string | null;
          sacco_id: string;
          source_id?: string | null;
          status?: string;
          txn_id: string;
        };
        Update: {
          ai_version?: string | null;
          amount?: number;
          channel?: string;
          confidence?: number | null;
          created_at?: string;
          currency?: string;
          id?: string;
          ikimina_id?: string | null;
          member_id?: string | null;
          msisdn?: string;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          occurred_at?: string;
          reference?: string | null;
          sacco_id?: string;
          source_id?: string | null;
          status?: string;
          txn_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_ikimina_id_fkey";
            columns: ["ikimina_id"];
            isOneToOne: false;
            referencedRelation: "ikimina";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sms_inbox";
            referencedColumns: ["id"];
          },
        ];
      };
      recon_exceptions: {
        Row: {
          created_at: string;
          id: string;
          note: string | null;
          payment_id: string;
          reason: string;
          resolved_at: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string | null;
          payment_id: string;
          reason: string;
          resolved_at?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string | null;
          payment_id?: string;
          reason?: string;
          resolved_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recon_exceptions_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      report_subscriptions: {
        Row: {
          created_at: string;
          created_by: string | null;
          delivery_day: number | null;
          delivery_hour: number;
          email: string;
          filters: Json;
          format: string;
          frequency: string;
          id: string;
          is_active: boolean;
          last_run_at: string | null;
          next_run_at: string;
          sacco_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          delivery_day?: number | null;
          delivery_hour?: number;
          email: string;
          filters?: Json;
          format: string;
          frequency: string;
          id?: string;
          is_active?: boolean;
          last_run_at?: string | null;
          next_run_at?: string;
          sacco_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          delivery_day?: number | null;
          delivery_hour?: number;
          email?: string;
          filters?: Json;
          format?: string;
          frequency?: string;
          id?: string;
          is_active?: boolean;
          last_run_at?: string | null;
          next_run_at?: string;
          sacco_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_subscriptions_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      saccos: {
        Row: {
          brand_color: string | null;
          category: string | null;
          created_at: string;
          district: string;
          email: string | null;
          id: string;
          logo_url: string | null;
          merchant_code: string | null;
          metadata: Json;
          name: string;
          province: string | null;
          search_document: unknown | null;
          search_slug: string | null;
          sector: string | null;
          sector_code: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          brand_color?: string | null;
          category?: string | null;
          created_at?: string;
          district: string;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          merchant_code?: string | null;
          metadata?: Json;
          name: string;
          province?: string | null;
          search_document?: unknown | null;
          search_slug?: string | null;
          sector?: string | null;
          sector_code: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          brand_color?: string | null;
          category?: string | null;
          created_at?: string;
          district?: string;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          merchant_code?: string | null;
          metadata?: Json;
          name?: string;
          province?: string | null;
          search_document?: unknown | null;
          search_slug?: string | null;
          sector?: string | null;
          sector_code?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sms_inbox: {
        Row: {
          confidence: number | null;
          created_at: string;
          error: string | null;
          id: string;
          msisdn: string | null;
          msisdn_encrypted: string | null;
          msisdn_hash: string | null;
          msisdn_masked: string | null;
          parse_source: string | null;
          parsed_json: Json | null;
          raw_text: string;
          received_at: string;
          sacco_id: string | null;
          status: string;
          vendor_meta: Json | null;
        };
        Insert: {
          confidence?: number | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          msisdn?: string | null;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          parse_source?: string | null;
          parsed_json?: Json | null;
          raw_text: string;
          received_at: string;
          sacco_id?: string | null;
          status?: string;
          vendor_meta?: Json | null;
        };
        Update: {
          confidence?: number | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          msisdn?: string | null;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          parse_source?: string | null;
          parsed_json?: Json | null;
          raw_text?: string;
          received_at?: string;
          sacco_id?: string | null;
          status?: string;
          vendor_meta?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "sms_inbox_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      user_profiles: {
        Row: {
          created_at: string;
          role: string;
          sacco_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          role?: string;
          sacco_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          role?: string;
          sacco_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_profiles_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      account_balance: {
        Args: { account_id: string };
        Returns: number;
      };
      account_sacco: {
        Args: { account_id: string };
        Returns: string;
      };
      current_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      current_sacco: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      member_sacco: {
        Args: { member_id: string };
        Returns: string;
      };
      payment_sacco: {
        Args: { payment_id: string };
        Returns: string;
      };
    };
    Enums: {
      financial_institution_kind: "SACCO" | "MICROFINANCE" | "INSURANCE" | "OTHER";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  app_helpers: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      slugify: {
        Args: { input: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      configuration: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          value?: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      group_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string | null;
          group_id: string;
          id: string;
          invitee_msisdn: string | null;
          invitee_user_id: string | null;
          status: Database["public"]["Enums"]["group_invite_status"] | null;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string | null;
          group_id: string;
          id?: string;
          invitee_msisdn?: string | null;
          invitee_user_id?: string | null;
          status?: Database["public"]["Enums"]["group_invite_status"] | null;
          token: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string | null;
          group_id?: string;
          id?: string;
          invitee_msisdn?: string | null;
          invitee_user_id?: string | null;
          status?: Database["public"]["Enums"]["group_invite_status"] | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "ibimina";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_invites_invitee_user_id_fkey";
            columns: ["invitee_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ikimina: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
          sacco_id: string;
          settings: Json;
          status: string;
          type: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
          sacco_id: string;
          settings?: Json;
          status?: string;
          type?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          sacco_id?: string;
          settings?: Json;
          status?: string;
          type?: string;
        };
        Relationships: [];
      };
      join_requests: {
        Row: {
          created_at: string | null;
          decided_at: string | null;
          decided_by: string | null;
          group_id: string;
          id: string;
          note: string | null;
          sacco_id: string;
          status: Database["public"]["Enums"]["join_request_status"] | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          group_id: string;
          id?: string;
          note?: string | null;
          sacco_id: string;
          status?: Database["public"]["Enums"]["join_request_status"] | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          group_id?: string;
          id?: string;
          note?: string | null;
          sacco_id?: string;
          status?: Database["public"]["Enums"]["join_request_status"] | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "join_requests_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "ibimina";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          full_name: string | null;
          id: string;
          ikimina_id: string;
          joined_at: string;
          member_code: string | null;
          msisdn: string | null;
          national_id: string | null;
          status: string;
          user_id: string | null;
        };
        Insert: {
          full_name?: string | null;
          id?: string;
          ikimina_id: string;
          joined_at?: string;
          member_code?: string | null;
          msisdn?: string | null;
          national_id?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          full_name?: string | null;
          id?: string;
          ikimina_id?: string;
          joined_at?: string;
          member_code?: string | null;
          msisdn?: string | null;
          national_id?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "members_ikimina_id_fkey";
            columns: ["ikimina_id"];
            isOneToOne: false;
            referencedRelation: "ikimina";
            referencedColumns: ["id"];
          },
        ];
      };
      members_app_profiles: {
        Row: {
          created_at: string | null;
          id_files: Json | null;
          id_number: string | null;
          id_type: Database["public"]["Enums"]["member_id_type"] | null;
          is_verified: boolean | null;
          lang: string | null;
          momo_msisdn: string;
          ocr_json: Json | null;
          updated_at: string | null;
          user_id: string;
          whatsapp_msisdn: string;
        };
        Insert: {
          created_at?: string | null;
          id_files?: Json | null;
          id_number?: string | null;
          id_type?: Database["public"]["Enums"]["member_id_type"] | null;
          is_verified?: boolean | null;
          lang?: string | null;
          momo_msisdn: string;
          ocr_json?: Json | null;
          updated_at?: string | null;
          user_id: string;
          whatsapp_msisdn: string;
        };
        Update: {
          created_at?: string | null;
          id_files?: Json | null;
          id_number?: string | null;
          id_type?: Database["public"]["Enums"]["member_id_type"] | null;
          is_verified?: boolean | null;
          lang?: string | null;
          momo_msisdn?: string;
          ocr_json?: Json | null;
          updated_at?: string | null;
          user_id?: string;
          whatsapp_msisdn?: string;
        };
        Relationships: [];
      };
      mfa_recovery_codes: {
        Row: {
          codes: string[];
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          codes?: string[];
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          codes?: string[];
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_codes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_queue: {
        Row: {
          attempts: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          event: string;
          id: string;
          last_attempt_at: string | null;
          last_error: string | null;
          payload: Json;
          payment_id: string | null;
          processed_at: string | null;
          retry_after: string | null;
          sacco_id: string | null;
          scheduled_for: string;
          status: string;
          template_id: string | null;
        };
        Insert: {
          attempts?: number;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          event: string;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          payload: Json;
          payment_id?: string | null;
          processed_at?: string | null;
          retry_after?: string | null;
          sacco_id?: string | null;
          scheduled_for?: string;
          status?: string;
          template_id?: string | null;
        };
        Update: {
          attempts?: number;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          event?: string;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          payload?: Json;
          payment_id?: string | null;
          processed_at?: string | null;
          retry_after?: string | null;
          sacco_id?: string | null;
          scheduled_for?: string;
          status?: string;
          template_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notification_queue_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_queue_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "sms_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string | null;
          id: string;
          payload: Json | null;
          read_at: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          payload?: Json | null;
          read_at?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          payload?: Json | null;
          read_at?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limit_counters: {
        Row: {
          hits: number;
          key: string;
          window_expires: string;
        };
        Insert: {
          hits?: number;
          key: string;
          window_expires?: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_expires?: string;
        };
        Relationships: [];
      };
      sms_templates: {
        Row: {
          body: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          sacco_id: string;
          tokens: Json;
          updated_at: string;
          version: number;
        };
        Insert: {
          body: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          sacco_id: string;
          tokens?: Json;
          updated_at?: string;
          version?: number;
        };
        Update: {
          body?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          sacco_id?: string;
          tokens?: Json;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sms_templates_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      system_metrics: {
        Row: {
          event: string;
          last_occurred: string | null;
          meta: Json | null;
          total: number;
        };
        Insert: {
          event: string;
          last_occurred?: string | null;
          meta?: Json | null;
          total?: number;
        };
        Update: {
          event?: string;
          last_occurred?: string | null;
          meta?: Json | null;
          total?: number;
        };
        Relationships: [];
      };
      trusted_devices: {
        Row: {
          created_at: string;
          device_fingerprint_hash: string;
          device_id: string;
          id: string;
          ip_prefix: string | null;
          last_used_at: string;
          user_agent_hash: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          device_fingerprint_hash: string;
          device_id: string;
          id?: string;
          ip_prefix?: string | null;
          last_used_at?: string;
          user_agent_hash: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          device_fingerprint_hash?: string;
          device_id?: string;
          id?: string;
          ip_prefix?: string | null;
          last_used_at?: string;
          user_agent_hash?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trusted_devices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_saccos: {
        Row: {
          created_at: string | null;
          sacco_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          sacco_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          sacco_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string | null;
          email: string;
          failed_mfa_count: number;
          id: string;
          last_mfa_step: number | null;
          last_mfa_success_at: string | null;
          mfa_backup_hashes: string[];
          mfa_enabled: boolean;
          mfa_enrolled_at: string | null;
          mfa_methods: string[];
          mfa_passkey_enrolled: boolean;
          mfa_secret_enc: string | null;
          role: Database["public"]["Enums"]["app_role"];
          sacco_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          failed_mfa_count?: number;
          id: string;
          last_mfa_step?: number | null;
          last_mfa_success_at?: string | null;
          mfa_backup_hashes?: string[];
          mfa_enabled?: boolean;
          mfa_enrolled_at?: string | null;
          mfa_methods?: string[];
          mfa_passkey_enrolled?: boolean;
          mfa_secret_enc?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          sacco_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          failed_mfa_count?: number;
          id?: string;
          last_mfa_step?: number | null;
          last_mfa_success_at?: string | null;
          mfa_backup_hashes?: string[];
          mfa_enabled?: boolean;
          mfa_enrolled_at?: string | null;
          mfa_methods?: string[];
          mfa_passkey_enrolled?: boolean;
          mfa_secret_enc?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          sacco_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      webauthn_credentials: {
        Row: {
          backed_up: boolean;
          created_at: string;
          credential_id: string;
          credential_public_key: string;
          device_type: string | null;
          friendly_name: string | null;
          id: string;
          last_used_at: string | null;
          sign_count: number;
          transports: string[];
          user_id: string;
        };
        Insert: {
          backed_up?: boolean;
          created_at?: string;
          credential_id: string;
          credential_public_key: string;
          device_type?: string | null;
          friendly_name?: string | null;
          id?: string;
          last_used_at?: string | null;
          sign_count?: number;
          transports?: string[];
          user_id: string;
        };
        Update: {
          backed_up?: boolean;
          created_at?: string;
          credential_id?: string;
          credential_public_key?: string;
          device_type?: string | null;
          friendly_name?: string | null;
          id?: string;
          last_used_at?: string | null;
          sign_count?: number;
          transports?: string[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webauthn_credentials_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      analytics_ikimina_monthly_mv: {
        Row: {
          active_member_count: number | null;
          code: string | null;
          contributing_members: number | null;
          ikimina_id: string | null;
          last_contribution_at: string | null;
          month_total: number | null;
          name: string | null;
          sacco_id: string | null;
          status: string | null;
          updated_at: string | null;
          refreshed_at: string | null;
        };
        Relationships: [];
      };
      analytics_member_last_payment_mv: {
        Row: {
          days_since_last: number | null;
          full_name: string | null;
          ikimina_id: string | null;
          ikimina_name: string | null;
          last_payment_at: string | null;
          member_code: string | null;
          member_id: string | null;
          msisdn: string | null;
          sacco_id: string | null;
          status: string | null;
          refreshed_at: string | null;
        };
        Relationships: [];
      };
      analytics_payment_rollups_mv: {
        Row: {
          latest_payment_at: string | null;
          month_total: number | null;
          refreshed_at: string | null;
          sacco_id: string | null;
          today_total: number | null;
          unallocated_count: number | null;
          week_total: number | null;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          balance: number | null;
          created_at: string | null;
          currency: string | null;
          id: string | null;
          owner_id: string | null;
          owner_type: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          balance?: number | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string | null;
          owner_id?: string | null;
          owner_type?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          balance?: number | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string | null;
          owner_id?: string | null;
          owner_type?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string | null;
          actor_id: string | null;
          created_at: string | null;
          diff_json: Json | null;
          entity: string | null;
          entity_id: string | null;
          id: string | null;
          sacco_id: string | null;
        };
        Insert: {
          action?: string | null;
          actor_id?: string | null;
          created_at?: string | null;
          diff_json?: Json | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string | null;
          sacco_id?: string | null;
        };
        Update: {
          action?: string | null;
          actor_id?: string | null;
          created_at?: string | null;
          diff_json?: Json | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string | null;
          sacco_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      ibimina: {
        Row: {
          code: string | null;
          created_at: string | null;
          id: string | null;
          name: string | null;
          sacco_id: string | null;
          settings_json: Json | null;
          status: string | null;
          type: string | null;
          updated_at: string | null;
        };
        Insert: {
          code?: string | null;
          created_at?: string | null;
          id?: string | null;
          name?: string | null;
          sacco_id?: string | null;
          settings_json?: Json | null;
          status?: string | null;
          type?: string | null;
          updated_at?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string | null;
          id?: string | null;
          name?: string | null;
          sacco_id?: string | null;
          settings_json?: Json | null;
          status?: string | null;
          type?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ikimina_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
      ikimina_members: {
        Row: {
          created_at: string | null;
          full_name: string | null;
          id: string | null;
          ikimina_id: string | null;
          joined_at: string | null;
          member_code: string | null;
          msisdn: string | null;
          msisdn_encrypted: string | null;
          msisdn_hash: string | null;
          msisdn_masked: string | null;
          national_id: string | null;
          national_id_encrypted: string | null;
          national_id_hash: string | null;
          national_id_masked: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          full_name?: string | null;
          id?: string | null;
          ikimina_id?: string | null;
          joined_at?: string | null;
          member_code?: string | null;
          msisdn?: string | null;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          national_id?: string | null;
          national_id_encrypted?: string | null;
          national_id_hash?: string | null;
          national_id_masked?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          full_name?: string | null;
          id?: string | null;
          ikimina_id?: string | null;
          joined_at?: string | null;
          member_code?: string | null;
          msisdn?: string | null;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          national_id?: string | null;
          national_id_encrypted?: string | null;
          national_id_hash?: string | null;
          national_id_masked?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "members_ikimina_id_fkey";
            columns: ["ikimina_id"];
            isOneToOne: false;
            referencedRelation: "ibimina";
            referencedColumns: ["id"];
          },
        ];
      };
      ikimina_members_public: {
        Row: {
          full_name: string | null;
          id: string | null;
          ikimina_id: string | null;
          ikimina_name: string | null;
          joined_at: string | null;
          member_code: string | null;
          msisdn: string | null;
          national_id: string | null;
          sacco_id: string | null;
          status: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ikimina_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "members_ikimina_id_fkey";
            columns: ["ikimina_id"];
            isOneToOne: false;
            referencedRelation: "ibimina";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount: number | null;
          created_at: string | null;
          credit_id: string | null;
          currency: string | null;
          debit_id: string | null;
          external_id: string | null;
          id: string | null;
          memo: string | null;
          value_date: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string | null;
          credit_id?: string | null;
          currency?: string | null;
          debit_id?: string | null;
          external_id?: string | null;
          id?: string | null;
          memo?: string | null;
          value_date?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string | null;
          credit_id?: string | null;
          currency?: string | null;
          debit_id?: string | null;
          external_id?: string | null;
          id?: string | null;
          memo?: string | null;
          value_date?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_credit_id_fkey";
            columns: ["credit_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_debit_id_fkey";
            columns: ["debit_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          ai_version: string | null;
          amount: number | null;
          channel: string | null;
          confidence: number | null;
          created_at: string | null;
          currency: string | null;
          id: string | null;
          ikimina_id: string | null;
          member_id: string | null;
          msisdn: string | null;
          msisdn_encrypted: string | null;
          msisdn_hash: string | null;
          msisdn_masked: string | null;
          occurred_at: string | null;
          reference: string | null;
          sacco_id: string | null;
          source_id: string | null;
          status: string | null;
          txn_id: string | null;
        };
        Insert: {
          ai_version?: string | null;
          amount?: number | null;
          channel?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string | null;
          ikimina_id?: string | null;
          member_id?: string | null;
          msisdn?: string | null;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          occurred_at?: string | null;
          reference?: string | null;
          sacco_id?: string | null;
          source_id?: string | null;
          status?: string | null;
          txn_id?: string | null;
        };
        Update: {
          ai_version?: string | null;
          amount?: number | null;
          channel?: string | null;
          confidence?: number | null;
          created_at?: string | null;
          currency?: string | null;
          id?: string | null;
          ikimina_id?: string | null;
          member_id?: string | null;
          msisdn?: string | null;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          occurred_at?: string | null;
          reference?: string | null;
          sacco_id?: string | null;
          source_id?: string | null;
          status?: string | null;
          txn_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_ikimina_id_fkey";
            columns: ["ikimina_id"];
            isOneToOne: false;
            referencedRelation: "ibimina";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "ikimina_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "ikimina_members_public";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sms_inbox";
            referencedColumns: ["id"];
          },
        ];
      };
      saccos: {
        Row: {
          brand_color: string | null;
          category: string | null;
          created_at: string | null;
          district: string | null;
          email: string | null;
          id: string | null;
          logo_url: string | null;
          name: string | null;
          province: string | null;
          search_document: unknown | null;
          search_slug: string | null;
          sector: string | null;
          sector_code: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          brand_color?: string | null;
          category?: string | null;
          created_at?: string | null;
          district?: string | null;
          email?: string | null;
          id?: string | null;
          logo_url?: string | null;
          name?: string | null;
          province?: string | null;
          search_document?: unknown | null;
          search_slug?: string | null;
          sector?: string | null;
          sector_code?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          brand_color?: string | null;
          category?: string | null;
          created_at?: string | null;
          district?: string | null;
          email?: string | null;
          id?: string | null;
          logo_url?: string | null;
          name?: string | null;
          province?: string | null;
          search_document?: unknown | null;
          search_slug?: string | null;
          sector?: string | null;
          sector_code?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      sms_inbox: {
        Row: {
          confidence: number | null;
          created_at: string | null;
          error: string | null;
          id: string | null;
          msisdn: string | null;
          msisdn_encrypted: string | null;
          msisdn_hash: string | null;
          msisdn_masked: string | null;
          parse_source: string | null;
          parsed_json: Json | null;
          raw_text: string | null;
          received_at: string | null;
          sacco_id: string | null;
          status: string | null;
          vendor_meta: Json | null;
        };
        Insert: {
          confidence?: number | null;
          created_at?: string | null;
          error?: string | null;
          id?: string | null;
          msisdn?: string | null;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          parse_source?: string | null;
          parsed_json?: Json | null;
          raw_text?: string | null;
          received_at?: string | null;
          sacco_id?: string | null;
          status?: string | null;
          vendor_meta?: Json | null;
        };
        Update: {
          confidence?: number | null;
          created_at?: string | null;
          error?: string | null;
          id?: string | null;
          msisdn?: string | null;
          msisdn_encrypted?: string | null;
          msisdn_hash?: string | null;
          msisdn_masked?: string | null;
          parse_source?: string | null;
          parsed_json?: Json | null;
          raw_text?: string | null;
          received_at?: string | null;
          sacco_id?: string | null;
          status?: string | null;
          vendor_meta?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "sms_inbox_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      account_balance: {
        Args: { account_id: string };
        Returns: number;
      };
      can_user_access_account: {
        Args: { _account_id: string; _user_id: string };
        Returns: boolean;
      };
      consume_rate_limit: {
        Args: { p_key: string; p_max_hits: number; p_window_seconds: number };
        Returns: boolean;
      };
      consume_route_rate_limit: {
        Args: {
          bucket_key: string;
          max_hits: number;
          route: string;
          window_seconds: number;
        };
        Returns: boolean;
      };
      current_user_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_user_sacco: {
        Args: { _user_id: string };
        Returns: string;
      };
      gtrgm_compress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gtrgm_decompress: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gtrgm_in: {
        Args: { "": unknown };
        Returns: unknown;
      };
      gtrgm_options: {
        Args: { "": unknown };
        Returns: undefined;
      };
      gtrgm_out: {
        Args: { "": unknown };
        Returns: unknown;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      increment_metric: {
        Args: { delta: number; event_name: string; meta?: Json };
        Returns: undefined;
      };
      is_user_member_of_group: {
        Args: { gid: string };
        Returns: boolean;
      };
      search_saccos: {
        Args: {
          district_filter?: string;
          limit_count?: number;
          province_filter?: string;
          query: string;
        };
        Returns: {
          category: string;
          district: string;
          email: string;
          id: string;
          name: string;
          province: string;
          rank_score: number;
          sector: string;
          similarity_score: number;
        }[];
      };
      search_saccos_trgm: {
        Args: { q: string };
        Returns: {
          district: string;
          id: string;
          name: string;
          sector_code: string;
          similarity: number;
        }[];
      };
      set_limit: {
        Args: { "": number };
        Returns: number;
      };
      show_limit: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      show_trgm: {
        Args: { "": string };
        Returns: string[];
      };
      sum_group_deposits: {
        Args: { gid: string };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "SYSTEM_ADMIN" | "SACCO_MANAGER" | "SACCO_STAFF" | "SACCO_VIEWER";
      group_invite_status: "sent" | "accepted" | "expired";
      invite_status: "sent" | "accepted" | "expired";
      join_request_status: "pending" | "approved" | "rejected";
      join_status: "pending" | "approved" | "rejected";
      member_id_type: "NID" | "DL" | "PASSPORT";
      notification_channel: "WHATSAPP" | "EMAIL";
      notification_type: "new_member" | "payment_confirmed" | "invite_accepted";
      notify_type: "new_member" | "payment_confirmed" | "invite_accepted";
      payment_status: "pending" | "completed" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  app: {
    Enums: {},
  },
  app_helpers: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["SYSTEM_ADMIN", "SACCO_MANAGER", "SACCO_STAFF", "SACCO_VIEWER"],
      group_invite_status: ["sent", "accepted", "expired"],
      invite_status: ["sent", "accepted", "expired"],
      join_request_status: ["pending", "approved", "rejected"],
      join_status: ["pending", "approved", "rejected"],
      member_id_type: ["NID", "DL", "PASSPORT"],
      notification_type: ["new_member", "payment_confirmed", "invite_accepted"],
      notify_type: ["new_member", "payment_confirmed", "invite_accepted"],
      payment_status: ["pending", "completed", "failed"],
    },
  },
} as const;
