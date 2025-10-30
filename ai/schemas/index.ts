import { zodToJsonSchema } from "zod-to-json-schema";
import {
  VoucherCreateInput,
  VoucherRedeemInput,
  VoucherVoidInput,
} from "./voucher.schema";
import { LookupCustomerInput } from "./customer.schema";

/**
 * JSON-Schema definitions for OpenAI function calling
 * These schemas are used to define tool parameters in the Responses and Realtime APIs
 */
export const toolSchemas = {
  create_voucher: zodToJsonSchema(VoucherCreateInput, "create_voucher"),
  lookup_customer: zodToJsonSchema(LookupCustomerInput, "lookup_customer"),
  redeem_voucher: zodToJsonSchema(VoucherRedeemInput, "redeem_voucher"),
  void_voucher: zodToJsonSchema(VoucherVoidInput, "void_voucher"),
};

/**
 * Tool definitions for OpenAI function calling
 */
export const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "create_voucher",
      description:
        "Create and persist a new voucher for a customer with specified amount and currency",
      parameters: toolSchemas.create_voucher,
    },
  },
  {
    type: "function" as const,
    function: {
      name: "lookup_customer",
      description:
        "Find customer by mobile number (MSISDN) to check if they exist in the system",
      parameters: toolSchemas.lookup_customer,
    },
  },
  {
    type: "function" as const,
    function: {
      name: "redeem_voucher",
      description: "Redeem an issued voucher by its ID for a customer",
      parameters: toolSchemas.redeem_voucher,
    },
  },
  {
    type: "function" as const,
    function: {
      name: "void_voucher",
      description: "Void/cancel an issued voucher that hasn't been redeemed",
      parameters: toolSchemas.void_voucher,
    },
  },
];

// Re-export all schemas for convenience
export * from "./voucher.schema";
export * from "./customer.schema";
export * from "./tool.common";
