import { writeAuditEvent } from "../audit/writeAuditEvent";
import { getWebSupabaseClient } from "./client";
import { queueListingNotifications, type NotificationTarget } from "./notificationService";

export type ListingType = "product" | "service";
export type ListingPriceType = "fixed" | "negotiable" | "range";
export type ListingAvailability = "unknown" | "in_stock" | "made_to_order" | "service_available";
export type ListingStatus = "draft" | "published" | "hidden" | "deleted";

export type ProductListingRow = {
  id: string;
  session_id: string;
  vendor_id: string | null;
  listing_type: ListingType;
  category: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  price_type: ListingPriceType;
  price_min: number | null;
  price_max: number | null;
  location_text: string | null;
  geo: unknown | null;
  media_urls: string[];
  availability: ListingAvailability;
  status: ListingStatus;
  is_verified_seller: boolean;
  created_at: string;
  published_at: string | null;
};

export type ListingInquiryRow = {
  id: string;
  listing_id: string;
  buyer_session_id: string;
  message: string;
  status: "sent" | "replied" | "closed";
  created_at: string;
};

export type ListingVerificationRequestRow = {
  id: string;
  listing_id: string;
  session_id: string;
  requested_vendor_name: string | null;
  requested_phone: string | null;
  requested_business_location: string | null;
  status: "pending" | "approved" | "rejected";
  review_notes: string | null;
  created_at: string;
};

type VendorRow = {
  id: string;
  business_name: string;
  phone: string | null;
  is_opted_in?: boolean | null;
  is_opted_out?: boolean | null;
  verified?: boolean | null;
  tags?: string[] | null;
};

const MAX_TITLE_LEN = 120;
const MAX_CATEGORY_LEN = 64;
const MAX_DESCRIPTION_LEN = 1600;
const MAX_LOCATION_LEN = 120;
const MAX_INQUIRY_LEN = 800;

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

function clampText(input: string, maxLen: number): string {
  const clean = stripHtml(input).replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen);
}

function normalizeOptionalText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const clean = clampText(value, maxLen);
  return clean ? clean : null;
}

function normalizeOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[,\s]/g, ""));
  if (!Number.isFinite(num)) return null;
  const rounded = Math.round(num);
  return rounded >= 0 ? rounded : null;
}

export type CreateListingDraftInput = {
  session_id: string;
  listing_type: ListingType;
};

export async function createListingDraft(input: CreateListingDraftInput): Promise<ProductListingRow> {
  const client = getWebSupabaseClient();

  // category/title are NOT NULL in schema; use placeholders for drafts and enforce real values at publish time.
  const payload = {
    session_id: input.session_id,
    listing_type: input.listing_type,
    category: "uncategorized",
    title: "Draft listing",
    status: "draft",
    currency: "RWF",
    price_type: "fixed",
    availability: "unknown",
    vendor_id: null,
    is_verified_seller: false,
  };

  const { data, error } = await client.from("product_listings").insert(payload).select("*").single();
  if (error) throw new Error(`create_listing_draft_failed:${error.message}`);

  const row = data as ProductListingRow;
  await writeAuditEvent({
    request_id: row.id,
    event_type: "product_listings.draft_created",
    actor: "system",
    input: { session_id: input.session_id, listing_type: input.listing_type },
    output: { listing_id: row.id },
  });
  return row;
}

export type UpdateListingFieldsInput = {
  listing_id: string;
  patch: Partial<
    Pick<
      ProductListingRow,
      | "listing_type"
      | "category"
      | "title"
      | "description"
      | "price"
      | "currency"
      | "price_type"
      | "price_min"
      | "price_max"
      | "location_text"
      | "media_urls"
      | "availability"
      | "status"
    >
  >;
};

