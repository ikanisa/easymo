import type { RouterContext } from "../types.ts";
import {
  buildButtons,
  sendButtonsMessage,
  sendListMessage,
} from "../utils/reply.ts";
import { clearState, setState } from "../state/store.ts";
import { IDS } from "../wa/ids.ts";
import {
  type BasketDetail,
  type BasketSummary,
  closeBasket,
  createBasket,
  generateBasketQr,
  getBasketDetail,
  joinBasketByCode,
  leaveBasket,
  listMyBaskets,
} from "../rpc/baskets.ts";
import { buildWaLink } from "../utils/share.ts";
import { fmtCurrency, timeAgo, truncate } from "../utils/text.ts";
import { maskPhone } from "./support.ts";
import { sendHomeMenu } from "./home.ts";
import { sendImageUrl, sendText } from "../wa/client.ts";

const STATES = {
  MENU: "basket_menu",
  CREATE_NAME: "basket_create_name",
  CREATE_DESCRIPTION: "basket_create_description",
  CREATE_TYPE: "basket_create_type",
  CREATE_MOMO: "basket_create_momo",
  CREATE_CONFIRM: "basket_create_confirm",
  JOIN_CODE: "basket_join_code",
  LIST: "basket_list",
  DETAIL: "basket_detail",
  MEMBERS: "basket_members",
  CLOSE_CONFIRM: "basket_close_confirm",
  LEAVE_CONFIRM: "basket_leave_confirm",
} as const;

type BasketState = { key: string; data?: Record<string, unknown> };

type CreateState = {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  momoTarget?: string | null;
};

type DetailState = {
  basketId: string;
  basketName: string;
  shareToken: string | null;
  isOwner: boolean;
  currency: string;
  description?: string | null;
  momoTarget?: string | null;
  origin?: "menu" | "list";
};

export async function startBaskets(
  ctx: RouterContext,
  _state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, { key: STATES.MENU, data: {} });
  await sendListMessage(
    ctx,
    {
      title: "🧺 Baskets",
      body: "Manage shared savings circles for your friends or team.",
      sectionTitle: "Actions",
      rows: [
        {
          id: IDS.BASKET_CREATE,
          title: "Create basket",
          description: "Set up a new shared savings basket.",
        },
        {
          id: IDS.BASKET_MY,
          title: "My baskets",
          description: "Open baskets you manage or joined.",
        },
        {
          id: IDS.BACK_MENU,
          title: "← Back",
          description: "Return to the main menu.",
        },
      ],
      buttonText: "View",
    },
    { emoji: "🧺" },
  );
  return true;
}

export async function handleBasketButton(
  ctx: RouterContext,
  state: BasketState,
  id: string,
): Promise<boolean> {
  switch (id) {
    case IDS.BASKET_CREATE:
      return await beginCreateFlow(ctx);
    case IDS.BASKET_CREATE_PUBLIC:
      return await setCreateType(ctx, state, true);
    case IDS.BASKET_CREATE_PRIVATE:
      return await setCreateType(ctx, state, false);
    case IDS.BASKET_CREATE_CONFIRM:
      return await finalizeCreate(ctx, state);
    case IDS.BASKET_JOIN:
      return await beginJoinFlow(ctx);
    case IDS.BASKET_MY:
      return await showMyBaskets(ctx, state);
    case IDS.BASKET_DISCOVER:
      await sendButtonsMessage(
        ctx,
        "Nearby basket discovery is disabled. Use an invite code to join.",
        [
          { id: IDS.BASKET_JOIN, title: "🔑 Join with code" },
          { id: IDS.BASKET_CREATE, title: "➕ Create" },
        ],
      );
      return true;
    case IDS.BASKET_ADD_CONTRIBUTION:
      return await promptContribution(ctx, state);
    case IDS.BASKET_VIEW_MEMBERS:
      return await showBasketMembers(ctx, state);
    case IDS.BASKET_SHARE:
      if (state.key === STATES.DETAIL) {
        return await sendInviteDetails(ctx, state);
      }
      return await showMyBaskets(ctx, state);
    case IDS.BASKET_QR:
      if (state.key === STATES.DETAIL) {
        return await sendBasketQr(ctx, state);
      }
      return await showMyBaskets(ctx, state);
    case IDS.BASKET_CLOSE:
      if (state.key === STATES.DETAIL) {
        return await promptCloseBasket(ctx, state);
      }
      return await showMyBaskets(ctx, state);
    case IDS.BASKET_LEAVE:
      if (state.key === STATES.DETAIL) {
        return await promptLeaveBasket(ctx, state);
      }
      return await showMyBaskets(ctx, state);
    case IDS.BASKET_BACK:
      return await handleBasketBack(ctx, state);
    case IDS.BACK_MENU:
      return await handleBasketBack(ctx, state);
    case IDS.BASKET_SKIP:
      return await handleCreateSkip(ctx, state);
    default:
      return false;
  }
}

