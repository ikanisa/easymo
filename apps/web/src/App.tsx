import { useCallback, useEffect, useState } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "./services/supabase";
import { ChatWindow, type ChatMessage } from "./components/ChatWindow";
import { QuickReplies, type QuickReply } from "./components/QuickReplies";
import { MatchCard, type MatchSuggestion } from "./components/MatchCard";
import { ExternalFeedList, type ExternalFeedItem } from "./components/ExternalFeedList";
import { NotificationsList, type NotificationItem } from "./components/NotificationsList";
import { TabBar, type TabKey } from "./components/TabBar";
import { VendorsDirectory } from "./components/VendorsDirectory";
import { ListingsBrowser } from "./components/ListingsBrowser";
import { RequestsBrowser } from "./components/RequestsBrowser";

type WebSessionRecord = {
  id: string;
  anon_user_id: string;
  language: string;
  device_fingerprint_hash: string | null;
  last_seen_at: string;
};

type MarketPostRecord = {
  id: string;
  session_id: string;
  type: "buy" | "sell";
  category: string | null;
  title: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  location_text: string | null;
  geo: string | null;
  media_urls: string[];
  status: string;
  posted_at: string | null;
};

type ProductListingRecord = {
  id: string;
  session_id: string;
  vendor_id: string | null;
  listing_type: "product" | "service";
  category: string;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  price_type: "fixed" | "negotiable" | "range";
  price_min: number | null;
  price_max: number | null;
  location_text: string | null;
  geo: string | null;
  media_urls: string[];
  availability: "unknown" | "in_stock" | "made_to_order" | "service_available";
  status: "draft" | "published" | "hidden" | "deleted";
  is_verified_seller: boolean;
  published_at: string | null;
  created_at: string;
};

type DraftFields = {
  type?: "buy" | "sell";
  category?: string;
  title?: string;
  description?: string;
  price_min?: number | null;
  price_max?: number | null;
  currency?: string;
  location_text?: string;
};

type ListingDraftFields = {
  category?: string;
  title?: string;
  description?: string;
  price?: number | null;
  currency?: string;
  price_type?: "fixed" | "negotiable" | "range";
  price_min?: number | null;
  price_max?: number | null;
  location_text?: string;
  availability?: "unknown" | "in_stock" | "made_to_order" | "service_available";
};

const quickReplies: QuickReply[] = [
  { label: "Buy request", value: "@@mode:request:buy", tone: "intent" },
  { label: "Sell request", value: "@@mode:request:sell", tone: "intent" },
  { label: "Product listing", value: "@@mode:listing:product", tone: "intent" },
  { label: "Service listing", value: "@@mode:listing:service", tone: "intent" },
  { label: "Add price range", value: "Price range 180000 to 220000 RWF" },
  { label: "Share location", value: "Pickup around Remera, Kigali" },
];

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "moltbot",
    text: "Hi! I am Moltbot, your anonymous marketplace brain. Chat with me and I will guide the posting, ranking, and notifications without exposing your identity.",
  },
];

type SupabaseAuthAnon = {
  signInAnonymously: () => Promise<{
    data: { session: Session | null; user: User | null };
    error: AuthError | null;
  }>;
};

