export type WaCallStatus = 'offer' | 'connect' | 'update' | 'end';

export interface WaCallEvent {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        call?: {
          call_id: string;
          from: string;
          to: string;
          status: WaCallStatus;
          sdp?: string;
          ice?: unknown;
          timestamp: string;
        };
      };
      field: string;
    }>;
  }>;
}
