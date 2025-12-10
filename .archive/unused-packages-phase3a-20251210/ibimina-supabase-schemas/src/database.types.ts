export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      agent_events: {
        Row: {
          agent_type: string;
          created_at: string;
          id: string;
          payload: Json;
          session_id: string | null;
        };
        Insert: {
          agent_type: string;
          created_at?: string;
          id?: string;
          payload?: Json;
          session_id?: string | null;
        };
        Update: {
          agent_type?: string;
          created_at?: string;
          id?: string;
          payload?: Json;
          session_id?: string | null;
        };
        Relationships: [];
      };
      allocations: {
        Row: {
          amount: number;
          country_id: string | null;
          created_at: string;
          decoded_district: string | null;
          decoded_group: string | null;
          decoded_member: string | null;
          decoded_sacco: string | null;
          id: string;
          match_status: string;
          momo_txn_id: string;
          notes: string | null;
          org_id: string;
          payer_msisdn: string | null;
          raw_ref: string | null;
          sacco_name: string | null;
          ts: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          country_id?: string | null;
          created_at?: string;
          decoded_district?: string | null;
          decoded_group?: string | null;
          decoded_member?: string | null;
          decoded_sacco?: string | null;
          id?: string;
          match_status?: string;
          momo_txn_id: string;
          notes?: string | null;
          org_id: string;
          payer_msisdn?: string | null;
          raw_ref?: string | null;
          sacco_name?: string | null;
          ts: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          country_id?: string | null;
          created_at?: string;
          decoded_district?: string | null;
          decoded_group?: string | null;
          decoded_member?: string | null;
          decoded_sacco?: string | null;
          id?: string;
          match_status?: string;
          momo_txn_id?: string;
          notes?: string | null;
          org_id?: string;
          payer_msisdn?: string | null;
          raw_ref?: string | null;
          sacco_name?: string | null;
          ts?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "allocations_country_fk";
            columns: ["country_id"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_events: {
        Row: {
          created_at: string | null;
          duration_seconds: number | null;
          event_type: string;
          id: string;
          ikimina_id: string | null;
          metadata: Json | null;
          occurred_at: string;
          payment_id: string | null;
          related_event_id: string | null;
          sacco_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          duration_seconds?: number | null;
          event_type: string;
          id?: string;
          ikimina_id?: string | null;
          metadata?: Json | null;
          occurred_at?: string;
          payment_id?: string | null;
          related_event_id?: string | null;
          sacco_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          duration_seconds?: number | null;
          event_type?: string;
          id?: string;
          ikimina_id?: string | null;
          metadata?: Json | null;
          occurred_at?: string;
          payment_id?: string | null;
          related_event_id?: string | null;
          sacco_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      auth_logs: {
        Row: {
          biometric_used: boolean | null;
          browser_fingerprint: string | null;
          created_at: string;
          device_id: string | null;
          error_message: string | null;
          event_type: string;
          id: string;
          ip_address: string | null;
          metadata: Json | null;
          session_id: string | null;
          staff_id: string | null;
          success: boolean | null;
        };
        Insert: {
          biometric_used?: boolean | null;
          browser_fingerprint?: string | null;
          created_at?: string;
          device_id?: string | null;
          error_message?: string | null;
          event_type: string;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          session_id?: string | null;
          staff_id?: string | null;
          success?: boolean | null;
        };
        Update: {
          biometric_used?: boolean | null;
          browser_fingerprint?: string | null;
          created_at?: string;
          device_id?: string | null;
          error_message?: string | null;
          event_type?: string;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          session_id?: string | null;
          staff_id?: string | null;
          success?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "auth_logs_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_qr_sessions: {
        Row: {
          authenticated_at: string | null;
          biometric_verified: boolean | null;
          browser_fingerprint: string | null;
          challenge: string;
          created_at: string;
          device_id: string | null;
          expires_at: string;
          id: string;
          ip_address: string | null;
          session_id: string;
          signature: string | null;
          staff_id: string | null;
          status: string;
          token_expires_at: string | null;
          web_access_token: string | null;
          web_refresh_token: string | null;
        };
        Insert: {
          authenticated_at?: string | null;
          biometric_verified?: boolean | null;
          browser_fingerprint?: string | null;
          challenge: string;
          created_at?: string;
          device_id?: string | null;
          expires_at: string;
          id?: string;
          ip_address?: string | null;
          session_id: string;
          signature?: string | null;
          staff_id?: string | null;
          status: string;
          token_expires_at?: string | null;
          web_access_token?: string | null;
          web_refresh_token?: string | null;
        };
        Update: {
          authenticated_at?: string | null;
          biometric_verified?: boolean | null;
          browser_fingerprint?: string | null;
          challenge?: string;
          created_at?: string;
          device_id?: string | null;
          expires_at?: string;
          id?: string;
          ip_address?: string | null;
          session_id?: string;
          signature?: string | null;
          staff_id?: string | null;
          status?: string;
          token_expires_at?: string | null;
          web_access_token?: string | null;
          web_refresh_token?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "auth_qr_sessions_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      campaign_target_archives: {
        Row: {
          archived_at: string;
          campaign_id: string;
          error_code: string | null;
          id: string;
          last_update_at: string | null;
          metadata: Json;
          msisdn_hash: string;
          msisdn_masked: string;
          status: string | null;
          target_id: string;
        };
        Insert: {
          archived_at?: string;
          campaign_id: string;
          error_code?: string | null;
          id?: string;
          last_update_at?: string | null;
          metadata?: Json;
          msisdn_hash: string;
          msisdn_masked: string;
          status?: string | null;
          target_id: string;
        };
        Update: {
          archived_at?: string;
          campaign_id?: string;
          error_code?: string | null;
          id?: string;
          last_update_at?: string | null;
          metadata?: Json;
          msisdn_hash?: string;
          msisdn_masked?: string;
          status?: string | null;
          target_id?: string;
        };
        Relationships: [];
      };
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
      countries: {
        Row: {
          currency_code: string;
          default_locale: string;
          id: string;
          is_active: boolean;
          iso2: string;
          iso3: string;
          name: string;
          timezone: string;
        };
        Insert: {
          currency_code: string;
          default_locale: string;
          id?: string;
          is_active?: boolean;
          iso2: string;
          iso3: string;
          name: string;
          timezone: string;
        };
        Update: {
          currency_code?: string;
          default_locale?: string;
          id?: string;
          is_active?: boolean;
          iso2?: string;
          iso3?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      country_config: {
        Row: {
          country_id: string;
          enabled_features: string[];
          kyc_required_docs: Json;
          languages: string[];
          legal_pages: Json;
          number_format: Json | null;
          reference_format: string;
          settlement_notes: string | null;
          telco_ids: string[];
        };
        Insert: {
          country_id: string;
          enabled_features: string[];
          kyc_required_docs: Json;
          languages: string[];
          legal_pages: Json;
          number_format?: Json | null;
          reference_format?: string;
          settlement_notes?: string | null;
          telco_ids: string[];
        };
        Update: {
          country_id?: string;
          enabled_features?: string[];
          kyc_required_docs?: Json;
          languages?: string[];
          legal_pages?: Json;
          number_format?: Json | null;
          reference_format?: string;
          settlement_notes?: string | null;
          telco_ids?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "country_config_country_id_fkey";
            columns: ["country_id"];
            isOneToOne: true;
            referencedRelation: "countries";
            referencedColumns: ["id"];
          },
        ];
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
            foreignKeyName: "group_invites_invitee_user_id_fkey";
            columns: ["invitee_user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          country_id: string | null;
          created_at: string;
          group_id: string;
          id: string;
          member_code: string;
          member_name: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          country_id?: string | null;
          created_at?: string;
          group_id: string;
          id?: string;
          member_code: string;
          member_name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          country_id?: string | null;
          created_at?: string;
          group_id?: string;
          id?: string;
          member_code?: string;
          member_name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gm_country_fk";
            columns: ["country_id"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          code: string;
          country_id: string | null;
          created_at: string;
          id: string;
          name: string;
          org_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          country_id?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          org_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          country_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          org_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_country_fk";
            columns: ["country_id"];
            isOneToOne: false;
            referencedRelation: "countries";
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
      items: {
        Row: {
          allergens: string[];
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          location_id: string;
          name: string;
          price_cents: number;
          tags: string[];
          tenant_id: string;
        };
        Insert: {
          allergens?: string[];
          created_at?: string;
          currency: string;
          description?: string | null;
          id?: string;
          location_id: string;
          name: string;
          price_cents: number;
          tags?: string[];
          tenant_id: string;
        };
        Update: {
          allergens?: string[];
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          location_id?: string;
          name?: string;
          price_cents?: number;
          tags?: string[];
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
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
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "join_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          name: string;
          region: string;
          tenant_id: string;
          timezone: string;
        };
        Insert: {
          created_at?: string;
          currency: string;
          id?: string;
          name: string;
          region: string;
          tenant_id: string;
          timezone: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          name?: string;
          region?: string;
          tenant_id?: string;
          timezone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      member_permissions: {
        Row: {
          expires_at: string | null;
          granted_at: string;
          granted_by: string | null;
          id: string;
          permission: Database["public"]["Enums"]["member_permission"];
          user_id: string;
        };
        Insert: {
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          permission: Database["public"]["Enums"]["member_permission"];
          user_id: string;
        };
        Update: {
          expires_at?: string | null;
          granted_at?: string;
          granted_by?: string | null;
          id?: string;
          permission?: Database["public"]["Enums"]["member_permission"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "member_permissions_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "member_permissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
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
          biometric_enabled: boolean | null;
          biometric_enrolled_at: string | null;
          created_at: string | null;
          id_files: Json | null;
          id_number: string | null;
          id_type: Database["public"]["Enums"]["member_id_type"] | null;
          is_verified: boolean | null;
          lang: string | null;
          last_login_at: string | null;
          momo_msisdn: string;
          ocr_confidence: number | null;
          ocr_json: Json | null;
          updated_at: string | null;
          user_id: string;
          whatsapp_msisdn: string;
          whatsapp_verified: boolean | null;
          whatsapp_verified_at: string | null;
        };
        Insert: {
          biometric_enabled?: boolean | null;
          biometric_enrolled_at?: string | null;
          created_at?: string | null;
          id_files?: Json | null;
          id_number?: string | null;
          id_type?: Database["public"]["Enums"]["member_id_type"] | null;
          is_verified?: boolean | null;
          lang?: string | null;
          last_login_at?: string | null;
          momo_msisdn: string;
          ocr_confidence?: number | null;
          ocr_json?: Json | null;
          updated_at?: string | null;
          user_id: string;
          whatsapp_msisdn: string;
          whatsapp_verified?: boolean | null;
          whatsapp_verified_at?: string | null;
        };
        Update: {
          biometric_enabled?: boolean | null;
          biometric_enrolled_at?: string | null;
          created_at?: string | null;
          id_files?: Json | null;
          id_number?: string | null;
          id_type?: Database["public"]["Enums"]["member_id_type"] | null;
          is_verified?: boolean | null;
          lang?: string | null;
          last_login_at?: string | null;
          momo_msisdn?: string;
          ocr_confidence?: number | null;
          ocr_json?: Json | null;
          updated_at?: string | null;
          user_id?: string;
          whatsapp_msisdn?: string;
          whatsapp_verified?: boolean | null;
          whatsapp_verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "members_app_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          channel: string;
          created_at: string;
          event_type: string;
          id: string;
          is_enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          channel: string;
          created_at?: string;
          event_type: string;
          id?: string;
          is_enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          is_enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_queue: {
        Row: {
          created_at: string;
          event: string;
          id: string;
          payload: Json;
          payment_id: string | null;
          processed_at: string | null;
          sacco_id: string | null;
          scheduled_for: string;
          status: string;
          template_id: string | null;
        };
        Insert: {
          created_at?: string;
          event: string;
          id?: string;
          payload: Json;
          payment_id?: string | null;
          processed_at?: string | null;
          sacco_id?: string | null;
          scheduled_for?: string;
          status?: string;
          template_id?: string | null;
        };
        Update: {
          created_at?: string;
          event?: string;
          id?: string;
          payload?: Json;
          payment_id?: string | null;
          processed_at?: string | null;
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
      notification_templates: {
        Row: {
          body: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          event: string;
          id: string;
          is_active: boolean;
          locale: string;
          sacco_id: string | null;
          subject: string | null;
          tokens: Json | null;
          updated_at: string;
        };
        Insert: {
          body: string;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          event: string;
          id?: string;
          is_active?: boolean;
          locale?: string;
          sacco_id?: string | null;
          subject?: string | null;
          tokens?: Json | null;
          updated_at?: string;
        };
        Update: {
          body?: string;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          event?: string;
          id?: string;
          is_active?: boolean;
          locale?: string;
          sacco_id?: string | null;
          subject?: string | null;
          tokens?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_templates_sacco_id_fkey";
            columns: ["sacco_id"];
            isOneToOne: false;
            referencedRelation: "saccos";
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
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          location_id: string;
          status: string;
          subtotal_cents: number;
          tenant_id: string;
          total_cents: number;
        };
        Insert: {
          created_at?: string;
          currency: string;
          id?: string;
          location_id: string;
          status?: string;
          subtotal_cents?: number;
          tenant_id: string;
          total_cents?: number;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          location_id?: string;
          status?: string;
          subtotal_cents?: number;
          tenant_id?: string;
          total_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      org_feature_overrides: {
        Row: {
          created_at: string;
          enabled: boolean;
          feature_config: Json;
          feature_domain: string;
          id: string;
          notes: string | null;
          org_id: string;
          partner_agreement_ref: string | null;
          risk_signoff_at: string | null;
          risk_signoff_by: string | null;
          tier: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          feature_config?: Json;
          feature_domain: string;
          id?: string;
          notes?: string | null;
          org_id: string;
          partner_agreement_ref?: string | null;
          risk_signoff_at?: string | null;
          risk_signoff_by?: string | null;
          tier: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          feature_config?: Json;
          feature_domain?: string;
          id?: string;
          notes?: string | null;
          org_id?: string;
          partner_agreement_ref?: string | null;
          risk_signoff_at?: string | null;
          risk_signoff_by?: string | null;
          tier?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_feature_overrides_risk_signoff_by_fkey";
            columns: ["risk_signoff_by"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      org_kb: {
        Row: {
          content: string;
          country_id: string | null;
          created_at: string | null;
          id: string;
          org_id: string;
          tags: string[] | null;
          title: string;
        };
        Insert: {
          content: string;
          country_id?: string | null;
          created_at?: string | null;
          id?: string;
          org_id: string;
          tags?: string[] | null;
          title: string;
        };
        Update: {
          content?: string;
          country_id?: string | null;
          created_at?: string | null;
          id?: string;
          org_id?: string;
          tags?: string[] | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_kb_country_id_fkey";
            columns: ["country_id"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["id"];
          },
        ];
      };
      org_memberships: {
        Row: {
          created_at: string;
          id: string;
          org_id: string;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          org_id: string;
          role: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          org_id?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      partner_config: {
        Row: {
          contact: Json | null;
          enabled_features: string[] | null;
          language_pack: string[] | null;
          merchant_code: string | null;
          org_id: string;
          reference_prefix: string | null;
          telco_ids: string[] | null;
        };
        Insert: {
          contact?: Json | null;
          enabled_features?: string[] | null;
          language_pack?: string[] | null;
          merchant_code?: string | null;
          org_id: string;
          reference_prefix?: string | null;
          telco_ids?: string[] | null;
        };
        Update: {
          contact?: Json | null;
          enabled_features?: string[] | null;
          language_pack?: string[] | null;
          merchant_code?: string | null;
          org_id?: string;
          reference_prefix?: string | null;
          telco_ids?: string[] | null;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth_key: string;
          created_at: string;
          endpoint: string;
          id: string;
          p256dh_key: string;
          topics: string[] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auth_key: string;
          created_at?: string;
          endpoint: string;
          id?: string;
          p256dh_key: string;
          topics?: string[] | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth_key?: string;
          created_at?: string;
          endpoint?: string;
          id?: string;
          p256dh_key?: string;
          topics?: string[] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          id: string;
          platform: string;
          token: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          platform: string;
          token: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          platform?: string;
          token?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
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
      staff_devices: {
        Row: {
          app_version: string | null;
          biometric_enabled: boolean | null;
          created_at: string;
          device_id: string;
          device_model: string | null;
          device_name: string | null;
          id: string;
          last_used_at: string | null;
          os_version: string | null;
          push_token: string | null;
          registered_at: string;
          staff_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          app_version?: string | null;
          biometric_enabled?: boolean | null;
          created_at?: string;
          device_id: string;
          device_model?: string | null;
          device_name?: string | null;
          id?: string;
          last_used_at?: string | null;
          os_version?: string | null;
          push_token?: string | null;
          registered_at?: string;
          staff_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          app_version?: string | null;
          biometric_enabled?: boolean | null;
          created_at?: string;
          device_id?: string;
          device_model?: string | null;
          device_name?: string | null;
          id?: string;
          last_used_at?: string | null;
          os_version?: string | null;
          push_token?: string | null;
          registered_at?: string;
          staff_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_devices_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
      };
      system_metric_samples: {
        Row: {
          collected_at: string;
          event: string;
          id: number;
          total: number;
        };
        Insert: {
          collected_at?: string;
          event: string;
          id?: number;
          total?: number;
        };
        Update: {
          collected_at?: string;
          event?: string;
          id?: number;
          total?: number;
        };
        Relationships: [];
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
      telco_providers: {
        Row: {
          country_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          merchant_field_name: string;
          name: string;
          notes: string | null;
          reference_field_name: string;
          updated_at: string;
          ussd_pattern: string;
        };
        Insert: {
          country_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          merchant_field_name?: string;
          name: string;
          notes?: string | null;
          reference_field_name?: string;
          updated_at?: string;
          ussd_pattern: string;
        };
        Update: {
          country_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          merchant_field_name?: string;
          name?: string;
          notes?: string | null;
          reference_field_name?: string;
          updated_at?: string;
          ussd_pattern?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telco_providers_country_id_fkey";
            columns: ["country_id"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          region: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          region: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          region?: string;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          channel: string;
          country_id: string | null;
          created_at: string | null;
          id: string;
          meta: Json | null;
          org_id: string;
          priority: string | null;
          status: string;
          subject: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          channel: string;
          country_id?: string | null;
          created_at?: string | null;
          id?: string;
          meta?: Json | null;
          org_id: string;
          priority?: string | null;
          status?: string;
          subject: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          channel?: string;
          country_id?: string | null;
          created_at?: string | null;
          id?: string;
          meta?: Json | null;
          org_id?: string;
          priority?: string | null;
          status?: string;
          subject?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [];
      };
      uploads: {
        Row: {
          country_id: string | null;
          created_at: string;
          file_name: string;
          file_type: string;
          id: string;
          org_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          country_id?: string | null;
          created_at?: string;
          file_name: string;
          file_type: string;
          id?: string;
          org_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          country_id?: string | null;
          created_at?: string;
          file_name?: string;
          file_type?: string;
          id?: string;
          org_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "uploads_country_fk";
            columns: ["country_id"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["id"];
          },
        ];
      };
      user_notification_preferences: {
        Row: {
          created_at: string;
          email_enabled: boolean;
          in_app_enabled: boolean;
          locale: string;
          updated_at: string;
          user_id: string;
          whatsapp_enabled: boolean;
        };
        Insert: {
          created_at?: string;
          email_enabled?: boolean;
          in_app_enabled?: boolean;
          locale?: string;
          updated_at?: string;
          user_id: string;
          whatsapp_enabled?: boolean;
        };
        Update: {
          created_at?: string;
          email_enabled?: boolean;
          in_app_enabled?: boolean;
          locale?: string;
          updated_at?: string;
          user_id?: string;
          whatsapp_enabled?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "debug_auth_users";
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
        Relationships: [
          {
            foreignKeyName: "user_saccos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "debug_auth_users";
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
        Relationships: [];
      };
    };
    Views: {
      accounts: {
        Row: {
          created_at: string | null;
          currency: string | null;
          id: string | null;
          owner_id: string | null;
          owner_type: string | null;
          sacco_id: string | null;
          status: string | null;
        };
        Insert: {
          created_at?: string | null;
          currency?: string | null;
          id?: string | null;
          owner_id?: string | null;
          owner_type?: string | null;
          sacco_id?: string | null;
          status?: string | null;
        };
        Update: {
          created_at?: string | null;
          currency?: string | null;
          id?: string | null;
          owner_id?: string | null;
          owner_type?: string | null;
          sacco_id?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      analytics_ikimina_monthly_mv: {
        Row: {
          active_member_count: number | null;
          code: string | null;
          contributing_members: number | null;
          ikimina_id: string | null;
          last_contribution_at: string | null;
          month_total: number | null;
          name: string | null;
          refreshed_at: string | null;
          sacco_id: string | null;
          status: string | null;
          updated_at: string | null;
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
          refreshed_at: string | null;
          sacco_id: string | null;
          status: string | null;
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
      audit_logs: {
        Row: {
          action: string | null;
          actor: string | null;
          created_at: string | null;
          diff: Json | null;
          entity: string | null;
          entity_id: string | null;
          id: string | null;
          sacco_id: string | null;
        };
        Insert: {
          action?: string | null;
          actor?: string | null;
          created_at?: string | null;
          diff?: Json | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string | null;
          sacco_id?: string | null;
        };
        Update: {
          action?: string | null;
          actor?: string | null;
          created_at?: string | null;
          diff?: Json | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string | null;
          sacco_id?: string | null;
        };
        Relationships: [];
      };
      debug_auth_users: {
        Row: {
          confirmation_token: string | null;
          email: string | null;
          email_change_token_current: string | null;
          email_change_token_new: string | null;
          id: string | null;
          recovery_token: string | null;
        };
        Insert: {
          confirmation_token?: string | null;
          email?: string | null;
          email_change_token_current?: string | null;
          email_change_token_new?: string | null;
          id?: string | null;
          recovery_token?: string | null;
        };
        Update: {
          confirmation_token?: string | null;
          email?: string | null;
          email_change_token_current?: string | null;
          email_change_token_new?: string | null;
          id?: string | null;
          recovery_token?: string | null;
        };
        Relationships: [];
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
        Relationships: [];
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
          sacco_id: string | null;
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
          sacco_id?: string | null;
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
          sacco_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
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
        Relationships: [];
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
          sacco_id: string | null;
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
          sacco_id?: string | null;
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
          sacco_id?: string | null;
          value_date?: string | null;
        };
        Relationships: [];
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
        Relationships: [];
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
          merchant_code: string | null;
          metadata: Json | null;
          name: string | null;
          province: string | null;
          sector: string | null;
          sector_code: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          brand_color?: never;
          category?: never;
          created_at?: string | null;
          district?: string | null;
          email?: never;
          id?: string | null;
          logo_url?: never;
          merchant_code?: string | null;
          metadata?: Json | null;
          name?: string | null;
          province?: never;
          sector?: never;
          sector_code?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          brand_color?: never;
          category?: never;
          created_at?: string | null;
          district?: string | null;
          email?: never;
          id?: string | null;
          logo_url?: never;
          merchant_code?: string | null;
          metadata?: Json | null;
          name?: string | null;
          province?: never;
          sector?: never;
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
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string | null;
          email: string | null;
          failed_mfa_count: number | null;
          id: string | null;
          last_login_at: string | null;
          last_mfa_step: number | null;
          last_mfa_success_at: string | null;
          mfa_backup_hashes: Json | null;
          mfa_enabled: boolean | null;
          mfa_enrolled_at: string | null;
          mfa_methods: Json | null;
          mfa_passkey_enrolled: boolean | null;
          mfa_secret_enc: string | null;
          notes: string | null;
          pw_reset_required: boolean | null;
          role: Database["public"]["Enums"]["app_role"] | null;
          sacco_id: string | null;
          status: string | null;
          suspended_at: string | null;
          suspended_by: string | null;
          updated_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      account_balance: { Args: { account_id: string }; Returns: number };
      can_user_access_account: {
        Args: { _account_id: string; _user_id: string };
        Returns: boolean;
      };
      cleanup_expired_qr_sessions: { Args: never; Returns: undefined };
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
      current_user_id: { Args: never; Returns: string };
      debug_auth_users_columns: {
        Args: never;
        Returns: {
          column_default: string;
          column_name: string;
          data_type: string;
          is_nullable: string;
        }[];
      };
      debug_auth_users_tokens: {
        Args: never;
        Returns: {
          confirmation_token: string;
          created_at: string;
          email: string;
          email_change_token_current: string;
          email_change_token_new: string;
          id: string;
          recovery_token: string;
          updated_at: string;
        }[];
      };
      debug_null_text_columns: { Args: never; Returns: Json };
      debug_null_tokens: { Args: never; Returns: Json };
      debug_seed_counts: { Args: never; Returns: Json };
      dispatch_notification_event: {
        Args: {
          p_event: string;
          p_payload?: Json;
          p_sacco_id?: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      enqueue_notification: {
        Args: {
          p_channel: string;
          p_event: string;
          p_payload?: Json;
          p_payment_id?: string;
          p_sacco_id?: string;
          p_scheduled_for?: string;
          p_template_id?: string;
        };
        Returns: string;
      };
      generate_reference_token: {
        Args: {
          p_country_iso3: string;
          p_district_code: string;
          p_group_code: string;
          p_member_seq: number;
          p_sacco_code: string;
        };
        Returns: string;
      };
      get_user_locale: { Args: { p_user_id: string }; Returns: string };
      get_user_sacco: { Args: { _user_id: string }; Returns: string };
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["member_permission"];
          _user_id: string;
        };
        Returns: boolean;
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
      is_channel_enabled: {
        Args: { p_channel: string; p_user_id: string };
        Returns: boolean;
      };
      is_feature_enabled: {
        Args: {
          check_country_id?: string;
          check_org_id?: string;
          feature_key: string;
        };
        Returns: boolean;
      };
      is_notification_enabled: {
        Args: { p_channel: string; p_event_type: string; p_user_id: string };
        Returns: boolean;
      };
      is_platform_admin: { Args: never; Returns: boolean };
      is_system_admin: { Args: never; Returns: boolean };
      is_user_member_of_group: { Args: { gid: string }; Returns: boolean };
      log_analytics_completion: {
        Args: {
          p_event_type: string;
          p_initial_event_id: string;
          p_metadata?: Json;
        };
        Returns: string;
      };
      log_analytics_event: {
        Args: {
          p_duration_seconds?: number;
          p_event_type: string;
          p_ikimina_id?: string;
          p_metadata?: Json;
          p_payment_id?: string;
          p_related_event_id?: string;
          p_sacco_id?: string;
          p_user_id?: string;
        };
        Returns: string;
      };
      parse_reference_token: {
        Args: { token: string };
        Returns: {
          country_iso3: string;
          district_code: string;
          group_code: string;
          member_seq: number;
          sacco_code: string;
        }[];
      };
      search_saccos: {
        Args: {
          district_filter?: string;
          limit_count?: number;
          query?: string;
          sector_filter?: string;
        };
        Returns: {
          category: string;
          district: string;
          id: string;
          merchant_code: string;
          name: string;
          province: string;
          sector_code: string;
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
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      sum_group_deposits: { Args: { gid: string }; Returns: Json };
      user_can_access_country: {
        Args: { target_country_id: string };
        Returns: boolean;
      };
      user_can_access_org: { Args: { target_org_id: string }; Returns: boolean };
      user_country_ids: { Args: never; Returns: string[] };
      user_org_ids: { Args: never; Returns: string[] };
    };
    Enums: {
      app_role:
        | "SYSTEM_ADMIN"
        | "SACCO_MANAGER"
        | "SACCO_STAFF"
        | "SACCO_VIEWER"
        | "DISTRICT_MANAGER"
        | "MFI_MANAGER"
        | "MFI_STAFF";
      group_invite_status: "sent" | "accepted" | "expired";
      invite_status: "sent" | "accepted" | "expired";
      join_request_status: "pending" | "approved" | "rejected";
      join_status: "pending" | "approved" | "rejected";
      member_id_type: "NID" | "DL" | "PASSPORT";
      member_permission:
        | "VIEW_BALANCE"
        | "VIEW_TRANSACTIONS"
        | "MAKE_PAYMENTS"
        | "VIEW_GROUPS"
        | "JOIN_GROUPS"
        | "MANAGE_PROFILE";
      notification_channel: "IN_APP" | "EMAIL" | "WHATSAPP";
      notification_type: "new_member" | "payment_confirmed" | "invite_accepted";
      notify_type: "new_member" | "payment_confirmed" | "invite_accepted";
      payment_status: "pending" | "completed" | "failed";
      user_account_status: "ACTIVE" | "SUSPENDED" | "INACTIVE";
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
  public: {
    Enums: {
      app_role: [
        "SYSTEM_ADMIN",
        "SACCO_MANAGER",
        "SACCO_STAFF",
        "SACCO_VIEWER",
        "DISTRICT_MANAGER",
        "MFI_MANAGER",
        "MFI_STAFF",
      ],
      group_invite_status: ["sent", "accepted", "expired"],
      invite_status: ["sent", "accepted", "expired"],
      join_request_status: ["pending", "approved", "rejected"],
      join_status: ["pending", "approved", "rejected"],
      member_id_type: ["NID", "DL", "PASSPORT"],
      member_permission: [
        "VIEW_BALANCE",
        "VIEW_TRANSACTIONS",
        "MAKE_PAYMENTS",
        "VIEW_GROUPS",
        "JOIN_GROUPS",
        "MANAGE_PROFILE",
      ],
      notification_channel: ["IN_APP", "EMAIL", "WHATSAPP"],
      notification_type: ["new_member", "payment_confirmed", "invite_accepted"],
      notify_type: ["new_member", "payment_confirmed", "invite_accepted"],
      payment_status: ["pending", "completed", "failed"],
      user_account_status: ["ACTIVE", "SUSPENDED", "INACTIVE"],
    },
  },
} as const;