export async function handleBasketListSelection(
  ctx: RouterContext,
  id: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.LIST) return false;
  if (id === IDS.BASKET_JOIN) {
    return await beginJoinFlow(ctx);
  }
  if (id === IDS.BACK_MENU) {
    return await startBaskets(ctx, { key: STATES.MENU });
  }
  const rows = state.data?.rows as BasketSummary[] | undefined;
  const match = rows?.find((row) => row.id === id);
  if (!match) return false;
  await showBasketDetail(ctx, match.id, "list");
  return true;
}

export async function handleBasketText(
  ctx: RouterContext,
  body: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const trimmed = body.trim();
  if (!trimmed) return false;

  switch (state.key) {
    case STATES.CREATE_NAME:
      return await handleCreateName(ctx, trimmed);
    case STATES.CREATE_DESCRIPTION:
      return await handleCreateDescription(ctx, trimmed, state);
    case STATES.CREATE_MOMO:
      return await handleCreateMomo(ctx, trimmed, state);
    case STATES.JOIN_CODE:
      return await handleJoinCode(ctx, trimmed, state);
    default:
      if (
        trimmed.toLowerCase() === "menu" || trimmed.toLowerCase() === "home"
      ) {
        await startBaskets(ctx, state);
        return true;
      }
      return false;
  }
}

export async function handleBasketConfirmButton(
  ctx: RouterContext,
  id: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (id === IDS.BASKET_CLOSE_CONFIRM && state.key === STATES.CLOSE_CONFIRM) {
    return await performClose(ctx, state);
  }
  if (id === IDS.BASKET_CLOSE_CANCEL && state.key === STATES.CLOSE_CONFIRM) {
    const detail = state.data as DetailState;
    return await showBasketDetail(
      ctx,
      detail.basketId,
      detail.origin ?? "list",
    );
  }
  if (id === IDS.BASKET_LEAVE_CONFIRM && state.key === STATES.LEAVE_CONFIRM) {
    return await performLeave(ctx, state);
  }
  if (id === IDS.BASKET_LEAVE_CANCEL && state.key === STATES.LEAVE_CONFIRM) {
    const detail = state.data as DetailState;
    return await showBasketDetail(
      ctx,
      detail.basketId,
      detail.origin ?? "list",
    );
  }
  return false;
}

export function handleBasketLocation(): Promise<boolean> {
  return Promise.resolve(false);
}

// Creation -----------------------------------------------------------------

async function beginCreateFlow(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CREATE_NAME,
    data: {},
  });
  await sendButtonsMessage(
    ctx,
    "Name your basket (2–60 characters).",
    [{ id: IDS.BASKET_BACK, title: "↩️ Back" }],
    { emoji: "🧺" },
  );
  return true;
}

async function handleCreateName(
  ctx: RouterContext,
  value: string,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (value.length < 2 || value.length > 60) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Name must be between 2 and 60 characters.",
      [{ id: IDS.BASKET_BACK, title: "↩️ Back" }],
    );
    return true;
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CREATE_DESCRIPTION,
    data: { name: value },
  });
  await sendButtonsMessage(
    ctx,
    "Add a short description (or tap Skip).",
    [{ id: IDS.BASKET_SKIP, title: "Skip" }],
  );
  return true;
}

