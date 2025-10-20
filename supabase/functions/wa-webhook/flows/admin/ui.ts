import type { RouterContext } from "../../types.ts";
import { sendButtons, sendList } from "../../wa/client.ts";
import { t } from "../../i18n/translator.ts";

type SendAttemptState = {
  sent: boolean;
  attempts: number;
  lastLabel?: string;
};

const ADMIN_SEND_GUARD_KEY = Symbol.for("admin.send_guard");

async function withSendGuard(
  ctx: RouterContext,
  label: string,
  send: () => Promise<void>,
): Promise<void> {
  const existing = (ctx as any)[ADMIN_SEND_GUARD_KEY] as
    | SendAttemptState
    | undefined;
  const state: SendAttemptState = existing ?? { sent: false, attempts: 0 };
  if (!existing) {
    (ctx as any)[ADMIN_SEND_GUARD_KEY] = state;
  }
  state.attempts += 1;
  if (state.sent) {
    console.warn("admin.send_guard.block", {
      from: ctx.from,
      label,
      attempts: state.attempts,
      lastLabel: state.lastLabel,
    });
    return;
  }
  state.sent = true;
  state.lastLabel = label;
  try {
    await send();
  } catch (error) {
    state.lastLabel = `${label}:error`;
    console.error("admin.send_guard.error", error);
    throw error;
  }
}

export async function sendAdminViewButton(
  ctx: RouterContext,
  options: { body: string; id: string; emoji?: string },
): Promise<void> {
  const body = withEmoji(options.body, options.emoji);
  await withSendGuard(ctx, `button:${options.id}`, async () => {
    await sendButtons(ctx.from, body, [{
      id: options.id,
      title: t(ctx.locale, "common.buttons.view"),
    }]);
  });
}

export async function sendAdminList(
  ctx: RouterContext,
  list: {
    title: string;
    body: string;
    sectionTitle: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  },
  options: { emoji?: string } = {},
): Promise<void> {
  await withSendGuard(ctx, `list:${list.title}`, async () => {
    await sendList(ctx.from, {
      title: list.title,
      body: withEmoji(list.body, options.emoji),
      sectionTitle: list.sectionTitle,
      rows: list.rows,
      buttonText: t(ctx.locale, "common.buttons.view"),
    });
  });
}

export async function sendAdminActionButton(
  ctx: RouterContext,
  options: { body: string; id: string; title: string; emoji?: string },
): Promise<void> {
  const body = withEmoji(options.body, options.emoji);
  await withSendGuard(ctx, `action:${options.id}`, async () => {
    await sendButtons(ctx.from, body, [{
      id: options.id,
      title: options.title,
    }]);
  });
}

function withEmoji(body: string, emoji?: string): string {
  const trimmed = body.trim();
  if (!emoji) return trimmed;
  const prefix = emoji.endsWith(" ") ? emoji.trimEnd() : emoji;
  return `${prefix} ${trimmed}`.trim();
}
