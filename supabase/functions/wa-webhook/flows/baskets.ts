import type { RouterContext } from "../types.ts";
import { sendImageUrl, sendList, sendText } from "../wa/client.ts";
import { clearState, setState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import { sendHomeMenu } from "./home.ts";
import { maskPhone } from "./support.ts";
import {
  closeBasket,
  createBasket,
  discoverBaskets,
  generateBasketQr,
  getBasketDetail,
  joinBasketByCode,
  leaveBasket,
  listMyBaskets,
} from "../rpc/baskets.ts";
import { buildWaLink } from "../utils/share.ts";
import { fmtCurrency, timeAgo, truncate } from "../utils/text.ts";
import { sendConfirmPrompt } from "../utils/confirm.ts";

const STATES = {
  MENU: "basket_menu",
  CREATE_NAME: "basket_create_name",
  CREATE_PRIVACY: "basket_create_privacy",
  CREATE_GOAL: "basket_create_goal",
  JOIN_CODE: "basket_join_code",
  MY_RESULTS: "basket_my_results",
  DISCOVER_LOCATION: "basket_discover_location",
  DISCOVER_RESULTS: "basket_discover_results",
  ACTION: "basket_action",
  CLOSE_CONFIRM: "basket_close_confirm",
  LEAVE_CONFIRM: "basket_leave_confirm",
} as const;

type BasketListRow = { id: string; title: string; description?: string };

type BasketActionState = {
  basketId: string;
  basketName: string;
  shareToken?: string | null;
  isOwner: boolean;
  currency: string;
};

type BasketCreateState = {
  name?: string;
  isPublic?: boolean;
};

type BasketState = { key: string; data?: Record<string, unknown> };

export async function startBaskets(
  ctx: RouterContext,
  _state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) {
    await sendText(
      ctx.from,
      "We couldn't find your profile. Try again in a moment.",
    );
    return true;
  }
  await setState(ctx.supabase, ctx.profileId, { key: STATES.MENU, data: {} });
  await sendList(ctx.from, {
    title: "Shared Baskets",
    body: "Create, join, or manage a group basket.",
    sectionTitle: "Options",
    rows: [
      { id: IDS.BASKET_CREATE, title: "Create basket" },
      { id: IDS.BASKET_JOIN, title: "Join with code" },
      { id: IDS.BASKET_MY, title: "My baskets" },
      { id: IDS.BASKET_DISCOVER, title: "Discover nearby" },
    ],
  });
  return true;
}

export async function handleBasketListSelection(
  ctx: RouterContext,
  id: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  if (state.key === STATES.MENU) {
    switch (id) {
      case IDS.BASKET_CREATE:
        await setState(ctx.supabase, ctx.profileId, {
          key: STATES.CREATE_NAME,
          data: {},
        });
        await sendText(ctx.from, "Give your basket a name (3-40 characters).");
        return true;
      case IDS.BASKET_JOIN:
        await setState(ctx.supabase, ctx.profileId, {
          key: STATES.JOIN_CODE,
          data: {},
        });
        await sendText(ctx.from, "Enter the invite code (format JB:XXXX).");
        return true;
      case IDS.BASKET_MY: {
        const rows = await loadMyBaskets(ctx);
        if (!rows.length) return true;
        await setState(ctx.supabase, ctx.profileId, {
          key: STATES.MY_RESULTS,
          data: { rows },
        });
        await sendList(ctx.from, {
          title: "My baskets",
          body: "Select one to view details.",
          sectionTitle: "Baskets",
          rows,
        });
        return true;
      }
      case IDS.BASKET_DISCOVER:
        await setState(ctx.supabase, ctx.profileId, {
          key: STATES.DISCOVER_LOCATION,
          data: {},
        });
        await sendText(
          ctx.from,
          "Share your location (tap ➕ → Location) to find baskets near you.",
        );
        return true;
      default:
        return false;
    }
  }

  if (
    state.key === STATES.MY_RESULTS || state.key === STATES.DISCOVER_RESULTS
  ) {
    const rows = (state.data?.rows ?? []) as BasketListRow[];
    const match = rows.find((row) => row.id === id);
    if (!match) {
      await sendText(ctx.from, "Basket not found. Choose another option.");
      return true;
    }
    await loadBasketDetail(ctx, match.id);
    return true;
  }

  return false;
}