async function handleCreateDescription(
  ctx: RouterContext,
  value: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const createState = (state.data ?? {}) as CreateState;
  const trimmed = value.trim();
  const description = trimmed.toLowerCase() === "skip"
    ? null
    : trimmed.slice(0, 160);
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CREATE_TYPE,
    data: { ...createState, description },
  });
  await sendButtonsMessage(
    ctx,
    "Should the basket be public (anyone can find it) or private?",
    [
      { id: IDS.BASKET_CREATE_PUBLIC, title: "🌍 Public" },
      { id: IDS.BASKET_CREATE_PRIVATE, title: "🔒 Private" },
    ],
  );
  return true;
}

async function setCreateType(
  ctx: RouterContext,
  state: BasketState,
  isPublic: boolean,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const current = (state.data ?? {}) as CreateState;
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CREATE_MOMO,
    data: { ...current, isPublic },
  });
  await sendButtonsMessage(
    ctx,
    "Enter the MoMo number or code that should receive contributions.",
    [{ id: IDS.BASKET_SKIP, title: "Skip" }],
  );
  return true;
}

async function handleCreateMomo(
  ctx: RouterContext,
  value: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const createState = (state.data ?? {}) as CreateState;
  const name = createState.name?.trim();
  if (!name) {
    await startBaskets(ctx, state);
    return true;
  }
  const trimmed = value.trim();
  const momo = !trimmed || trimmed.toLowerCase() === "skip" ? null : trimmed;
  await showCreateSummary(ctx, {
    ...createState,
    momoTarget: momo,
  });
  return true;
}

async function handleCreateSkip(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const createState = (state.data ?? {}) as CreateState;
  switch (state.key) {
    case STATES.CREATE_DESCRIPTION:
      await setState(ctx.supabase, ctx.profileId, {
        key: STATES.CREATE_TYPE,
        data: { ...createState, description: null },
      });
      await sendButtonsMessage(
        ctx,
        "Should the basket be public (anyone can find it) or private?",
        [
          { id: IDS.BASKET_CREATE_PUBLIC, title: "🌍 Public" },
          { id: IDS.BASKET_CREATE_PRIVATE, title: "🔒 Private" },
        ],
      );
      return true;
    case STATES.CREATE_MOMO:
      await showCreateSummary(ctx, { ...createState, momoTarget: null });
      return true;
    default:
      return false;
  }
}

async function handleBasketBack(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  switch (state.key) {
    case STATES.MENU:
      await sendHomeMenu(ctx);
      return true;
    case STATES.CREATE_NAME:
    case STATES.CREATE_DESCRIPTION:
    case STATES.CREATE_TYPE:
    case STATES.CREATE_MOMO:
    case STATES.CREATE_CONFIRM:
    case STATES.JOIN_CODE:
      await startBaskets(ctx, { key: STATES.MENU });
      return true;
    case STATES.LIST:
      await startBaskets(ctx, state);
      return true;
    case STATES.MEMBERS: {
      const detail = (state.data?.detail ?? state.data) as
        | DetailState
        | undefined;
      if (detail?.basketId) {
        await showBasketDetail(ctx, detail.basketId, detail.origin ?? "list");
        return true;
      }
      await showMyBaskets(ctx, { key: STATES.LIST });
      return true;
    }
    case STATES.DETAIL: {
      const detail = state.data as DetailState | undefined;
      if (detail?.origin === "list") {
        await showMyBaskets(ctx, { key: STATES.LIST });
        return true;
      }
      await startBaskets(ctx, { key: STATES.MENU });
      return true;
    }
    case STATES.CLOSE_CONFIRM:
    case STATES.LEAVE_CONFIRM: {
      const detail = state.data as DetailState | undefined;
      if (detail?.basketId) {
        await showBasketDetail(ctx, detail.basketId, detail.origin ?? "list");
        return true;
      }
      await startBaskets(ctx, { key: STATES.MENU });
      return true;
    }
    default:
      await startBaskets(ctx, { key: STATES.MENU });
      return true;
  }
}

