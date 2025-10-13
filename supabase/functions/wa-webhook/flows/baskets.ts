import type { SupabaseClient } from "../deps.ts";
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
  LOAN_AMOUNT: "basket_loan_amount",
  LOAN_PURPOSE: "basket_loan_purpose",
  LOAN_TENURE: "basket_loan_tenure",
  LOAN_CONFIRM: "basket_loan_confirm",
  LOAN_APPROVAL_SELECT: "basket_loan_approval_select",
  LOAN_APPROVAL_DECISION: "basket_loan_approval_decision",
} as const;

const MENU_KEYS = {
  NON_MEMBER: "baskets_non_member",
  MEMBER: "baskets_member",
  COMMITTEE: "baskets_committee",
} as const;

const FALLBACK_NON_MEMBER_ROWS = [
  {
    id: IDS.BASKET_CREATE,
    title: "Create basket",
    description: "Set up a new shared savings basket.",
  },
  {
    id: IDS.BASKET_JOIN,
    title: "Join with code",
    description: "Enter an invite code to join an existing basket.",
  },
  {
    id: IDS.BACK_MENU,
    title: "← Back",
    description: "Return to the main menu.",
  },
];

const FALLBACK_MEMBER_ROWS = [
  {
    id: IDS.BASKET_MY,
    title: "My baskets",
    description: "Open baskets you manage or joined.",
  },
  {
    id: IDS.BASKET_JOIN,
    title: "Join with code",
    description: "Enter an invite code to join another basket.",
  },
  {
    id: IDS.BASKET_SHARE,
    title: "Share invite link",
    description: "Send the invite link or QR code to others.",
  },
  {
    id: IDS.BASKET_QR,
    title: "Show MoMo QR",
    description: "Display the QR code for contributions.",
  },
  {
    id: IDS.BASKET_LOAN_REQUEST,
    title: "Request loan",
    description: "Start a SACCO-backed loan request.",
  },
  {
    id: IDS.BASKET_LOAN_STATUS,
    title: "Loan status",
    description: "Check current applications.",
  },
  {
    id: IDS.BACK_MENU,
    title: "← Back",
    description: "Return to the main menu.",
  },
];

type MenuEntry = {
  id: string;
  title: string;
  description?: string;
};

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

type LoanRequestState = {
  membershipId: string;
  ikiminaId: string;
  amount?: number;
  currency?: string;
  purpose?: string;
  tenure?: number;
  role?: string | null;
  quorum?: LoanQuorum;
};

type LoanQuorum = {
  threshold: number | null;
  roles: string[];
};

async function fetchActiveMembership(
  client: SupabaseClient,
  profileId: string,
): Promise<{ membershipId: string; ikiminaId: string; role: string | null }> {
  const { data: membership, error } = await client
    .from("ibimina_members")
    .select("id, ikimina_id")
    .eq("user_id", profileId)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("baskets.fetch_membership_failed", error);
    throw new Error("membership_lookup_failed");
  }

  if (!membership) {
    throw new Error("no_active_membership");
  }

  const { data: committee } = await client
    .from("ibimina_committee")
    .select("role")
    .eq("ikimina_id", membership.ikimina_id)
    .eq("member_id", membership.id)
    .maybeSingle();

  return {
    membershipId: membership.id,
    ikiminaId: membership.ikimina_id,
    role: committee?.role ?? null,
  };
}

async function fetchIkiminaQuorum(
  client: SupabaseClient,
  ikiminaId: string,
): Promise<LoanQuorum> {
  const { data, error } = await client
    .from("ibimina_settings")
    .select("quorum")
    .eq("ikimina_id", ikiminaId)
    .maybeSingle();
  if (error) {
    console.error("baskets.quorum_fetch_failed", error);
    return { threshold: null, roles: [] };
  }
  return parseLoanQuorum(data?.quorum ?? null);
}

function parseLoanQuorum(value: unknown): LoanQuorum {
  if (!value || typeof value !== "object") {
    return { threshold: null, roles: [] };
  }
  const record = value as { threshold?: unknown; roles?: unknown };
  const threshold = typeof record.threshold === "number"
    ? record.threshold
    : record.threshold != null && Number.isFinite(Number(record.threshold))
    ? Number(record.threshold)
    : null;
  const roles = Array.isArray(record.roles)
    ? record.roles.filter((role): role is string =>
      typeof role === "string" && role.trim().length > 0
    ).map((role) => role.trim())
    : [];
  return { threshold, roles };
}