const createId = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [sessionRow, setSessionRow] = useState<WebSessionRecord | null>(null);
  const [draft, setDraft] = useState<DraftFields>({ currency: "RWF" });
  const [currentPost, setCurrentPost] = useState<MarketPostRecord | null>(null);
  const [statusLabel, setStatusLabel] = useState("draft");
  const [currentListing, setCurrentListing] = useState<ProductListingRecord | null>(null);
  const [listingDraft, setListingDraft] = useState<ListingDraftFields>({ currency: "RWF", price_type: "fixed", availability: "unknown" });
  const [chatMode, setChatMode] = useState<"request" | "listing">("request");
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [matches, setMatches] = useState<MatchSuggestion[]>([]);
  const [externalFeeds, setExternalFeeds] = useState<ExternalFeedItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [featureEnabled] = useState((import.meta.env.VITE_FEATURE_WEB_MARKETPLACE_CHAT ?? "false") === "true");

  useEffect(() => {
    let isMounted = true;
    const boot = async () => {
      try {
        const sessionResult = await supabase.auth.getSession();
        let user = sessionResult.data?.session?.user ?? sessionResult.data?.user ?? null;

        if (!user) {
          const authAnon = supabase.auth as unknown as typeof supabase.auth & SupabaseAuthAnon;
          const { data, error } = await authAnon.signInAnonymously();
          if (error) throw error;
          user = data.user ?? data.session?.user ?? null;
        }

        if (!user) {
          throw new Error("anonymous session unavailable");
        }

        const { data: existing, error: selectError } = await supabase
          .from("web_sessions")
          .select("*")
          .eq("anon_user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (selectError) throw selectError;

        if (existing && isMounted) {
          await supabase
            .from("web_sessions")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", existing.id);
          setSessionRow(existing as WebSessionRecord);
          await ensureDraft(existing.id);
        } else if (isMounted) {
          const { data: inserted, error: insertError } = await supabase
            .from("web_sessions")
            .insert({
              anon_user_id: user.id,
              language: (navigator.language ?? "en").split("-")[0],
              device_fingerprint_hash: null,
            })
            .select("*")
            .single();
          if (insertError) throw insertError;
          setSessionRow(inserted as WebSessionRecord);
          await ensureDraft(inserted.id);
        }
      } catch (error) {
        console.error("session initialization failed", error);
      }
    };

    boot();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionRow) return;
    const interval = setInterval(() => {
      supabase
        .from("web_sessions")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", sessionRow.id);
    }, 45_000);
    return () => clearInterval(interval);
  }, [sessionRow]);

  async function ensureDraft(sessionId: string) {
    if (currentPost) return;
    const { data, error } = await supabase
      .from("market_posts")
      .insert({
        session_id: sessionId,
        type: "buy",
        status: "draft",
        currency: "RWF",
      })
      .select("*")
      .single();

    if (error) {
      console.error("failed to create draft", error);
      return;
    }

    setCurrentPost(data as MarketPostRecord);
  }

  async function ensureListingDraft(sessionId: string, listingType: "product" | "service") {
    const { data, error } = await supabase
      .from("product_listings")
      .insert({
        session_id: sessionId,
        listing_type: listingType,
        category: "uncategorized",
        title: "Draft listing",
        status: "draft",
        currency: "RWF",
        price_type: "fixed",
        availability: "unknown",
      })
      .select("*")
      .single();

    if (error) {
      console.error("failed to create listing draft", error);
      return null;
    }

    setCurrentListing(data as ProductListingRecord);
    setListingDraft({
      currency: (data as ProductListingRecord).currency ?? "RWF",
      price_type: (data as ProductListingRecord).price_type ?? "fixed",
      availability: (data as ProductListingRecord).availability ?? "unknown",
    });
    return data as ProductListingRecord;
  }

  async function applyDraftPatch(patch: Partial<DraftFields>) {
    if (!Object.keys(patch).length) return;
    setDraft((prev) => ({ ...prev, ...patch }));

    if (!currentPost) return;

    const dbPatch: Record<string, unknown> = {};
    if (patch.type) dbPatch.type = patch.type;
    if (patch.category) dbPatch.category = patch.category;
    if (patch.title) dbPatch.title = patch.title;
    if (patch.description) dbPatch.description = patch.description;
    if (typeof patch.price_min === "number") dbPatch.price_min = patch.price_min;
    if (typeof patch.price_max === "number") dbPatch.price_max = patch.price_max;
    if (patch.currency) dbPatch.currency = patch.currency;
    if (patch.location_text) dbPatch.location_text = patch.location_text;

    const { data, error } = await supabase
      .from("market_posts")
      .update(dbPatch)
      .eq("id", currentPost.id)
      .select("*")
      .single();

    if (error) {
      console.error("failed to update draft", error);
      return;
    }

    setCurrentPost(data as MarketPostRecord);
  }

  async function applyListingPatch(patch: Partial<ListingDraftFields>) {
    if (!Object.keys(patch).length) return;
    setListingDraft((prev) => ({ ...prev, ...patch }));

    if (!currentListing) return;

    const dbPatch: Record<string, unknown> = {};
    if (typeof patch.category === "string") dbPatch.category = patch.category;
    if (typeof patch.title === "string") dbPatch.title = patch.title;
    if (typeof patch.description === "string") dbPatch.description = patch.description;
    if (typeof patch.price === "number") dbPatch.price = patch.price;
    if (typeof patch.price_min === "number") dbPatch.price_min = patch.price_min;
    if (typeof patch.price_max === "number") dbPatch.price_max = patch.price_max;
    if (patch.currency) dbPatch.currency = patch.currency;
    if (patch.price_type) dbPatch.price_type = patch.price_type;
    if (typeof patch.location_text === "string") dbPatch.location_text = patch.location_text;
    if (patch.availability) dbPatch.availability = patch.availability;

    const { data, error } = await supabase
      .from("product_listings")
      .update(dbPatch)
      .eq("id", currentListing.id)
      .select("*")
      .single();

    if (error) {
      console.error("failed to update listing draft", error);
      return;
    }

    setCurrentListing(data as ProductListingRecord);
  }

  function derivePatchFromMessage(text: string): Partial<DraftFields> {
    const lower = text.toLowerCase();
    const patch: Partial<DraftFields> = {};

    if (/\b(sell|selling|offer)\b/.test(lower)) patch.type = "sell";
    if (/\b(buy|need|looking|searching)\b/.test(lower) && patch.type !== "sell") patch.type = "buy";

    const categories = [
      { name: "electronics", keywords: ["phone", "laptop", "smartphone", "computer", "tablet"] },
      { name: "mobility", keywords: ["bike", "motorcycle", "car", "scooter", "vehicle"] },
      { name: "furniture", keywords: ["sofa", "table", "chair", "furniture"] },
      { name: "services", keywords: ["repair", "installation", "service", "consult"] },
    ];

    if (!draft.category) {
      for (const candidate of categories) {
        if (candidate.keywords.some((word) => lower.includes(word))) {
          patch.category = candidate.name;
          break;
        }
      }
    }

    const locationMatch = text.match(/\b(in|around|near|at)\s+([A-Za-zÀ-ÿ\s]+)/i);
    if (locationMatch) {
      patch.location_text = locationMatch[2].trim().replace(/[.,]$/, "");
    }

    const priceMatches = text.match(/\d{3,}(?:[\s,]*\d{3})*/g)?.map((value) => Number(value.replace(/[\s,]/g, "")));
    if (priceMatches?.length) {
      const [first, second] = priceMatches;
      if (priceMatches.length === 1) {
        patch.price_min = first;
        patch.price_max = first;
      } else {
        patch.price_min = Math.min(first, second);
        patch.price_max = Math.max(first, second);
      }
    }

    if (!draft.description) {
      patch.description = text.trim();
    }

    if (!draft.title) {
      const snippet = text.split(/[.!?]/)[0].trim();
      patch.title = snippet.length > 50 ? `${snippet.slice(0, 47)}…` : snippet;
    }

    return patch;
  }

  function deriveListingPatchFromMessage(text: string): Partial<ListingDraftFields> {
    const lower = text.toLowerCase();
    const patch: Partial<ListingDraftFields> = {};

    const categories = [
      { name: "electronics", keywords: ["phone", "laptop", "smartphone", "computer", "tablet"] },
      { name: "mobility", keywords: ["bike", "motorcycle", "car", "scooter", "vehicle"] },
      { name: "home", keywords: ["sofa", "table", "chair", "furniture", "mattress"] },
      { name: "services", keywords: ["repair", "installation", "service", "consult", "plumber", "electrician"] },
    ];

    if (!listingDraft.category) {
      for (const candidate of categories) {
        if (candidate.keywords.some((word) => lower.includes(word))) {
          patch.category = candidate.name;
          break;
        }
      }
    }

    const locationMatch = text.match(/\b(in|around|near|at)\s+([A-Za-zÀ-ÿ\s]+)/i);
    if (locationMatch) {
      patch.location_text = locationMatch[2].trim().replace(/[.,]$/, "");
    }

    if (/\b(negotiable|open to offers)\b/.test(lower)) {
      patch.price_type = "negotiable";
    }

    const priceMatches = text.match(/\d{3,}(?:[\s,]*\d{3})*/g)?.map((value) => Number(value.replace(/[\s,]/g, "")));
    if (priceMatches?.length) {
      const [first, second] = priceMatches;
      if (priceMatches.length >= 2 && Number.isFinite(first) && Number.isFinite(second)) {
        patch.price_type = "range";
        patch.price_min = Math.min(first, second);
        patch.price_max = Math.max(first, second);
      } else if (Number.isFinite(first)) {
        patch.price_type = patch.price_type ?? "fixed";
        patch.price = first;
        patch.price_min = null;
        patch.price_max = null;
      }
    }

    if (/\b(in stock|available now)\b/.test(lower)) patch.availability = "in_stock";
    if (/\b(made to order|preorder|order)\b/.test(lower)) patch.availability = "made_to_order";
    if (/\b(service available|available for work)\b/.test(lower)) patch.availability = "service_available";

    if (!listingDraft.description) {
      patch.description = text.trim();
    }

    if (!listingDraft.title) {
      const snippet = text.split(/[.!?]/)[0].trim();
      patch.title = snippet.length > 60 ? `${snippet.slice(0, 57)}…` : snippet;
    }

    return patch;
  }

  async function handleUserMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !sessionRow || !featureEnabled) return;

    // Quick-reply commands should not show raw tokens in the chat history.
    if (trimmed.startsWith("@@mode:")) {
      const [, nextMode, nextKind] = trimmed.split(":");
      setActiveTab("chat");

      if (nextMode === "request") {
        setChatMode("request");
        await ensureDraft(sessionRow.id);
        if (nextKind === "buy" || nextKind === "sell") {
          await applyDraftPatch({ type: nextKind as "buy" | "sell" });
        }
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "moltbot",
            text: `Request mode enabled. Tell me what you ${nextKind === "sell" ? "are selling" : "need"} and say 'post' when ready.`,
            tone: "confirm",
          },
        ]);
        return;
      }

      if (nextMode === "listing") {
        setChatMode("listing");
        const listingType = nextKind === "service" ? "service" : "product";
        const draftListing = await ensureListingDraft(sessionRow.id, listingType);
        if (draftListing) {
          setMessages((prev) => [
            ...prev,
            {
              id: createId(),
              role: "moltbot",
              text: `Listing mode enabled (${listingType}). Describe what you're offering and say 'publish' when ready.`,
              tone: "confirm",
            },
          ]);
        }
        return;
      }
    }

    setMessages((prev) => [...prev, { id: createId(), role: "user", text: trimmed }]);
    setInputValue("");

    if (chatMode === "listing") {
      if (!currentListing) {
        await ensureListingDraft(sessionRow.id, "product");
      }

      const patch = deriveListingPatchFromMessage(trimmed);
      const mergedListing = { ...listingDraft, ...patch };
      await applyListingPatch(patch);

      const clarifications = [] as string[];
      if (!mergedListing.title || mergedListing.title.trim() === "" || mergedListing.title === "Draft listing") clarifications.push("a title");
      if (!mergedListing.category || mergedListing.category.trim() === "" || mergedListing.category === "uncategorized") clarifications.push("a category");
      if (!mergedListing.location_text) clarifications.push("a location");

      const summaryParts: string[] = [];
      if (patch.category) summaryParts.push(`Category set to ${patch.category}.`);
      if (patch.price_type === "negotiable") summaryParts.push("Marked as negotiable.");
      if (typeof patch.price === "number") summaryParts.push(`Price: ${patch.price} ${mergedListing.currency ?? "RWF"}.`);
      if (typeof patch.price_min === "number" && typeof patch.price_max === "number") {
        summaryParts.push(`Price: ${patch.price_min}-${patch.price_max} ${mergedListing.currency ?? "RWF"}.`);
      }
      if (patch.location_text) summaryParts.push(`Location: ${patch.location_text}.`);

      const shouldPublish = /\b(publish|post|go live|list it)\b/.test(lowerCase(trimmed));
      const readyToPublish =
        mergedListing.title &&
        mergedListing.title !== "Draft listing" &&
        mergedListing.category &&
        mergedListing.category !== "uncategorized" &&
        mergedListing.location_text;

      if (shouldPublish && readyToPublish && currentListing) {
        await finalizeListing(currentListing.id);
        return;
      }

      const botMessage = clarifications.length
        ? `Quick clarification: please share ${clarifications.slice(0, 3).join(" and ")}.`
        : summaryParts.length
          ? summaryParts.join(" ")
          : "Got it. I am keeping the listing draft updated for you.";

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: "moltbot",
          text: botMessage,
          tone: clarifications.length ? "clarify" : "confirm",
        },
      ]);
      return;
    }

    // Default: request (market_posts)
    const patch = derivePatchFromMessage(trimmed);
    const mergedDraft = { ...draft, ...patch };
    await applyDraftPatch(patch);

    const clarifications = [] as string[];
    if (!mergedDraft.type) clarifications.push("whether you are buying or selling");
    if (mergedDraft.price_min == null || mergedDraft.price_max == null) clarifications.push("a price range");
    if (!mergedDraft.location_text) clarifications.push("the pickup location");

    const summaryParts: string[] = [];
    if (patch.type) summaryParts.push(`Noted you are ${patch.type === "buy" ? "buying" : "selling"}.`);
    if (patch.category) summaryParts.push(`Category set to ${patch.category}.`);
    if (patch.price_min && patch.price_max) summaryParts.push(`Price: ${patch.price_min}-${patch.price_max} ${mergedDraft.currency}.`);

    const shouldPost = /\b(post|publish|go live|ready)\b/.test(lowerCase(trimmed));
    const readyToPost = mergedDraft.type && mergedDraft.price_min && mergedDraft.price_max && mergedDraft.location_text;

    if (shouldPost && readyToPost && currentPost) {
      await finalizePost(currentPost.id);
      return;
    }

    const botMessage = clarifications.length
      ? `Quick clarification: please share ${clarifications.slice(0, 3).join(" and ")}.`
      : summaryParts.length
        ? summaryParts.join(" ")
        : "Got it. I am keeping the draft updated for you.";

    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "moltbot",
        text: botMessage,
        tone: clarifications.length ? "clarify" : "confirm",
      },
    ]);
  }

  async function finalizePost(postId: string) {
    setStatusLabel("posting");
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "moltbot",
        text: "Publishing your post now and generating match suggestions...",
        tone: "confirm",
      },
    ]);

    const { data, error } = await supabase
      .from("market_posts")
      .update({ status: "posted", posted_at: new Date().toISOString() })
      .eq("id", postId)
      .select("*")
      .single();

    if (error) {
      console.error("failed to publish post", error);
      setStatusLabel("draft");
      return;
    }

    setCurrentPost(data as MarketPostRecord);
    setStatusLabel("posted");
    await refreshContext(postId);
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "moltbot",
        text: "Post is live! Matches and discovery links are ready—notify the top targets when you're ready.",
        tone: "confirm",
      },
    ]);
  }

  async function finalizeListing(listingId: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "moltbot",
        text: "Publishing your listing now…",
        tone: "confirm",
      },
    ]);

    const { data, error } = await supabase
      .from("product_listings")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", listingId)
      .select("*")
      .single();

    if (error) {
      console.error("failed to publish listing", error);
      return;
    }

    setCurrentListing(data as ProductListingRecord);
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "moltbot",
        text: "Listing is live! Buyers can message you from the Listings tab.",
        tone: "confirm",
      },
    ]);
  }

  const refreshContext = useCallback(async (postId: string) => {
    const [matchRes, feedRes, notificationRes] = await Promise.all([
      supabase
        .from("match_suggestions")
        .select("*")
        .eq("post_id", postId)
        .order("score", { ascending: false }),
      supabase
        .from("external_feed_items")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { descending: true })
        .limit(10),
      supabase
        .from("web_notifications")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { descending: true })
        .limit(5),
    ]);

    setMatches((matchRes.data ?? []) as MatchSuggestion[]);
    setExternalFeeds((feedRes.data ?? []) as ExternalFeedItem[]);
    setNotifications((notificationRes.data ?? []) as NotificationItem[]);
  }, []);

  useEffect(() => {
    if (!currentPost) return;
    refreshContext(currentPost.id);
  }, [currentPost, refreshContext]);

  useEffect(() => {
    if (!currentPost) return;
    const channel = supabase
      .channel(`web-notifications-${currentPost.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "web_notifications",
          filter: `post_id=eq.${currentPost.id}`,
        },
        () => refreshContext(currentPost.id),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_suggestions",
          filter: `post_id=eq.${currentPost.id}`,
        },
        () => refreshContext(currentPost.id),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "external_feed_items",
          filter: `post_id=eq.${currentPost.id}`,
        },
        () => refreshContext(currentPost.id),
      );

    channel.subscribe();

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [currentPost, refreshContext]);

  function lowerCase(value: string) {
    return value.toLowerCase();
  }

  async function startListingChat(listingType: "product" | "service") {
    if (!sessionRow) return;
    setActiveTab("chat");
    setChatMode("listing");
    await ensureListingDraft(sessionRow.id, listingType);
  }

  async function openListingChat(listingId: string) {
    if (!sessionRow) return;
    setActiveTab("chat");
    setChatMode("listing");
    const { data, error } = await supabase.from("product_listings").select("*").eq("id", listingId).single();
    if (error) {
      console.error("failed to load listing for chat", error);
      return;
    }
    setCurrentListing(data as ProductListingRecord);
    setListingDraft({
      category: (data as ProductListingRecord).category,
      title: (data as ProductListingRecord).title,
      description: (data as ProductListingRecord).description ?? undefined,
      price: (data as ProductListingRecord).price,
      currency: (data as ProductListingRecord).currency,
      price_type: (data as ProductListingRecord).price_type,
      price_min: (data as ProductListingRecord).price_min,
      price_max: (data as ProductListingRecord).price_max,
      location_text: (data as ProductListingRecord).location_text ?? undefined,
      availability: (data as ProductListingRecord).availability,
    });
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "moltbot",
        text: "Loaded your listing. Add details or say 'publish' when ready.",
        tone: "confirm",
      },
    ]);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="status-pill">Anonymous session</p>
        <h1>Community Marketplace</h1>
        <p>Chat-first posting. Moltbot drives the plan, you react with minimal typing.</p>
      </header>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {!featureEnabled && (
        <div className="feature-flag-banner">
          New web marketplace features are currently behind the feature flag. Enable `VITE_FEATURE_WEB_MARKETPLACE_CHAT` to turn on the live experience.
        </div>
      )}

      {activeTab === "chat" ? (
        <div className="app-grid">
          <section className="chat-column panel">
            <ChatWindow messages={messages} />
            <QuickReplies replies={quickReplies} onSelect={handleUserMessage} disabled={!featureEnabled} />
            <div className="input-row">
              <textarea
                placeholder={
                  featureEnabled
                    ? chatMode === "listing"
                      ? "Describe your listing, or say 'publish' when you are ready."
                      : "Tell me what you need, or say 'post' when you are ready."
                    : "Feature flag is off — enable VITE_FEATURE_WEB_MARKETPLACE_CHAT to start."
                }
                disabled={!featureEnabled}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
              />
              <button
                className="send-button"
                type="button"
                onClick={() => handleUserMessage(inputValue)}
                disabled={!featureEnabled}
              >
                Send
              </button>
            </div>
          </section>

          <section className="context-column">
            <article className="panel">
              <h3>Status</h3>
              <p className="text-muted">Mode: {chatMode}</p>
              {chatMode === "listing" ? (
                <>
                  <p className="text-muted">Listing ID: {currentListing?.id ?? "pending"}</p>
                  <p className="text-muted">Listing status: {currentListing?.status ?? "draft"}</p>
                </>
              ) : (
                <>
                  <p className="text-muted">Current phase: {statusLabel}</p>
                  <p className="text-muted">Draft ID: {currentPost?.id ?? "pending"}</p>
                </>
              )}
            </article>

            {chatMode === "listing" ? (
              <article className="panel">
                <h3>Listing Draft</h3>
                <p className="text-muted">Title: {currentListing?.title ?? "—"}</p>
                <p className="text-muted">Category: {currentListing?.category ?? "—"}</p>
                <p className="text-muted">Location: {currentListing?.location_text ?? "—"}</p>
                <p className="text-muted">To view inquiries, open the Listings tab.</p>
              </article>
            ) : (
              <>
                <article className="panel">
                  <h3>Match Suggestions</h3>
                  {matches.length ? (
                    matches.slice(0, 3).map((match) => <MatchCard key={match.target_id} match={match} />)
                  ) : (
                    <p className="text-muted">Waiting for matches. Publish the post to trigger Moltbot's ranking.</p>
                  )}
                </article>

                <article className="panel">
                  <h3>External Options</h3>
                  <ExternalFeedList feedItems={externalFeeds} />
                </article>

                <article className="panel">
                  <h3>Queued Notifications</h3>
                  <NotificationsList notifications={notifications} />
                </article>
              </>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "vendors" ? <VendorsDirectory enabled={featureEnabled} /> : null}
      {activeTab === "listings" ? (
        <ListingsBrowser
          enabled={featureEnabled}
          sessionId={sessionRow?.id ?? null}
          onStartListingChat={startListingChat}
          onOpenListingChat={openListingChat}
        />
      ) : null}
      {activeTab === "requests" ? <RequestsBrowser enabled={featureEnabled} /> : null}
    </div>
  );
}