async function showCreateSummary(
  ctx: RouterContext,
  createState: CreateState,
): Promise<void> {
  if (!ctx.profileId) return;
  const name = createState.name ?? "Basket";
  const summaryLines = [
    `Name: ${name}`,
    `Type: ${createState.isPublic ? "Public" : "Private"}`,
  ];
  if (createState.description) {
    summaryLines.push(`Description: ${createState.description}`);
  }
  if (createState.momoTarget) {
    summaryLines.push(`MoMo contact: ${createState.momoTarget}`);
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CREATE_CONFIRM,
    data: createState,
  });
  await sendButtonsMessage(
    ctx,
    [`Review basket details before creating:
${summaryLines.join("\n")}`].join(""),
    [{ id: IDS.BASKET_CREATE_CONFIRM, title: "Create" }],
  );
}

async function finalizeCreate(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.CREATE_CONFIRM) return false;
  const createState = (state.data ?? {}) as CreateState;
  const name = createState.name?.trim();
  if (!name) {
    await startBaskets(ctx, state);
    return true;
  }
  await sendButtonsMessage(ctx, "⏳ Creating your basket…", [
    { id: IDS.BASKET_BACK, title: "↩️ Back" },
  ]);
  try {
    const result = await createBasket(ctx.supabase, {
      profileId: ctx.profileId,
      whatsapp: ctx.from,
      name,
      isPublic: Boolean(createState.isPublic),
      goalMinor: null,
    });
    if (result.id) {
      const updates: Record<string, unknown> = {};
      if (createState.description != null) {
        updates.description = createState.description;
      }
      if (createState.momoTarget != null) {
        updates.momo_number_or_code = createState.momoTarget;
      }
      if (Object.keys(updates).length) {
        const { error: updateError } = await ctx.supabase
          .from("baskets")
          .update(updates)
          .eq("id", result.id);
        if (updateError) {
          console.error("baskets.create_update_fail", updateError);
        }
      }
    }
    await clearState(ctx.supabase, ctx.profileId);
    await sendCreationSummary(ctx, name, result.shareToken, result.qrUrl);
    if (result.id) {
      await showBasketDetail(ctx, result.id, "menu");
    }
  } catch (error) {
    console.error("baskets.create_fail", error);
    await sendButtonsMessage(
      ctx,
      errorMessage(error, "⚠️ Could not create the basket. Try again soon."),
      [{ id: IDS.BASKET_CREATE, title: "🔁 Retry" }],
    );
  }
  return true;
}

// Join ---------------------------------------------------------------------

async function beginJoinFlow(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.JOIN_CODE,
    data: {},
  });
  await sendButtonsMessage(
    ctx,
    "Enter the invite code (format JB:1234).",
    [{ id: IDS.BASKET_BACK, title: "↩️ Back" }],
  );
  return true;
}

async function handleJoinCode(
  ctx: RouterContext,
  value: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const code = normalizeShareCode(value);
  if (!code) {
    await sendButtonsMessage(
      ctx,
      "⚠️ Invalid code. Example: JB:1A2B.",
      [{ id: IDS.BASKET_BACK, title: "↩️ Back" }],
    );
    return true;
  }
  await sendButtonsMessage(ctx, "⏳ Joining basket…", [{
    id: IDS.BASKET_BACK,
    title: "↩️ Back",
  }]);
  try {
    const joined = await joinBasketByCode(ctx.supabase, {
      profileId: ctx.profileId,
      whatsapp: ctx.from,
      code,
    });
    await showBasketDetail(ctx, joined.basketId, "list");
  } catch (error) {
    console.error("baskets.join_fail", error);
    await sendButtonsMessage(
      ctx,
      errorMessage(error, "⚠️ Could not join basket. Check the code."),
      [{ id: IDS.BASKET_JOIN, title: "🔁 Retry" }],
    );
  }
  return true;
}

// Listing & detail ---------------------------------------------------------