function approvalsSatisfied(
  endorsements: Array<{ vote: string; role?: string | null }>,
  quorum: LoanQuorum,
): {
  approvalsMet: boolean;
  rolesMet: boolean;
  pending: number;
  approvals: number;
  rejections: number;
} {
  const approvals = endorsements.filter((row) => row.vote === "approve").length;
  const rejections = endorsements.filter((row) => row.vote === "reject").length;
  const pending = endorsements.filter((row) => row.vote === "pending").length;
  const requiredThreshold = quorum.threshold ?? endorsements.length;
  const rolesMet = quorum.roles.length === 0 ||
    quorum.roles.every((role) =>
      endorsements.some((row) => row.role === role && row.vote === "approve")
    );
  const approvalsMet = approvals >= requiredThreshold;
  return { approvalsMet, rolesMet, pending, approvals, rejections };
}

async function isLoansFeatureEnabled(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client
    .from("settings")
    .select("value")
    .eq("key", "baskets.feature_flags")
    .maybeSingle();

  if (error) {
    console.error("baskets.loans_feature_flags_failed", error);
    return true;
  }

  const flags = (data?.value ?? {}) as Record<string, unknown>;
  return Boolean(flags?.loans_enabled ?? false);
}

function parseNumeric(input: string): number | null {
  const numeric = input.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  if (!numeric) return null;
  const value = Number.parseFloat(numeric);
  return Number.isFinite(value) ? value : null;
}

function formatLoanAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

async function loadMenuEntries(
  client: SupabaseClient,
  menuKey: string,
): Promise<MenuEntry[]> {
  const { data, error } = await client
    .from("whatsapp_menu_entries")
    .select("payload_id, title, description, emoji")
    .eq("menu_key", menuKey)
    .eq("is_enabled", true)
    .order("position", { ascending: true });

  if (error) {
    console.error("baskets.menu_load_failed", {
      menuKey,
      error: error.message,
    });
    return [];
  }
  if (!data) return [];

  return data
    .map((row) => {
      const payload = row.payload_id?.trim();
      if (!payload) return null;
      const decoratedTitle = row.emoji
        ? `${row.emoji} ${row.title}`.trim()
        : row.title;
      return {
        id: payload,
        title: decoratedTitle,
        description: row.description ?? undefined,
      } as MenuEntry;
    })
    .filter((entry): entry is MenuEntry => Boolean(entry));
}

