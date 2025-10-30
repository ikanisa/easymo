import { z } from "zod";

/**
 * Input schema for customer lookup
 */
export const LookupCustomerInput = z.object({
  msisdn: z.string().min(10).describe("Customer mobile number to lookup"),
});
export type TLookupCustomerInput = z.infer<typeof LookupCustomerInput>;

/**
 * Output schema for customer lookup
 */
export const LookupCustomerOutput = z.object({
  exists: z.boolean().describe("Whether customer exists in system"),
  name: z.string().optional().describe("Customer name if exists"),
  msisdn: z.string().describe("Customer mobile number"),
  customer_id: z.string().uuid().optional().describe("Customer ID if exists"),
});
export type TLookupCustomerOutput = z.infer<typeof LookupCustomerOutput>;
