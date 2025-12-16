import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { isAdminNumber } from "./auth.ts";
import { logAdminAction } from "../../../_shared/observability.ts";

export async function handleAdminCommand(
  ctx: RouterContext,
  body: string,
): Promise<boolean> {
  if (!body.startsWith("/")) return false;
  if (!(await isAdminNumber(ctx))) {
    await sendText(ctx.from, "Admin command denied. Not authorized.");
    return true;
  }
  const text = body.slice(1).trim();
  if (!text) {
    await sendText(ctx.from, adminHelp());
    return true;
  }
  const [command, ...rest] = text.split(/\s+/);
  switch (command.toLowerCase()) {
    case "sub":
      await handleSubCommand(ctx, rest);
      return true;
    case "help":
      await sendText(ctx.from, adminHelp());
      return true;
    default:
      await sendText(ctx.from, `Unknown command ${command}. Send /help.`);
      return true;
  }
}

async function handleSubCommand(
  ctx: RouterContext,
  args: string[],
): Promise<void> {
  const action = (args[0] ?? "").toLowerCase();
  switch (action) {
    case "approve":
    case "reject": {
      const target = args[1];
      if (!target) {
        await sendText(
          ctx.from,
          "Usage: /sub approve <reference> or /sub reject <reference>",
        );
        return;
      }
      try {
        const { data, error } = await ctx.supabase.rpc("admin_sub_command", {
          _action: action,
          _reference: target,
          _actor: ctx.from,
        });
        if (error) throw error;
        const status = Array.isArray(data) && data[0]?.status
          ? data[0].status
          : "ok";
        await sendText(
          ctx.from,
          `SUB ${action.toUpperCase()} for ${target}: ${status}`,
        );
        await logAdminAction({ actor: ctx.from, target, action });
      } catch (error) {
        logStructuredEvent("ADMIN_SUB_COMMAND_FAIL", {
          error: error instanceof Error ? error.message : String(error),
        }, "error");
        await sendText(
          ctx.from,
          `Command failed: ${(error as Error).message ?? error}`,
        );
      }
      return;
    }
    case "list":
      await listSubmissions(ctx);
      return;
    default:
      await sendText(
        ctx.from,
        "Usage: /sub approve <ref> | /sub reject <ref> | /sub list",
      );
  }
}

async function listSubmissions(ctx: RouterContext): Promise<void> {
  try {
    const { data, error } = await ctx.supabase.rpc("admin_sub_list_pending", {
      _limit: 10,
    });
    if (error) throw error;
    if (!data || !Array.isArray(data) || data.length === 0) {
      await sendText(ctx.from, "No pending SUB requests.");
      return;
    }
    const lines = (data as Array<
      { reference?: string; submitted_at?: string; name?: string }
    >).map((row) => {
      const ref = row.reference ?? "ref";
      const name = row.name ?? "";
      const when = row.submitted_at ?? "";
      return `${ref}${name ? ` • ${name}` : ""}${when ? ` • ${when}` : ""}`;
    });
    await sendText(
      ctx.from,
      [`Pending SUB (${lines.length})`, ...lines].join("\n"),
    );
    await logAdminAction({
      actor: ctx.from,
      action: "sub_list",
      count: lines.length,
    });
  } catch (error) {
    logStructuredEvent("ADMIN_SUB_LIST_FAIL", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    await sendText(ctx.from, "Failed to list submissions.");
  }
}

function adminHelp(): string {
  return "Admin commands:\n/sub approve <ref>\n/sub reject <ref>\n/sub list";
}