export async function startBaskets(
  ctx: RouterContext,
  _state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;

  let hasMembership = false;
  try {
    const memberships = await listMyBaskets(ctx.supabase, ctx.profileId);
    hasMembership = Array.isArray(memberships) && memberships.length > 0;
  } catch (error) {
    console.error("baskets.menu_membership_lookup_failed", error);
  }

  const menuKey = hasMembership ? MENU_KEYS.MEMBER : MENU_KEYS.NON_MEMBER;
  const dynamicRows = await loadMenuEntries(ctx.supabase, menuKey);

  const rows =
    (dynamicRows.length
      ? dynamicRows
      : hasMembership
      ? FALLBACK_MEMBER_ROWS
      : FALLBACK_NON_MEMBER_ROWS)
      .map<MenuEntry>((entry) => ({
        id: entry.id,
        title: entry.title,
        description: entry.description,
      }));

  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.MENU,
    data: { menuKey },
  });

  await sendListMessage(
    ctx,
    {
      title: "🧺 Baskets",
      body: "Manage shared savings circles for your friends or team.",
      sectionTitle: "Actions",
      rows,
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
    case IDS.BASKET_LOAN_REQUEST:
      return await beginLoanRequest(ctx);
    case IDS.BASKET_LOAN_STATUS:
      return await showLoanStatus(ctx);
    case IDS.BASKET_LOAN_APPROVALS:
      return await startLoanApprovals(ctx, state);
    case IDS.BASKET_LOAN_SUBMIT:
      if (state.key === STATES.LOAN_CONFIRM) {
        return await submitLoanRequest(ctx, state);
      }
      return false;
    case IDS.BASKET_LOAN_CANCEL:
      if (ctx.profileId) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      await sendButtonsMessage(
        ctx,
        "Loan request cancelled.",
        [{ id: IDS.BASKET_MY, title: "📋 My baskets" }],
      );
      return true;
    case IDS.BASKET_LOAN_APPROVE_VOTE:
      if (state.key === STATES.LOAN_APPROVAL_DECISION) {
        return await submitLoanVote(ctx, state, "approve");
      }
      return false;
    case IDS.BASKET_LOAN_REJECT_VOTE:
      if (state.key === STATES.LOAN_APPROVAL_DECISION) {
        return await submitLoanVote(ctx, state, "reject");
      }
      return false;
    case IDS.BASKET_LOAN_BACK:
      if (
        state.key === STATES.LOAN_APPROVAL_DECISION ||
        state.key === STATES.LOAN_APPROVAL_SELECT
      ) {
        return await startLoanApprovals(ctx, {
          key: STATES.LOAN_APPROVAL_SELECT,
          data: state.data,
        });
      }
      if (ctx.profileId) {
        await clearState(ctx.supabase, ctx.profileId);
      }
      return await startBaskets(ctx, { key: STATES.MENU });
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
  if (!ctx.profileId) return false;

  if (state.key === STATES.LIST) {
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

  if (state.key === STATES.LOAN_APPROVAL_SELECT) {
    if (id === IDS.BACK_MENU || id === IDS.BASKET_LOAN_BACK) {
      return await startBaskets(ctx, { key: STATES.MENU });
    }
    if (!id.startsWith("loan:")) return false;
    const loanId = id.substring(5);
    if (!loanId) return false;
    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.LOAN_APPROVAL_DECISION,
      data: { ...(state.data ?? {}), loanId },
    });
    await sendButtonsMessage(
      ctx,
      "Approve or reject this loan request?",
      [
        { id: IDS.BASKET_LOAN_APPROVE_VOTE, title: "✅ Approve" },
        { id: IDS.BASKET_LOAN_REJECT_VOTE, title: "✖ Reject" },
        { id: IDS.BASKET_LOAN_BACK, title: "← Back" },
      ],
    );
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

  switch (state.key) {
    case STATES.CREATE_NAME:
      return await handleCreateName(ctx, trimmed);
    case STATES.CREATE_DESCRIPTION:
      return await handleCreateDescription(ctx, trimmed, state);
    case STATES.CREATE_MOMO:
      return await handleCreateMomo(ctx, trimmed, state);
    case STATES.JOIN_CODE:
      return await handleJoinCode(ctx, trimmed, state);
    case STATES.LOAN_AMOUNT:
      return await handleLoanAmount(ctx, trimmed, state);
    case STATES.LOAN_PURPOSE:
      return await handleLoanPurpose(ctx, trimmed, state);
    case STATES.LOAN_TENURE:
      return await handleLoanTenure(ctx, trimmed, state);
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
  const lower = trimmed.toLowerCase();
  if (!trimmed || lower === "skip") {
    await showCreateSummary(ctx, { ...createState, momoTarget: null });
    return true;
  }

  const normalized = trimmed.replace(/\s+/g, "");
  const isPhone = /^07\d{8}$/.test(normalized);
  const isCode = /^\d{4,9}$/.test(normalized);
  if (!isPhone && !isCode) {
    await sendButtonsMessage(
      ctx,
      "MoMo must be a number starting with 07… or a 4–9 digit code.",
      [{ id: IDS.BASKET_SKIP, title: "Skip" }],
    );
    return true;
  }

  const momo = normalized;
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

// Loan flows ---------------------------------------------------------------

async function beginLoanRequest(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const enabled = await isLoansFeatureEnabled(ctx.supabase);
    if (!enabled) {
      await sendButtonsMessage(
        ctx,
        "Loan requests are temporarily paused. Please try again later.",
        [{ id: IDS.BASKET_MY, title: "📋 My baskets" }],
      );
      return true;
    }

    const membership = await fetchActiveMembership(ctx.supabase, ctx.profileId);
    const requestState: LoanRequestState = {
      membershipId: membership.membershipId,
      ikiminaId: membership.ikiminaId,
      currency: "RWF",
      role: membership.role ?? null,
    };

    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.LOAN_AMOUNT,
      data: requestState,
    });

    await sendButtonsMessage(
      ctx,
      "How much would you like to borrow? Reply with an amount in RWF (e.g. 150000).",
      [{ id: IDS.BASKET_LOAN_CANCEL, title: "Cancel" }],
      { emoji: "💰" },
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "no_active_membership") {
      await sendButtonsMessage(
        ctx,
        "Join a basket first, then request a loan.",
        [{ id: IDS.BASKET_JOIN, title: "🔑 Join with code" }],
      );
      return true;
    }
    console.error("baskets.loan_begin_fail", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Unable to start a loan request right now. Please try again later.",
      [{ id: IDS.BACK_MENU, title: "Home" }],
    );
    return true;
  }
}

