import type { RouterContext } from "../types.ts";
import { sendButtons, sendList } from "../wa/client.ts";
import { IDS } from "../wa/ids.ts";
import { t } from "../i18n/translator.ts";

export type ButtonSpec = { id: string; title: string };

const HOME_BUTTON: ButtonSpec = { id: IDS.BACK_HOME, title: "🏠 Home" };

function ensureHomeButton(buttons: ButtonSpec[], max = 3): ButtonSpec[] {
  if (!buttons.length) {
    return [HOME_BUTTON];
  }
  return buttons.slice(0, max);
}

function coerceBody(body: string, emojiPrefix = ""): string {
  const trimmed = body.trim();
  const prefix = emojiPrefix ? `${emojiPrefix} ` : "";
  return `${prefix}${trimmed}`.trim();
}

export async function sendButtonsMessage(
  ctx: RouterContext,
  body: string,
  buttons: ButtonSpec[],
  options: { emoji?: string } = {},
): Promise<void> {
  const payload = ensureHomeButton(buttons).map((button) =>
    button.id === IDS.BACK_HOME
      ? { ...button, title: t(ctx.locale, "common.home_button") }
      : button
  );
  await sendButtons(ctx.from, coerceBody(body, options.emoji ?? ""), payload);
}

export async function sendListWithActions(
  ctx: RouterContext,
  list: {
    title: string;
    body: string;
    sectionTitle: string;
    rows: Array<{ id: string; title: string; description?: string }>;
    buttonText?: string;
  },
  actions: ButtonSpec[],
  options: { emoji?: string } = {},
): Promise<void> {
  await sendList(ctx.from, {
    ...list,
    buttonText: list.buttonText ?? t(ctx.locale, "common.buttons.choose"),
  });
  const trimmed = actions.filter((action) =>
    Boolean(action?.id && action?.title)
  );
  if (!trimmed.length) return;
  await sendButtonsMessage(ctx, list.body, trimmed, options);
}

export async function sendListMessage(
  ctx: RouterContext,
  list: {
    title: string;
    body: string;
    sectionTitle: string;
    rows: Array<{ id: string; title: string; description?: string }>;
    buttonText?: string;
  },
  options: { emoji?: string } = {},
): Promise<void> {
  await sendList(ctx.from, {
    ...list,
    body: coerceBody(list.body, options.emoji ?? ""),
    buttonText: list.buttonText ?? t(ctx.locale, "common.buttons.select"),
  });
}

export function homeOnly(): ButtonSpec[] {
  return [HOME_BUTTON];
}

export function buildButtons(
  primary: ButtonSpec,
  ...others: ButtonSpec[]
): ButtonSpec[] {
  return ensureHomeButton([primary, ...others]);
}