export async function updateListingFields(input: UpdateListingFieldsInput): Promise<ProductListingRow> {
  const client = getWebSupabaseClient();

  const patch: Record<string, unknown> = {};
  if (input.patch.listing_type) patch["listing_type"] = input.patch.listing_type;
  if (typeof input.patch.category === "string") patch["category"] = clampText(input.patch.category, MAX_CATEGORY_LEN);
  if (typeof input.patch.title === "string") patch["title"] = clampText(input.patch.title, MAX_TITLE_LEN);
  if (input.patch.description !== undefined) {
    patch["description"] = input.patch.description === null ? null : normalizeOptionalText(input.patch.description, MAX_DESCRIPTION_LEN);
  }

  if (input.patch.currency) patch["currency"] = clampText(input.patch.currency, 6);

  const priceType = input.patch.price_type;
  if (priceType) patch["price_type"] = priceType;

  if (input.patch.price !== undefined) patch["price"] = normalizeOptionalInt(input.patch.price);
  if (input.patch.price_min !== undefined) patch["price_min"] = normalizeOptionalInt(input.patch.price_min);
  if (input.patch.price_max !== undefined) patch["price_max"] = normalizeOptionalInt(input.patch.price_max);

  if (input.patch.location_text !== undefined) {
    patch["location_text"] = input.patch.location_text === null ? null : normalizeOptionalText(input.patch.location_text, MAX_LOCATION_LEN);
  }

  if (input.patch.media_urls) {
    patch["media_urls"] = input.patch.media_urls.filter((url) => typeof url === "string" && url.length < 400);
  }

  if (input.patch.availability) patch["availability"] = input.patch.availability;
  if (input.patch.status) patch["status"] = input.patch.status;

  // Validate price range if requested.
  const priceMin = patch["price_min"] as number | null | undefined;
  const priceMax = patch["price_max"] as number | null | undefined;
  const nextPriceType = (patch["price_type"] as ListingPriceType | undefined) ?? undefined;
  if (nextPriceType === "range" && priceMin !== undefined && priceMax !== undefined) {
    if (priceMin === null || priceMax === null || priceMin > priceMax) {
      throw new Error("invalid_price_range");
    }
  }

  const { data, error } = await client
    .from("product_listings")
    .update(patch)
    .eq("id", input.listing_id)
    .select("*")
    .single();

  if (error) throw new Error(`update_listing_fields_failed:${error.message}`);

  return data as ProductListingRow;
}

export async function publishListing(listingId: string): Promise<ProductListingRow> {
  const client = getWebSupabaseClient();

  const { data: current, error: fetchError } = await client.from("product_listings").select("*").eq("id", listingId).single();
  if (fetchError) throw new Error(`publish_listing_fetch_failed:${fetchError.message}`);

  const row = current as ProductListingRow;
  if (!row.title?.trim() || !row.category?.trim() || !row.location_text?.trim()) {
    throw new Error("publish_listing_missing_fields");
  }

  const { data, error } = await client
    .from("product_listings")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", listingId)
    .select("*")
    .single();

  if (error) throw new Error(`publish_listing_failed:${error.message}`);
  return data as ProductListingRow;
}

export type ListPublishedListingsInput = {
  category?: string;
  listing_type?: ListingType;
  price_min?: number;
  price_max?: number;
  limit?: number;
};

export type ListingCard = {
  id: string;
  listing_type: ListingType;
  category: string;
  title: string;
  description: string | null;
  price_display: string | null;
  currency: string;
  location_text: string | null;
  published_at: string | null;
  seller_badge: { kind: "verified_vendor"; vendor_name: string; whatsapp_phone?: string | null } | { kind: "unverified_seller" };
};

