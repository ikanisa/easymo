declare module '@va/shared/wa-calls' {
  export type WaCallStatus = 'offer' | 'connect' | 'update' | 'end';
  export type WaCallEvent = {
    object: string;
    entry: Array<{
      changes: Array<{
        value?: {
          call?: {
            call_id?: string;
            status?: WaCallStatus;
            sdp?: string;
            ice?: unknown;
          };
        };
        [key: string]: unknown;
      }>;
    }>;
  };

  export const waCallStatusValues: WaCallStatus[];
  export const waCallStatusSchema: { parse: (input: unknown) => WaCallStatus };
  export const waCallEventSchema: { parse: (input: unknown) => WaCallEvent };
  export function parseWaCallEvent(input: unknown): WaCallEvent;
}