async function showMyBaskets(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const rows = await listMyBaskets(ctx.supabase, ctx.profileId);
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.LIST,
      data: { rows },
    });

    const listRows = [
      {
        id: IDS.BASKET_JOIN,
        title: "Join with code",
        description: "Enter an invite code you received.",
      },
      ...rows.map((row) => ({
        id: row.id,
        title: truncate(row.name ?? "Basket", 40),
        description: buildMyDescription(
          row.status,
          row.member_count,
          row.balance_minor,
          row.currency ?? "RWF",
        ),
      })),
      {
        id: IDS.BACK_MENU,
        title: "← Back",
        description: "Return to the baskets menu.",
      },
    ];

    await sendListMessage(
      ctx,
      {
        title: "📋 My baskets",
        body: rows.length
          ? "Tap a basket to view details."
          : "You are not part of any baskets yet.",
        sectionTitle: "Baskets",
        rows: listRows.slice(0, 10),
        buttonText: "View",
      },
      { emoji: "🧺" },
    );
    return true;
  } catch (error) {
    console.error("baskets.list_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn't load your baskets. Try again soon.",
      buildButtons({ id: IDS.BASKET_MY, title: "🔁 Retry" }),
    );
    return true;
  }
}

async function showBasketDetail(
  ctx: RouterContext,
  basketId: string,
  origin: "menu" | "list" = "menu",
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const detail = await getBasketDetail(ctx.supabase, {
      profileId: ctx.profileId,
      basketId,
    });
    if (!detail) {
      await sendButtonsMessage(
        ctx,
        "⚠️ Basket not found.",
        [{ id: IDS.BASKET_MY, title: "📋 My baskets" }],
      );
      return true;
    }

    const meta = await ctx.supabase
      .from("baskets")
      .select("description, momo_number_or_code")
      .eq("id", basketId)
      .maybeSingle();
    if (meta.error) {
      console.error("baskets.detail_meta_fail", meta.error);
    }
    const extra = (meta.data ?? {}) as {
      description?: string | null;
      momo_number_or_code?: string | null;
    };

    const detailState: DetailState = {
      basketId,
      basketName: detail.name ?? "Basket",
      shareToken: detail.share_token ?? null,
      isOwner: Boolean(detail.is_owner),
      currency: detail.currency ?? "RWF",
      description: extra.description ?? null,
      momoTarget: extra.momo_number_or_code ?? null,
      origin,
    };

    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.DETAIL,
      data: detailState,
    });

    const summary = formatBasketSummary(detail, detailState);

    await sendListMessage(
      ctx,
      {
        title: "🧺 Basket actions",
        body: summary,
        sectionTitle: "Actions",
        buttonText: "View",
        rows: buildDetailRows(detailState),
      },
      { emoji: "🧺" },
    );
    return true;
  } catch (error) {
    console.error("baskets.detail_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn't load basket details. Try again.",
      [{ id: IDS.BASKET_MY, title: "📋 My baskets" }],
    );
    return true;
  }
}

async function sendInviteDetails(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.DETAIL) return false;
  const detail = state.data as DetailState;
  if (!detail.shareToken) {
    await sendButtonsMessage(
      ctx,
      "No invite code available. Ask the owner to refresh.",
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
    return true;
  }
  const shareCode = formatShareCode(detail.shareToken);
  const shareLink = buildWaLink(
    `Join ${detail.basketName} with code ${shareCode}`,
  );
  const lines = [
    `Invite friends to *${detail.basketName}*`,
    `Code: ${shareCode}`,
  ];
  if (shareLink) lines.push(`Link: ${shareLink}`);
  await sendText(ctx.from, lines.join("\n"));
  await sendButtonsMessage(
    ctx,
    "Share details sent above.",
    [{ id: IDS.BACK_MENU, title: "Done" }],
  );
  return true;
}

async function sendBasketQr(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.DETAIL) return false;
  const detail = state.data as DetailState;
  try {
    const qr = await generateBasketQr(ctx.supabase, {
      profileId: ctx.profileId,
      basketId: detail.basketId,
    });
    if (qr.qrUrl) {
      await sendImageUrl(ctx.from, qr.qrUrl, `${detail.basketName} QR`);
      await sendButtonsMessage(
        ctx,
        "🧾 QR code ready. Share the image above with your group.",
        [{ id: IDS.BACK_MENU, title: "Done" }],
      );
    } else {
      await sendButtonsMessage(
        ctx,
        "QR unavailable right now.",
        [{ id: IDS.BACK_MENU, title: "Done" }],
      );
    }
  } catch (error) {
    console.error("baskets.qr_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn't generate the QR code.",
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
  }
  return true;
}

