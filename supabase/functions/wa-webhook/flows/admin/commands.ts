import type { RouterContext } from "../../types.ts";
import { sendText } from "../../wa/client.ts";
import { isAdminNumber } from "./auth.ts";
import { logAdminAction } from "../../observe/log.ts";
import { INSURANCE_MEDIA_BUCKET, OPENAI_API_KEY } from "../../config.ts";
import { getAppConfig } from "../../utils/app_config.ts";

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
    case "insurance":
      await handleInsuranceCommand(ctx, rest);
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
        console.error("admin.sub_command_fail", error);
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
    if (!data || !(data as any[]).length) {
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
    console.error("admin.sub_list_fail", error);
    await sendText(ctx.from, "Failed to list submissions.");
  }
}

function adminHelp(): string {
  return "Admin commands:\n/sub approve <ref>\n/sub reject <ref>\n/sub list\n/insurance diag";
}

async function handleInsuranceCommand(
  ctx: RouterContext,
  args: string[],
): Promise<void> {
  const action = (args[0] ?? "").toLowerCase();
  if (action !== "diag") {
    await sendText(ctx.from, "Usage: /insurance diag");
    return;
  }

  const openaiStatus = OPENAI_API_KEY ? "ok" : "missing";
  const { insurance_admin_numbers } = await getAppConfig(ctx.supabase);
  const adminCount = Array.isArray(insurance_admin_numbers)
    ? insurance_admin_numbers.filter((value) =>
      typeof value === "string" && value.trim()
    ).length
    : 0;

  const { error: bucketError } = await ctx.supabase.storage
    .from(INSURANCE_MEDIA_BUCKET)
    .list("", { limit: 1 });
  const bucketStatus = bucketError?.message ?? "ok";

  const lines = [
    "Insurance OCR diagnostics:",
    `• OPENAI_API_KEY: ${openaiStatus}`,
    `• Bucket ${INSURANCE_MEDIA_BUCKET}: ${bucketStatus}`,
    `• Admin numbers: ${adminCount}`,
  ];

  await sendText(ctx.from, lines.join("\n"));
  await logAdminAction({
    actor: ctx.from,
    action: "insurance_diag",
    openai: openaiStatus,
    admins: adminCount,
    bucket_status: bucketStatus,
  });
}