export async function handleBasketText(
  ctx: RouterContext,
  body: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const trimmed = body.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  if (lower === "home") {
    await clearState(ctx.supabase, ctx.profileId);
    await sendHomeMenu(ctx);
    return true;
  }
  if (lower === "menu" || lower === "back") {
    await startBaskets(ctx, state);
    return true;
  }

  switch (state.key) {
    case STATES.CREATE_NAME:
      return await handleCreateName(ctx, trimmed);
    case STATES.CREATE_PRIVACY:
      return await handleCreatePrivacy(ctx, lower, state);
    case STATES.CREATE_GOAL:
      return await handleCreateGoal(ctx, trimmed, state);
    case STATES.JOIN_CODE:
      return await handleJoinCode(ctx, trimmed);
    case STATES.ACTION:
      return await handleActionCommand(ctx, lower, state);
    case STATES.CLOSE_CONFIRM:
      return await handleCloseConfirm(ctx, lower, state);
    case STATES.LEAVE_CONFIRM:
      return await handleLeaveConfirm(ctx, lower, state);
    default:
      return false;
  }
}

export async function handleBasketLocation(
  ctx: RouterContext,
  state: BasketState,
  coords: { lat: number; lng: number },
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (state.key !== STATES.DISCOVER_LOCATION) return false;

  try {
    const discoveries = await discoverBaskets(ctx.supabase, {
      profileId: ctx.profileId,
      lat: coords.lat,
      lng: coords.lng,
      limit: 9,
    });
    if (!discoveries.length) {
      await sendText(
        ctx.from,
        "No public baskets nearby yet. Try again later.",
      );
      await startBaskets(ctx, state);
      return true;
    }
    const rows: BasketListRow[] = discoveries.map((item) => ({
      id: item.id,
      title: truncate(item.name ?? "Basket", 24),
      description: buildDiscoverDescription(
        item.description ?? null,
        item.distance_km,
        item.member_count,
      ),
    }));
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.DISCOVER_RESULTS,
      data: { rows },
    });
    await sendList(ctx.from, {
      title: "Baskets nearby",
      body: "Tap one to view details.",
      sectionTitle: "Discover",
      rows,
    });
  } catch (error) {
    console.error("baskets.discover_fail", error);
    await sendText(ctx.from, "Couldn't load nearby baskets. Try again later.");
    await startBaskets(ctx, state);
  }
  return true;
}

async function handleCreateName(
  ctx: RouterContext,
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (value.length < 3 || value.length > 40) {
    await sendText(ctx.from, "Name must be between 3 and 40 characters.");
    return true;
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CREATE_PRIVACY,
    data: { name: value },
  });
  await sendText(
    ctx.from,
    "Should this basket be PUBLIC (anyone can find) or PRIVATE? Reply PUBLIC or PRIVATE.",
  );
  return true;
}

async function handleCreatePrivacy(
  ctx: RouterContext,
  lower: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const isPublic = parseVisibility(lower);
  if (isPublic === null) {
    await sendText(ctx.from, "Reply PUBLIC or PRIVATE to set visibility.");
    return true;
  }
  const data: BasketCreateState = { ...(state.data ?? {}), isPublic };
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CREATE_GOAL,
    data,
  });
  await sendText(
    ctx.from,
    "Optional: enter a savings goal in RWF (e.g., 50000) or reply SKIP.",
  );
  return true;
}