async function handleLoanAmount(
  ctx: RouterContext,
  value: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const request = state.data as LoanRequestState | undefined;
  if (!request?.membershipId) {
    await startBaskets(ctx, { key: STATES.MENU });
    return true;
  }

  const amount = parseNumeric(value);
  if (!amount || amount < 10000) {
    await sendButtonsMessage(
      ctx,
      "Enter a valid amount above 10,000 RWF.",
      [{ id: IDS.BASKET_LOAN_CANCEL, title: "Cancel" }],
    );
    return true;
  }

  const updated: LoanRequestState = {
    ...request,
    amount,
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.LOAN_PURPOSE,
    data: updated,
  });

  await sendButtonsMessage(
    ctx,
    `Purpose of the loan request for ${
      formatLoanAmount(amount, updated.currency ?? "RWF")
    }?`,
    [{ id: IDS.BASKET_LOAN_CANCEL, title: "Cancel" }],
    { emoji: "📝" },
  );
  return true;
}

async function handleLoanPurpose(
  ctx: RouterContext,
  value: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const request = state.data as LoanRequestState | undefined;
  if (!request?.membershipId) {
    await startBaskets(ctx, { key: STATES.MENU });
    return true;
  }

  const purpose = value.trim();
  if (purpose.length < 4) {
    await sendButtonsMessage(
      ctx,
      "Please describe the loan purpose with at least 4 characters.",
      [{ id: IDS.BASKET_LOAN_CANCEL, title: "Cancel" }],
    );
    return true;
  }

  const updated: LoanRequestState = {
    ...request,
    purpose: purpose.slice(0, 160),
  };

  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.LOAN_TENURE,
    data: updated,
  });

  await sendButtonsMessage(
    ctx,
    "How many months to repay? (1-36)",
    [{ id: IDS.BASKET_LOAN_CANCEL, title: "Cancel" }],
    { emoji: "📅" },
  );
  return true;
}

async function handleLoanTenure(
  ctx: RouterContext,
  value: string,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  const request = state.data as LoanRequestState | undefined;
  if (!request?.membershipId || !request.amount) {
    await startBaskets(ctx, { key: STATES.MENU });
    return true;
  }

  const tenure = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(tenure) || tenure < 1 || tenure > 36) {
    await sendButtonsMessage(
      ctx,
      "Tenure must be between 1 and 36 months.",
      [{ id: IDS.BASKET_LOAN_CANCEL, title: "Cancel" }],
    );
    return true;
  }

  const updated: LoanRequestState = {
    ...request,
    tenure,
  };

  const summary = [
    `Amount: ${formatLoanAmount(updated.amount!, updated.currency ?? "RWF")}`,
    `Purpose: ${updated.purpose ?? "—"}`,
    `Tenure: ${tenure} month(s)`,
  ].join("\n");

  await setState(ctx.supabase, ctx.profileId, {
    key: STATES.LOAN_CONFIRM,
    data: updated,
  });

  await sendButtonsMessage(
    ctx,
    `Review loan request:\n${summary}`,
    [
      { id: IDS.BASKET_LOAN_SUBMIT, title: "Submit" },
      { id: IDS.BASKET_LOAN_CANCEL, title: "Cancel" },
    ],
    { emoji: "✅" },
  );
  return true;
}

