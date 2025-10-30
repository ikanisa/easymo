import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger.js";
import { getMemberBalance, redeemVoucher } from "./supabaseClient.js";
import { z } from "zod";

/**
 * MCP (Model Context Protocol) Server.
 * 
 * This server exposes tools that can be called by the OpenAI Realtime agent
 * or other clients via WebSocket.
 * 
 * Protocol:
 * - Client sends: { id, method: "tool.call", params: { name, args } }
 * - Server responds: { id, result } or { id, error }
 */
class MCPServer {
  private wss: WebSocketServer | null = null;
  private tools = new Map<string, Tool>();

  constructor() {
    this.registerTools();
  }

  /**
   * Register available tools.
   */
  private registerTools(): void {
    // Tool: get_member_balance
    this.tools.set("get_member_balance", {
      name: "get_member_balance",
      description: "Get the balance of a member's savings account",
      parameters: z.object({
        memberId: z.string().describe("The ID of the member"),
      }),
      execute: async (args) => {
        const { memberId } = args;
        const balance = await getMemberBalance(memberId);
        
        if (balance === null) {
          return {
            success: false,
            error: "Member not found or balance unavailable",
          };
        }

        return {
          success: true,
          memberId,
          balance,
          currency: "RWF",
        };
      },
    });

    // Tool: redeem_voucher
    this.tools.set("redeem_voucher", {
      name: "redeem_voucher",
      description: "Redeem a voucher code",
      parameters: z.object({
        code: z.string().describe("The voucher code to redeem"),
      }),
      execute: async (args) => {
        const { code } = args;
        return await redeemVoucher(code);
      },
    });

    logger.info({
      msg: "mcp.tools.registered",
      tools: Array.from(this.tools.keys()),
    });
  }

  /**
   * Start the MCP WebSocket server.
   */
  start(port: number): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on("connection", (socket: WebSocket) => {
      const connectionId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      logger.info({
        msg: "mcp.connection.established",
        connectionId,
      });

      socket.on("message", async (data) => {
        await this.handleMessage(socket, data, connectionId);
      });

      socket.on("error", (error) => {
        logger.error({
          msg: "mcp.socket.error",
          connectionId,
          error: error.message,
        });
      });

      socket.on("close", () => {
        logger.info({
          msg: "mcp.connection.closed",
          connectionId,
        });
      });
    });

    logger.info({
      msg: "mcp.server.started",
      port,
      path: process.env.MCP_WS_PATH || "/mcp",
    });
  }

  /**
   * Handle incoming MCP message.
   */
  private async handleMessage(
    socket: WebSocket,
    data: any,
    connectionId: string,
  ): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      const { id, method, params } = message;

      logger.debug({
        msg: "mcp.message.received",
        connectionId,
        id,
        method,
      });

      if (method === "tool.call") {
        await this.handleToolCall(socket, id, params, connectionId);
      } else if (method === "tools.list") {
        await this.handleToolsList(socket, id, connectionId);
      } else {
        this.sendError(socket, id, `Unknown method: ${method}`);
      }
    } catch (error) {
      logger.error({
        msg: "mcp.message.error",
        connectionId,
        error: (error as Error).message,
      });
      this.sendError(socket, null, (error as Error).message);
    }
  }

  /**
   * Handle tool.call request.
   */
  private async handleToolCall(
    socket: WebSocket,
    id: string,
    params: { name: string; args: any },
    connectionId: string,
  ): Promise<void> {
    const { name, args } = params;

    const tool = this.tools.get(name);
    if (!tool) {
      this.sendError(socket, id, `Tool not found: ${name}`);
      return;
    }

    try {
      // Validate arguments
      const validatedArgs = tool.parameters.parse(args);

      logger.info({
        msg: "mcp.tool.executing",
        connectionId,
        id,
        tool: name,
        args: validatedArgs,
      });

      // Execute tool
      const result = await tool.execute(validatedArgs);

      logger.info({
        msg: "mcp.tool.executed",
        connectionId,
        id,
        tool: name,
        success: true,
      });

      // Send result
      this.sendResult(socket, id, result);
    } catch (error) {
      logger.error({
        msg: "mcp.tool.error",
        connectionId,
        id,
        tool: name,
        error: (error as Error).message,
      });
      this.sendError(socket, id, (error as Error).message);
    }
  }

  /**
   * Handle tools.list request.
   */
  private async handleToolsList(
    socket: WebSocket,
    id: string,
    connectionId: string,
  ): Promise<void> {
    logger.debug({
      msg: "mcp.tools.listing",
      connectionId,
      id,
    });

    const toolsList = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters.shape,
    }));

    this.sendResult(socket, id, { tools: toolsList });
  }

  /**
   * Send successful result.
   */
  private sendResult(socket: WebSocket, id: string, result: any): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          id,
          result,
        }),
      );
    }
  }

  /**
   * Send error response.
   */
  private sendError(socket: WebSocket, id: string | null, error: string): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          id,
          error: {
            message: error,
          },
        }),
      );
    }
  }

  /**
   * Stop the MCP server.
   */
  stop(): void {
    if (this.wss) {
      this.wss.close();
      logger.info({ msg: "mcp.server.stopped" });
    }
  }
}

interface Tool {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

// Export singleton instance
export const mcpServer = new MCPServer();