async function handleCreateGoal(
  ctx: RouterContext,
  value: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const createState = (state.data ?? {}) as BasketCreateState;
  const name = createState.name?.trim();
  if (!name) {
    await sendText(ctx.from, "Start again: give the basket a name.");
    await startBaskets(ctx, state);
    return true;
  }
  const isPublic = Boolean(createState.isPublic);
  const parsed = parseGoal(value);
  if (parsed === undefined) {
    await sendText(ctx.from, "Send a number like 50000 or reply SKIP.");
    return true;
  }
  const goalMinor = parsed;
  await sendText(ctx.from, "Creating your basket…");
  try {
    const result = await createBasket(ctx.supabase, {
      profileId: ctx.profileId,
      whatsapp: ctx.from,
      name,
      isPublic,
      goalMinor,
    });
    const shareCode = result.shareToken
      ? formatShareCode(result.shareToken)
      : null;
    await sendText(ctx.from, `Basket "${name}" is ready!`);
    if (shareCode) {
      await sendText(ctx.from, `Share code: ${shareCode}`);
      const shareLink = buildWaLink(`Join ${name} with code ${shareCode}`);
      if (shareLink) {
        await sendText(ctx.from, `Invite link: ${shareLink}`);
      }
    }
    if (result.qrUrl) {
      await sendImageUrl(ctx.from, result.qrUrl, "Scan to join the basket");
    }
  } catch (error) {
    console.error("baskets.create_fail", error);
    await sendText(ctx.from, "Could not create basket. Try again later.");
    await startBaskets(ctx, state);
    return true;
  }
  await clearState(ctx.supabase, ctx.profileId);
  await sendHomeMenu(ctx);
  return true;
}

async function handleJoinCode(
  ctx: RouterContext,
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const code = normalizeShareCode(value);
  if (!code) {
    await sendText(ctx.from, "Invalid code. Format JB:XXXX.");
    return true;
  }
  await sendText(ctx.from, "Joining basket…");
  try {
    const joined = await joinBasketByCode(ctx.supabase, {
      profileId: ctx.profileId,
      whatsapp: ctx.from,
      code,
    });
    await sendText(ctx.from, `You're in! Basket: ${joined.name ?? "Basket"}.`);
  } catch (error) {
    console.error("baskets.join_fail", error);
    await sendText(
      ctx.from,
      errorMessage(
        error,
        "Could not join basket. Check the code and try again.",
      ),
    );
    await startBaskets(ctx, state);
    return true;
  }
  await clearState(ctx.supabase, ctx.profileId);
  await sendHomeMenu(ctx);
  return true;
}

async function handleActionCommand(
  ctx: RouterContext,
  lower: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const data = (state.data ?? {}) as BasketActionState;
  if (!data.basketId) {
    await startBaskets(ctx, state);
    return true;
  }
  if (lower === "share" || lower === "code" || lower === "link") {
    if (!data.shareToken) {
      await sendText(
        ctx.from,
        "No share code available. Ask the owner to refresh.",
      );
      return true;
    }
    const shareCode = formatShareCode(data.shareToken);
    await sendText(ctx.from, `Share code: ${shareCode}`);
    const shareLink = buildWaLink(
      `Join ${data.basketName} with code ${shareCode}`,
    );
    if (shareLink) {
      await sendText(ctx.from, `Invite link: ${shareLink}`);
    }
    return true;
  }
  if (lower === "qr") {
    try {
      const qr = await generateBasketQr(ctx.supabase, {
        profileId: ctx.profileId,
        basketId: data.basketId,
      });
      if (qr?.qrUrl) {
        await sendImageUrl(ctx.from, qr.qrUrl, `${data.basketName} QR`);
      } else {
        await sendText(ctx.from, "QR unavailable. Try again later.");
      }
    } catch (error) {
      console.error("baskets.qr_fail", error);
      await sendText(ctx.from, "Couldn't generate QR. Try again later.");
    }
    return true;
  }
  if (lower === "close") {
    if (!data.isOwner) {
      await sendText(ctx.from, "Only the owner can close this basket.");
      return true;
    }
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.CLOSE_CONFIRM,
      data,
    });
    await sendConfirmPrompt(ctx.from, `Close basket ${data.basketName}?`, {
      confirmId: IDS.BASKET_CLOSE_CONFIRM,
      cancelId: IDS.BASKET_CLOSE_CANCEL,
      confirmLabel: "Close",
      cancelLabel: "Back",
    });
    return true;
  }
  if (lower === "leave") {
    if (data.isOwner) {
      await sendText(
        ctx.from,
        "Transfer ownership before leaving. Use CLOSE to archive instead.",
      );
      return true;
    }
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.LEAVE_CONFIRM,
      data,
    });
    await sendConfirmPrompt(ctx.from, `Leave basket ${data.basketName}?`, {
      confirmId: IDS.BASKET_LEAVE_CONFIRM,
      cancelId: IDS.BASKET_LEAVE_CANCEL,
      confirmLabel: "Leave",
      cancelLabel: "Back",
    });
    return true;
  }

  await sendText(ctx.from, "Reply SHARE, QR, CLOSE, LEAVE, or BACK.");
  return true;
}