async function submitLoanRequest(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId || state.key !== STATES.LOAN_CONFIRM) return false;
  const request = state.data as LoanRequestState | undefined;
  if (!request?.membershipId || !request.amount || !request.tenure) {
    await startBaskets(ctx, { key: STATES.MENU });
    return true;
  }

  const currency = request.currency ?? "RWF";

  try {
    const { data: inserted, error } = await ctx.supabase
      .from("sacco_loans")
      .insert({
        ikimina_id: request.ikiminaId,
        member_id: request.membershipId,
        principal: request.amount,
        currency,
        tenure_months: request.tenure,
        rate_apr: null,
        purpose: request.purpose ?? null,
        status: "pending",
        meta: {
          channel: "whatsapp",
          requested_profile: ctx.profileId,
          requested_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (error || !inserted) {
      throw error ?? new Error("loan_insert_failed");
    }

    const { data: committee, error: committeeError } = await ctx.supabase
      .from("ibimina_committee")
      .select("member_id, role")
      .eq("ikimina_id", request.ikiminaId);

    if (!committeeError && committee && committee.length) {
      const payload = committee.map((member) => ({
        loan_id: inserted.id,
        committee_member_id: member.member_id,
        role: member.role,
        vote: "pending",
      }));

      const { error: endorsementError } = await ctx.supabase
        .from("sacco_loan_endorsements")
        .upsert(payload, { onConflict: "loan_id,committee_member_id" });

      if (endorsementError) {
        console.error(
          "baskets.loan_endorsements_upsert_failed",
          endorsementError,
        );
      }
    }

    await clearState(ctx.supabase, ctx.profileId);

    await sendButtonsMessage(
      ctx,
      `Loan request submitted for ${
        formatLoanAmount(request.amount, currency)
      }. Committee members will review and the SACCO will follow up soon.`,
      [{ id: IDS.BASKET_MY, title: "📋 My baskets" }],
    );
    return true;
  } catch (error) {
    console.error("baskets.loan_submit_failed", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Could not submit the loan request. Please try again later.",
      [{ id: IDS.BACK_MENU, title: "Home" }],
    );
    await clearState(ctx.supabase, ctx.profileId);
    return true;
  }
}

async function showLoanStatus(ctx: RouterContext): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const membership = await fetchActiveMembership(ctx.supabase, ctx.profileId);
    const { data, error } = await ctx.supabase
      .from("sacco_loans")
      .select("id, principal, currency, status, status_reason, created_at")
      .eq("member_id", membership.membershipId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!data || !data.length) {
      await sendButtonsMessage(
        ctx,
        "You have no loan requests yet.",
        [{ id: IDS.BASKET_LOAN_REQUEST, title: "Request loan" }],
      );
      return true;
    }

    const lines = data.map((loan) => {
      const amount = formatLoanAmount(
        Number(loan.principal ?? 0),
        loan.currency ?? "RWF",
      );
      const status = loan.status ?? "pending";
      const reason = loan.status_reason ? ` — ${loan.status_reason}` : "";
      return `${amount}: ${status}${reason}`;
    });

    await sendText(ctx.from, `Loan status updates:\n${lines.join("\n")}`);
    await sendButtonsMessage(
      ctx,
      "Select another action.",
      [
        { id: IDS.BASKET_LOAN_REQUEST, title: "New request" },
        { id: IDS.BASKET_MY, title: "📋 My baskets" },
      ],
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    if (message === "no_active_membership") {
      await sendButtonsMessage(
        ctx,
        "Join a basket to view loan status.",
        [{ id: IDS.BASKET_JOIN, title: "🔑 Join with code" }],
      );
      return true;
    }
    console.error("baskets.loan_status_failed", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Unable to load loan status right now.",
      [{ id: IDS.BACK_MENU, title: "Home" }],
    );
    return true;
  }
}

async function startLoanApprovals(
  ctx: RouterContext,
  state: BasketState,
): Promise<boolean> {
  if (!ctx.profileId) return false;
  try {
    const membership = await fetchActiveMembership(ctx.supabase, ctx.profileId);
    const quorum = await fetchIkiminaQuorum(ctx.supabase, membership.ikiminaId);
    if (!membership.role) {
      await sendButtonsMessage(
        ctx,
        "Only committee members can review loan requests.",
        [{ id: IDS.BASKET_MY, title: "📋 My baskets" }],
      );
      return true;
    }

    const { data, error } = await ctx.supabase
      .from("sacco_loan_endorsements")
      .select(`
        loan_id,
        vote,
        role,
        sacco_loans:loan_id (
          id,
          principal,
          currency,
          purpose,
          status,
          created_at,
          member:member_id (
            profile:user_id (display_name, msisdn)
          )
        )
      `)
      .eq("committee_member_id", membership.membershipId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const pending = (data ?? []).filter((row) =>
      row.vote === "pending" && row.sacco_loans
    );

    if (!pending.length) {
      await sendButtonsMessage(
        ctx,
        "No loan requests await your vote.",
        [{ id: IDS.BASKET_MY, title: "📋 My baskets" }],
      );
      return true;
    }

    const rows = pending.slice(0, 10)
      .map((row) => {
        const rawLoan = (row as { sacco_loans?: unknown }).sacco_loans as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | null
          | undefined;
        const loan = Array.isArray(rawLoan) ? rawLoan[0] : rawLoan;
        if (!loan) return null;
        const principal = Number(
          (loan as { principal?: unknown }).principal ?? 0,
        );
        const currency = (loan as { currency?: unknown }).currency as
          | string
          | null;
        const purpose = (loan as { purpose?: unknown }).purpose as
          | string
          | null;
        const member = (loan as {
          member?: { profile?: { display_name?: string | null } | null };
        }).member;
        const displayName = member?.profile?.display_name ?? "Member";
        return {
          id: `loan:${(loan as { id?: string }).id}`,
          title: formatLoanAmount(principal, currency ?? "RWF"),
          description: `${displayName} • ${purpose ?? "General use"}`,
        };
      })
      .filter(Boolean) as Array<
        { id: string; title: string; description: string }
      >;

    if (!rows.length) {
      await sendButtonsMessage(
        ctx,
        "No pending approvals found.",
        [{ id: IDS.BASKET_MY, title: "📋 My baskets" }],
      );
      return true;
    }

    await setState(ctx.supabase, ctx.profileId, {
      key: STATES.LOAN_APPROVAL_SELECT,
      data: {
        membershipId: membership.membershipId,
        ikiminaId: membership.ikiminaId,
        quorum,
      },
    });

    await sendListMessage(
      ctx,
      {
        title: "Committee approvals",
        body: "Select a loan to review",
        sectionTitle: "Loans",
        buttonText: "Review",
        rows,
      },
      { emoji: "🗳" },
    );

    return true;
  } catch (error) {
    console.error("baskets.loan_approvals_failed", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Unable to load approvals right now.",
      [{ id: IDS.BACK_MENU, title: "Home" }],
    );
    return true;
  }
}

async function submitLoanVote(
  ctx: RouterContext,
  state: BasketState,
  vote: "approve" | "reject",
): Promise<boolean> {
  if (!ctx.profileId) return false;
  if (state.key !== STATES.LOAN_APPROVAL_DECISION) return false;
  const data = state.data as LoanRequestState & { loanId?: string };
  const loanId = data?.loanId;
  const membershipId = data?.membershipId;

  if (!loanId || !membershipId) {
    await startLoanApprovals(ctx, { key: STATES.LOAN_APPROVAL_SELECT, data });
    return true;
  }

  try {
    await ctx.supabase
      .from("sacco_loan_endorsements")
      .update({
        vote,
        notes: vote === "reject" ? "Committee rejection via WhatsApp" : null,
      })
      .eq("loan_id", loanId)
      .eq("committee_member_id", membershipId);

    const { data: endorsements, error } = await ctx.supabase
      .from("sacco_loan_endorsements")
      .select("vote, role")
      .eq("loan_id", loanId);

    if (error) throw error;

    const quorum = data.quorum ??
      await fetchIkiminaQuorum(ctx.supabase, data.ikiminaId);
    data.quorum = quorum;

    const evaluation = approvalsSatisfied(endorsements ?? [], quorum);
    const { approvalsMet, rolesMet, pending, approvals, rejections } =
      evaluation;

    const { data: currentLoan } = await ctx.supabase
      .from("sacco_loans")
      .select("status")
      .eq("id", loanId)
      .maybeSingle();

    if (rejections > 0) {
      await ctx.supabase
        .from("sacco_loans")
        .update({
          status: "rejected",
          status_reason: "Committee rejection",
          committee_completed_at: new Date().toISOString(),
        })
        .eq("id", loanId);
    } else {
      if (currentLoan?.status === "pending" && approvals > 0) {
        await ctx.supabase
          .from("sacco_loans")
          .update({
            status: "endorsing",
            status_reason: "Committee review in progress",
          })
          .eq("id", loanId);
      }

      if (rolesMet && approvalsMet && pending === 0) {
        await ctx.supabase
          .from("sacco_loans")
          .update({
            status: "endorsing",
            status_reason: "Committee endorsed",
            committee_completed_at: new Date().toISOString(),
          })
          .eq("id", loanId);
      }
    }

    await sendButtonsMessage(
      ctx,
      vote === "approve"
        ? "Approval recorded. Thank you for voting."
        : "Rejection recorded. SACCO staff will review the decision.",
      [{ id: IDS.BASKET_LOAN_APPROVALS, title: "Next loan" }],
    );

    await startLoanApprovals(ctx, {
      key: STATES.LOAN_APPROVAL_SELECT,
      data: { membershipId, ikiminaId: data.ikiminaId, quorum },
    });
    return true;
  } catch (error) {
    console.error("baskets.loan_vote_failed", error);
    await sendButtonsMessage(
      ctx,
      "⚠️ Unable to submit your vote. Please try again soon.",
      [{ id: IDS.BASKET_LOAN_APPROVALS, title: "Reload" }],
    );
    return true;
  }
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