export async function listPublishedListings(input: ListPublishedListingsInput): Promise<ListingCard[]> {
  const client = getWebSupabaseClient();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  // Use a join to pull vendor metadata when present.
  let query = client
    .from("product_listings")
    .select(
      "id, listing_type, category, title, description, price, currency, price_type, price_min, price_max, location_text, published_at, vendor_id, is_verified_seller, vendors:vendors(id,business_name,phone,is_opted_in,is_opted_out,verified)",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (input.category) query = query.eq("category", input.category);
  if (input.listing_type) query = query.eq("listing_type", input.listing_type);

  const { data, error } = await query;
  if (error) throw new Error(`list_published_listings_failed:${error.message}`);

  const rows = (data ?? []) as Array<
    Pick<
      ProductListingRow,
      | "id"
      | "listing_type"
      | "category"
      | "title"
      | "description"
      | "price"
      | "currency"
      | "price_type"
      | "price_min"
      | "price_max"
      | "location_text"
      | "published_at"
      | "vendor_id"
      | "is_verified_seller"
    > & { vendors?: VendorRow | VendorRow[] | null }
  >;

  return rows.map((row) => {
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors ?? null;
    const vendorVerified = Boolean(row.vendor_id && row.is_verified_seller && vendor?.verified);
    const whatsappPhone =
      vendorVerified && vendor?.is_opted_in && !vendor?.is_opted_out ? vendor?.phone ?? null : null;

    const priceDisplay = buildPriceDisplay(row);
    return {
      id: row.id,
      listing_type: row.listing_type,
      category: row.category,
      title: row.title,
      description: row.description ?? null,
      price_display: priceDisplay,
      currency: row.currency,
      location_text: row.location_text ?? null,
      published_at: row.published_at ?? null,
      seller_badge: vendorVerified
        ? { kind: "verified_vendor", vendor_name: vendor?.business_name ?? "Verified vendor", whatsapp_phone: whatsappPhone }
        : { kind: "unverified_seller" },
    } satisfies ListingCard;
  });
}

function buildPriceDisplay(listing: {
  price_type: ListingPriceType;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  currency: string;
}): string | null {
  if (listing.price_type === "negotiable") return `Negotiable (${listing.currency})`;
  if (listing.price_type === "range" && listing.price_min !== null && listing.price_max !== null) {
    return `${listing.price_min}-${listing.price_max} ${listing.currency}`;
  }
  if (listing.price !== null) return `${listing.price} ${listing.currency}`;
  return null;
}

export type CreateListingInquiryInput = {
  listing_id: string;
  buyer_session_id: string;
  message: string;
};

export async function createListingInquiry(input: CreateListingInquiryInput): Promise<ListingInquiryRow> {
  const client = getWebSupabaseClient();
  const message = clampText(input.message, MAX_INQUIRY_LEN);
  if (!message) throw new Error("inquiry_message_required");

  // Ensure listing exists and is published.
  const { data: listing, error: listingError } = await client
    .from("product_listings")
    .select("id, session_id, vendor_id, is_verified_seller, status, vendors:vendors(id,business_name,phone,is_opted_in,is_opted_out,verified)")
    .eq("id", input.listing_id)
    .single();

  if (listingError) throw new Error(`create_listing_inquiry_fetch_failed:${listingError.message}`);
  const listingRow = listing as { id: string; session_id: string; vendor_id: string | null; is_verified_seller: boolean; status: string; vendors?: VendorRow | VendorRow[] | null };
  if (listingRow.status !== "published") throw new Error("listing_not_published");

  const { data, error } = await client
    .from("listing_inquiries")
    .insert({ listing_id: input.listing_id, buyer_session_id: input.buyer_session_id, message })
    .select("*")
    .single();

  if (error) throw new Error(`create_listing_inquiry_failed:${error.message}`);

  const inquiry = data as ListingInquiryRow;
  await writeAuditEvent({
    request_id: input.listing_id,
    event_type: "listing_inquiries.created",
    actor: "system",
    input: { listing_id: input.listing_id, buyer_session_id: input.buyer_session_id },
    output: { inquiry_id: inquiry.id },
  });

  const vendor = Array.isArray(listingRow.vendors) ? listingRow.vendors[0] : listingRow.vendors ?? null;
  const vendorVerified = Boolean(listingRow.vendor_id && listingRow.is_verified_seller && vendor?.verified);
  const whatsappPhone =
    vendorVerified && vendor?.is_opted_in && !vendor?.is_opted_out ? vendor?.phone ?? null : null;

  const targets: NotificationTarget[] = [
    {
      target_type: "seller_session",
      target_id: listingRow.session_id,
      channel: "web",
      payload: {
        type: "listing_inquiry",
        listing_id: input.listing_id,
        inquiry_id: inquiry.id,
        buyer_session_id: input.buyer_session_id,
        message_preview: message.slice(0, 140),
      },
    },
  ];

  if (whatsappPhone && listingRow.vendor_id) {
    targets.push({
      target_type: "vendor",
      target_id: listingRow.vendor_id,
      channel: "whatsapp",
      payload: {
        phone: whatsappPhone,
        message: `New inquiry on your listing: "${message.slice(0, 200)}"`,
        listing_id: input.listing_id,
        inquiry_id: inquiry.id,
      },
    });
  }

  // Best-effort notification: inquiry is the source of truth, notifications are delivery hints.
  await queueListingNotifications(input.listing_id, targets);

  return inquiry;
}

export type RequestListingVerificationInput = {
  listing_id: string;
  session_id: string;
  requested_vendor_name?: string | null;
  requested_phone?: string | null;
  requested_business_location?: string | null;
};

export async function requestListingVerification(
  input: RequestListingVerificationInput,
): Promise<ListingVerificationRequestRow> {
  const client = getWebSupabaseClient();

  const payload = {
    listing_id: input.listing_id,
    session_id: input.session_id,
    requested_vendor_name: input.requested_vendor_name ? clampText(input.requested_vendor_name, 120) : null,
    requested_phone: input.requested_phone ? clampText(input.requested_phone, 32) : null,
    requested_business_location: input.requested_business_location
      ? clampText(input.requested_business_location, 160)
      : null,
    status: "pending",
  };

  const { data, error } = await client.from("listing_verification_requests").insert(payload).select("*").single();
  if (error) throw new Error(`request_listing_verification_failed:${error.message}`);

  const row = data as ListingVerificationRequestRow;
  await writeAuditEvent({
    request_id: input.listing_id,
    event_type: "listing_verification_requests.created",
    actor: "system",
    input: { listing_id: input.listing_id, session_id: input.session_id },
    output: { verification_request_id: row.id },
  });
  return row;
}

export type ReviewListingVerificationInput = {
  verification_request_id: string;
  decision: "approve" | "reject";
  vendor_id?: string;
  review_notes?: string | null;
};

export async function reviewListingVerification(
  input: ReviewListingVerificationInput,
): Promise<{ listing_id: string; vendor_id: string | null; status: "approved" | "rejected" }> {
  const client = getWebSupabaseClient();

  const { data: requestRow, error: requestError } = await client
    .from("listing_verification_requests")
    .select("*")
    .eq("id", input.verification_request_id)
    .single();

  if (requestError) throw new Error(`review_listing_verification_fetch_failed:${requestError.message}`);
  const req = requestRow as ListingVerificationRequestRow;

  if (input.decision === "reject") {
    const { error } = await client
      .from("listing_verification_requests")
      .update({ status: "rejected", review_notes: input.review_notes ?? null })
      .eq("id", req.id);
    if (error) throw new Error(`review_listing_verification_reject_failed:${error.message}`);
    return { listing_id: req.listing_id, vendor_id: null, status: "rejected" };
  }

  // Approve path: attach existing vendor or create one.
  let vendorId = input.vendor_id ?? null;
  if (!vendorId) {
    const phone = (req.requested_phone ?? "").trim();
    if (!phone) {
      throw new Error("verification_phone_required");
    }

    const businessName = (req.requested_vendor_name ?? "Verified vendor").trim() || "Verified vendor";
    const { data: vendor, error: vendorError } = await client
      .from("vendors")
      .upsert(
        {
          business_name: businessName,
          phone,
          verified: true,
          is_onboarded: true,
        },
        { onConflict: "phone" },
      )
      .select("id")
      .single();

    if (vendorError) throw new Error(`review_listing_verification_vendor_upsert_failed:${vendorError.message}`);
    vendorId = String((vendor as { id: string }).id);
  } else {
    const { error: vendorUpdateError } = await client.from("vendors").update({ verified: true }).eq("id", vendorId);
    if (vendorUpdateError) throw new Error(`review_listing_verification_vendor_verify_failed:${vendorUpdateError.message}`);
  }

  const { error: listingError } = await client
    .from("product_listings")
    .update({ vendor_id: vendorId, is_verified_seller: true })
    .eq("id", req.listing_id);
  if (listingError) throw new Error(`review_listing_verification_attach_failed:${listingError.message}`);

  const { error: requestUpdateError } = await client
    .from("listing_verification_requests")
    .update({ status: "approved", review_notes: input.review_notes ?? null })
    .eq("id", req.id);
  if (requestUpdateError) throw new Error(`review_listing_verification_approve_failed:${requestUpdateError.message}`);

  await writeAuditEvent({
    request_id: req.listing_id,
    event_type: "listing_verification_requests.approved",
    actor: "system",
    input: { verification_request_id: req.id },
    output: { vendor_id: vendorId },
  });

  return { listing_id: req.listing_id, vendor_id: vendorId, status: "approved" };
}