async function handleCloseConfirm(
  ctx: RouterContext,
  lower: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const data = (state.data ?? {}) as BasketActionState;
  if (lower !== "confirm") {
    await loadBasketDetail(ctx, data.basketId);
    return true;
  }
  try {
    await closeBasket(ctx.supabase, {
      profileId: ctx.profileId,
      basketId: data.basketId,
    });
    await sendText(ctx.from, `Basket ${data.basketName} closed.`);
  } catch (error) {
    console.error("baskets.close_fail", error);
    await sendText(ctx.from, "Could not close the basket. Try again later.");
  }
  await clearState(ctx.supabase, ctx.profileId);
  await sendHomeMenu(ctx);
  return true;
}

async function handleLeaveConfirm(
  ctx: RouterContext,
  lower: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const data = (state.data ?? {}) as BasketActionState;
  if (lower !== "confirm") {
    await loadBasketDetail(ctx, data.basketId);
    return true;
  }
  try {
    await leaveBasket(ctx.supabase, {
      profileId: ctx.profileId,
      basketId: data.basketId,
    });
    await sendText(ctx.from, `You left ${data.basketName}.`);
  } catch (error) {
    console.error("baskets.leave_fail", error);
    await sendText(ctx.from, "Could not leave the basket. Try again later.");
    await loadBasketDetail(ctx, data.basketId);
    return true;
  }
  await clearState(ctx.supabase, ctx.profileId);
  await sendHomeMenu(ctx);
  return true;
}

export async function handleBasketConfirmButton(
  ctx: RouterContext,
  id: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (id === IDS.BASKET_CLOSE_CONFIRM && state.key === STATES.CLOSE_CONFIRM) {
    return await handleCloseConfirm(ctx, "confirm", state);
  }
  if (id === IDS.BASKET_CLOSE_CANCEL && state.key === STATES.CLOSE_CONFIRM) {
    const data = (state.data ?? {}) as BasketActionState;
    if (data.basketId) {
      await loadBasketDetail(ctx, data.basketId);
    }
    return true;
  }
  if (id === IDS.BASKET_LEAVE_CONFIRM && state.key === STATES.LEAVE_CONFIRM) {
    return await handleLeaveConfirm(ctx, "confirm", state);
  }
  if (id === IDS.BASKET_LEAVE_CANCEL && state.key === STATES.LEAVE_CONFIRM) {
    const data = (state.data ?? {}) as BasketActionState;
    if (data.basketId) {
      await loadBasketDetail(ctx, data.basketId);
    }
    return true;
  }
  return false;
}

async function loadMyBaskets(ctx: RouterContext): Promise<BasketListRow[]> {
  try {
    const mine = await listMyBaskets(ctx.supabase, ctx.profileId!);
    if (!mine.length) {
      await sendText(
        ctx.from,
        "You have no baskets yet. Create one or join with a code.",
      );
      return [];
    }
    return mine.map((item) => ({
      id: item.id,
      title: truncate(item.name ?? "Basket", 24),
      description: buildMyDescription(
        item.status,
        item.member_count,
        item.balance_minor,
        item.currency ?? "RWF",
      ),
    }));
  } catch (error) {
    console.error("baskets.list_fail", error);
    await sendText(ctx.from, "Couldn't load baskets. Try again later.");
    return [];
  }
}

