// Type definitions for MoMo SMS Inbox tables
// These are manually defined until the app schema is added to generated types

export interface MomoWebhookConfig {
  id: string;
  momo_phone_number: string;
  webhook_secret: string;
  device_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MomoSmsInbox {
  id: string;
  phone_number: string;
  sender: string | null;
  raw_message: string;
  parsed_amount: number | null;
  parsed_sender_name: string | null;
  parsed_transaction_id: string | null;
  parsed_provider: string | null;
  received_at: string;
  processed: boolean;
  matched_payment_id: string | null;
  match_confidence: number | null;
  signature: string | null;
  device_id: string | null;
  created_at: string;
}

// Extend the Database type to include app schema momo tables
declare module "@/lib/supabase/types" {
  export interface Database {
    app: {
      Tables: {
        momo_webhook_config: {
          Row: MomoWebhookConfig;
          Insert: Omit<MomoWebhookConfig, "id" | "created_at" | "updated_at"> & {
            id?: string;
            created_at?: string;
            updated_at?: string;
          };
          Update: Partial<Omit<MomoWebhookConfig, "id" | "created_at">> & {
            updated_at?: string;
          };
        };
        momo_sms_inbox: {
          Row: MomoSmsInbox;
          Insert: Omit<MomoSmsInbox, "id" | "created_at" | "processed"> & {
            id?: string;
            created_at?: string;
            processed?: boolean;
          };
          Update: Partial<Omit<MomoSmsInbox, "id" | "created_at">>;
        };
      };
    };
  }
}