async function promptCloseBasket(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.DETAIL) return false;
  const detail = state.data as DetailState;
  if (!detail.isOwner) {
    await sendButtonsMessage(
      ctx,
      "Only the owner can close this basket.",
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
    return true;
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.CLOSE_CONFIRM,
    data: detail,
  });
  await sendButtonsMessage(
    ctx,
    `Close *${detail.basketName}*? This stops new contributions.`,
    [
      { id: IDS.BASKET_CLOSE_CONFIRM, title: "🛑 Close" },
      { id: IDS.BASKET_CLOSE_CANCEL, title: "↩️ Back" },
    ],
  );
  return true;
}

async function promptLeaveBasket(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.DETAIL) return false;
  const detail = state.data as DetailState;
  if (detail.isOwner) {
    await sendButtonsMessage(
      ctx,
      "Owners cannot leave their own basket. Close it instead.",
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
    return true;
  }
  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.LEAVE_CONFIRM,
    data: detail,
  });
  await sendButtonsMessage(
    ctx,
    `Leave *${detail.basketName}*? You can rejoin later with the invite code.`,
    [
      { id: IDS.BASKET_LEAVE_CONFIRM, title: "🚪 Leave" },
      { id: IDS.BASKET_LEAVE_CANCEL, title: "↩️ Back" },
    ],
  );
  return true;
}

