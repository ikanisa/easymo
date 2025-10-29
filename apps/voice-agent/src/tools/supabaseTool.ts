/**
 * Supabase tool implementations for MCP server.
 * 
 * These tools are exposed via the MCP WebSocket server and can be called
 * by the OpenAI Realtime agent or other clients.
 * 
 * Tools provided:
 * - get_member_balance: Retrieve a member's savings balance
 * - redeem_voucher: Redeem a voucher code
 * 
 * All tools include:
 * - Input validation using Zod schemas
 * - Error handling and structured logging
 * - Idempotent operations where possible
 */

import { getMemberBalance, redeemVoucher } from "../supabaseClient.js";
import { logger } from "../logger.js";
import { z } from "zod";

/**
 * Tool: Get Member Balance
 * 
 * Retrieves the savings balance for a given member ID.
 * This is a read-only, idempotent operation.
 */
export const getMemberBalanceTool = {
  name: "get_member_balance",
  description: "Get the current savings balance for a member by their ID",
  parameters: z.object({
    memberId: z.string().min(1).describe("The unique identifier of the member"),
  }),
  async execute(args: { memberId: string }) {
    logger.info({
      msg: "tool.get_member_balance.executing",
      memberId: args.memberId,
    });

    const balance = await getMemberBalance(args.memberId);

    if (balance === null) {
      logger.warn({
        msg: "tool.get_member_balance.not_found",
        memberId: args.memberId,
      });
      
      return {
        success: false,
        error: "Member not found or balance unavailable",
        memberId: args.memberId,
      };
    }

    logger.info({
      msg: "tool.get_member_balance.success",
      memberId: args.memberId,
      balance,
    });

    return {
      success: true,
      memberId: args.memberId,
      balance,
      currency: "RWF",
    };
  },
};

/**
 * Tool: Redeem Voucher
 * 
 * Redeems a voucher code by marking it as used.
 * This is an idempotent operation - attempting to redeem an already
 * redeemed voucher will return an error.
 */
export const redeemVoucherTool = {
  name: "redeem_voucher",
  description: "Redeem a voucher code and mark it as used",
  parameters: z.object({
    code: z
      .string()
      .min(1)
      .toUpperCase()
      .describe("The voucher code to redeem (case-insensitive)"),
  }),
  async execute(args: { code: string }) {
    logger.info({
      msg: "tool.redeem_voucher.executing",
      code: args.code,
    });

    const result = await redeemVoucher(args.code);

    if (!result.success) {
      logger.warn({
        msg: "tool.redeem_voucher.failed",
        code: args.code,
        error: result.error,
      });
      
      return {
        success: false,
        error: result.error || "Failed to redeem voucher",
        code: args.code,
      };
    }

    logger.info({
      msg: "tool.redeem_voucher.success",
      code: args.code,
      voucherId: result.voucher?.id,
    });

    return {
      success: true,
      code: args.code,
      voucher: {
        id: result.voucher?.id,
        value: result.voucher?.value,
        type: result.voucher?.type,
      },
    };
  },
};

/**
 * Export all tools as an array for easy registration.
 */
export const supabaseTools = [getMemberBalanceTool, redeemVoucherTool];