async function loadBasketDetail(
  ctx: RouterContext,
  basketId: string,
): Promise<void> {
  if (!ctx.profileId) return;
  try {
    const detail = await getBasketDetail(ctx.supabase, {
      profileId: ctx.profileId,
      basketId,
    });
    if (!detail) {
      await sendText(ctx.from, "Basket not found.");
      await startBaskets(ctx, { key: STATES.MENU });
      return;
    }
    const currency = detail.currency ?? "RWF";
    const lines = [
      `🧺 ${detail.name ?? "Basket"}`,
      `Status: ${detail.status ?? "open"}`,
      `Members: ${detail.member_count ?? 0}`,
    ];
    if (typeof detail.balance_minor === "number") {
      lines.push(`Balance: ${fmtCurrency(detail.balance_minor, currency)}`);
    }
    if (typeof detail.goal_minor === "number" && detail.goal_minor > 0) {
      lines.push(`Goal: ${fmtCurrency(detail.goal_minor, currency)}`);
    }
    if (detail.owner_name || detail.owner_whatsapp) {
      lines.push(
        `Owner: ${detail.owner_name ?? maskPhone(detail.owner_whatsapp ?? "")}`,
      );
    }
    if (detail.last_activity) {
      lines.push(`Updated: ${timeAgo(detail.last_activity)}`);
    }
    await sendText(ctx.from, lines.join("\n"));
    await sendText(
      ctx.from,
      "Reply SHARE for invite details, QR for a code, CLOSE to archive, LEAVE to exit, or BACK.",
    );
    const actionState: BasketActionState = {
      basketId,
      basketName: detail.name ?? "Basket",
      shareToken: detail.share_token ?? null,
      isOwner: Boolean(detail.is_owner),
      currency,
    };
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.ACTION,
      data: actionState,
    });
  } catch (error) {
    console.error("baskets.detail_fail", error);
    await sendText(ctx.from, "Couldn't load basket details.");
    await startBaskets(ctx, { key: STATES.MENU });
  }
}

function parseVisibility(lower: string): boolean | null {
  if (["public", "pub", "open"].includes(lower)) return true;
  if (["private", "priv", "closed"].includes(lower)) return false;
  return null;
}

function parseGoal(value: string): number | null | undefined {
  const lower = value.trim().toLowerCase();
  if (!lower || lower === "skip" || lower === "none") return null;
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed * 100;
}

function normalizeShareCode(raw: string): string | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, "");
  const match = cleaned.match(/(?:JB[:\-])?([A-Z0-9]{4,})/);
  return match ? match[1] : null;
}

function formatShareCode(token: string): string {
  const upper = token.toUpperCase();
  return upper.startsWith("JB:") ? upper : `JB:${upper}`;
}

function buildMyDescription(
  status?: string | null,
  members?: number | null,
  balanceMinor?: number | null,
  currency = "RWF",
): string {
  const parts: string[] = [];
  if (typeof members === "number") parts.push(`${members} joined`);
  if (typeof balanceMinor === "number" && balanceMinor >= 0) {
    parts.push(fmtCurrency(balanceMinor, currency));
  }
  if (status) parts.push(status);
  return parts.join(" • ");
}

function buildDiscoverDescription(
  description: string | null,
  distanceKm?: number | null,
  members?: number | null,
): string {
  const parts: string[] = [];
  if (typeof distanceKm === "number") {
    const rounded = Math.round(distanceKm * 10) / 10;
    parts.push(`~${rounded} km`);
  }
  if (typeof members === "number") parts.push(`${members} joined`);
  if (description) parts.push(description);
  return parts.join(" • ");
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
