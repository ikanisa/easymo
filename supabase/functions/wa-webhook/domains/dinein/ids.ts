const BAR_PREFIX = "DINE_BAR:" as const;
const ITEM_PREFIX = "DINE_ITEM:" as const;
const MORE_PREFIX = "DINE_MORE:" as const;
const REVIEW_ITEM_PREFIX = "DINE_REVIEW_ITEM:" as const;
const ORDER_ROW_PREFIX = "DINE_ORDER_ROW:" as const;

export const DINE_IDS = {
  BAR_PREFIX,
  ITEM_PREFIX,
  BARS_NEXT: "DINE_BARS_NEXT",
  BARS_PREV: "DINE_BARS_PREV",
  ITEMS_NEXT: "DINE_ITEMS_NEXT",
  ITEMS_PREV: "DINE_ITEMS_PREV",
  MENU: "DINE_MENU",
  ORDER_MORE: "DINE_ORDER_MORE",
  PAY_ORDER: "DINE_PAY_ORDER",
  MANAGE_BAR: "DINE_MANAGE_BAR",
  MENU_QR: "DINE_MENU_QR",
  REVIEW_ITEM_PREFIX,
  ORDER_ROW_PREFIX,
} as const;

export function makeBarRowId(barId: string): string {
  return `${BAR_PREFIX}${barId}`;
}

export function makeItemRowId(itemId: string): string {
  return `${ITEM_PREFIX}${itemId}`;
}

export function makeMoreRowId(offset: number): string {
  return `${MORE_PREFIX}${offset}`;
}

export function makeReviewItemRowId(itemId: string): string {
  return `${REVIEW_ITEM_PREFIX}${itemId}`;
}

export function makeOrderRowId(orderId: string): string {
  return `${ORDER_ROW_PREFIX}${orderId}`;
}

export function isBarRow(id: string | undefined | null): id is string {
  return typeof id === "string" && id.startsWith(BAR_PREFIX);
}

export function isItemRow(id: string | undefined | null): id is string {
  return typeof id === "string" && id.startsWith(ITEM_PREFIX);
}

export function isMoreRow(id: string | undefined | null): id is string {
  return typeof id === "string" && id.startsWith(MORE_PREFIX);
}

export function isReviewItemRow(id: string | undefined | null): id is string {
  return typeof id === "string" && id.startsWith(REVIEW_ITEM_PREFIX);
}

export function isOrderRow(id: string | undefined | null): id is string {
  return typeof id === "string" && id.startsWith(ORDER_ROW_PREFIX);
}

function parseRowId(prefix: string, id: string): string {
  return id.slice(prefix.length);
}

export function parseBarId(id: string): string {
  return parseRowId(BAR_PREFIX, id);
}

export function parseItemId(id: string): string {
  return parseRowId(ITEM_PREFIX, id);
}

export function parseMoreOffset(id: string): number {
  const raw = parseRowId(MORE_PREFIX, id);
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

export function parseReviewItemId(id: string): string {
  return parseRowId(REVIEW_ITEM_PREFIX, id);
}

export function parseOrderRowId(id: string): string {
  return parseRowId(ORDER_ROW_PREFIX, id);
}