async function performClose(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const detail = state.data as DetailState;
  try {
    await closeBasket(ctx.supabase, {
      profileId: ctx.profileId,
      basketId: detail.basketId,
    });
    await clearState(ctx.supabase, ctx.profileId);
    await sendButtonsMessage(
      ctx,
      `🛑 Basket *${detail.basketName}* closed.`,
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
  } catch (error) {
    console.error("baskets.close_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not close the basket. Try again later.",
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
    await showBasketDetail(ctx, detail.basketId, detail.origin ?? "list");
  }
  return true;
}

async function performLeave(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const detail = state.data as DetailState;
  try {
    await leaveBasket(ctx.supabase, {
      profileId: ctx.profileId,
      basketId: detail.basketId,
    });
    await clearState(ctx.supabase, ctx.profileId);
    await sendButtonsMessage(
      ctx,
      `You left *${detail.basketName}*.`,
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
  } catch (error) {
    console.error("baskets.leave_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not leave the basket. Try again later.",
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
    await showBasketDetail(ctx, detail.basketId, detail.origin ?? "list");
  }
  return true;
}

// Helpers ------------------------------------------------------------------

async function sendCreationSummary(
  ctx: RouterContext,
  name: string,
  shareToken: string | null,
  qrUrl: string | null,
): Promise<void> {
  const lines = [`✅ Basket *${name}* is ready!`];
  if (shareToken) {
    const code = formatShareCode(shareToken);
    lines.push(`Invite code: ${code}`);
    const link = buildWaLink(`Join ${name} with code ${code}`);
    if (link) lines.push(`Invite link: ${link}`);
  }
  await sendText(ctx.from, lines.join("\n"));
  if (qrUrl) {
    await sendImageUrl(ctx.from, qrUrl, `${name} QR`);
  }
}

function formatBasketSummary(
  detail: BasketDetail,
  extras?: { description?: string | null; momoTarget?: string | null },
): string {
  const currency = detail.currency ?? "RWF";
  const lines = [
    `🧺 *${detail.name ?? "Basket"}*`,
    `Status: ${detail.status ?? "open"}`,
    `Members: ${detail.member_count ?? 0}`,
  ];
  if (typeof detail.balance_minor === "number") {
    lines.push(`Balance: ${fmtCurrency(detail.balance_minor, currency)}`);
  }
  if (typeof detail.goal_minor === "number" && detail.goal_minor > 0) {
    lines.push(`Goal: ${fmtCurrency(detail.goal_minor, currency)}`);
  }
  if (extras?.description) {
    lines.push(`About: ${extras.description}`);
  }
  if (detail.owner_name || detail.owner_whatsapp) {
    lines.push(
      `Owner: ${detail.owner_name ?? maskPhone(detail.owner_whatsapp ?? "")}`,
    );
  }
  if (extras?.momoTarget) {
    lines.push(`MoMo: ${extras.momoTarget}`);
  }
  if (detail.last_activity) {
    lines.push(`Updated: ${timeAgo(detail.last_activity)}`);
  }
  return lines.join("\n");
}

function buildDetailRows(detail: DetailState) {
  const rows: Array<{ id: string; title: string; description: string }> = [
    {
      id: IDS.BASKET_ADD_CONTRIBUTION,
      title: "Add contribution",
      description: "Record a payment and notify the owner.",
    },
    {
      id: IDS.BASKET_VIEW_MEMBERS,
      title: "View members",
      description: "See who is in this basket.",
    },
    {
      id: IDS.BASKET_SHARE,
      title: "Share basket",
      description: "Send invite link or QR code.",
    },
  ];
  if (detail.isOwner) {
    rows.push({
      id: IDS.BASKET_CLOSE,
      title: "Close basket",
      description: "Stop new contributions and finish the basket.",
    });
  } else {
    rows.push({
      id: IDS.BASKET_LEAVE,
      title: "Leave basket",
      description: "Exit this basket and stop receiving updates.",
    });
  }
  rows.push({
    id: IDS.BACK_MENU,
    title: "← Back",
    description: "Return to the previous menu.",
  });
  return rows;
}

async function promptContribution(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  let detail: DetailState | undefined;
  if (state.key === STATES.DETAIL) {
    detail = state.data as DetailState;
  } else if (state.key === STATES.MEMBERS) {
    detail = (state.data?.detail ?? state.data) as DetailState | undefined;
  }
  if (!detail) return false;
  const lines = [
    `Send your contribution for *${detail.basketName}*.`,
  ];
  if (detail.momoTarget) {
    lines.push(`MoMo: ${detail.momoTarget}`);
  }
  if (detail.shareToken) {
    lines.push(`Invite code: ${formatShareCode(detail.shareToken)}`);
  }
  lines.push("Reply with your payment reference so the owner can approve it.");
  await sendButtonsMessage(
    ctx,
    lines.join("\n"),
    [{ id: IDS.BACK_MENU, title: "Done" }],
  );
  return true;
}

async function showBasketMembers(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  let detail: DetailState | undefined;
  if (state.key === STATES.DETAIL) {
    detail = state.data as DetailState;
  } else if (state.key === STATES.MEMBERS) {
    detail = (state.data?.detail ?? state.data) as DetailState | undefined;
  }
  if (!detail) return false;
  try {
    const { data, error } = await ctx.supabase
      .from("basket_members")
      .select("whatsapp, role, total_contributed, joined_at")
      .eq("basket_id", detail.basketId)
      .order("joined_at", { ascending: true })
      .limit(9);
    if (error) throw error;
    const memberRows = (data ?? []).map((member, idx) =>
      buildMemberRow(
        member,
        idx,
        detail.currency,
      )
    );
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.MEMBERS,
      data: { detail },
    });
    await sendListMessage(
      ctx,
      {
        title: "👥 Basket members",
        body: detail.basketName,
        sectionTitle: "Members",
        buttonText: "View",
        rows: [
          ...memberRows,
          {
            id: IDS.BACK_MENU,
            title: "← Back",
            description: "Return to basket actions.",
          },
        ].slice(0, 10),
      },
      { emoji: "👥" },
    );
    return true;
  } catch (error) {
    console.error("baskets.members_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Couldn't load members right now.",
      [{ id: IDS.BACK_MENU, title: "Done" }],
    );
    return true;
  }
}

function buildMemberRow(
  member: {
    whatsapp?: string | null;
    role?: string | null;
    total_contributed?: number | null;
    joined_at?: string | null;
  },
  index: number,
  currency: string | undefined,
) {
  const name = member.whatsapp
    ? maskPhone(member.whatsapp)
    : `Member ${index + 1}`;
  const parts: string[] = [];
  if (typeof member.total_contributed === "number") {
    parts.push(fmtCurrency(member.total_contributed, currency ?? "RWF"));
  }
  if (member.role) parts.push(member.role);
  if (member.joined_at) parts.push(timeAgo(member.joined_at));
  return {
    id: `basket_member::${index}`,
    title: name.slice(0, 24),
    description: parts.length ? parts.join(" • ") : "Member",
  };
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

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
