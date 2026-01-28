import { useCallback, useEffect, useState } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { supabase } from "./services/supabase";
import { ChatWindow, type ChatMessage } from "./components/ChatWindow";
import { QuickReplies, type QuickReply } from "./components/QuickReplies";
import { MatchCard, type MatchSuggestion } from "./components/MatchCard";
import { ExternalFeedList, type ExternalFeedItem } from "./components/ExternalFeedList";
import { NotificationsList, type NotificationItem } from "./components/NotificationsList";

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

const quickReplies: QuickReply[] = [
  { label: "I want to buy", value: "I am looking to buy a gently used smartphone", tone: "intent" },
  { label: "I am selling", value: "Selling a refurbished laptop with charger", tone: "intent" },
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

  async function handleUserMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !sessionRow || !featureEnabled) return;

    setMessages((prev) => [...prev, { id: createId(), role: "user", text: trimmed }]);
    setInputValue("");

    const patch = derivePatchFromMessage(trimmed);
    const mergedDraft = { ...draft, ...patch };
    await applyDraftPatch(patch);

    const clarifications = [] as string[];
    if (!mergedDraft.type) clarifications.push("whether you are buying or selling");
    if (mergedDraft.price_min == null || mergedDraft.price_max == null) clarifications.push("a price range");
    if (!mergedDraft.location_text) clarifications.push("the pickup location");

    const summaryParts = [];
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

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="status-pill">Anonymous session</p>
        <h1>Community Marketplace</h1>
        <p>Chat-first posting. Moltbot drives the plan, you react with minimal typing.</p>
      </header>

      {!featureEnabled && (
        <div className="feature-flag-banner">
          New web marketplace features are currently behind the feature flag. Enable `VITE_FEATURE_WEB_MARKETPLACE_CHAT` to turn on the live experience.
        </div>
      )}

      <div className="app-grid">
        <section className="chat-column panel">
          <ChatWindow messages={messages} />
          <QuickReplies replies={quickReplies} onSelect={handleUserMessage} disabled={!featureEnabled} />
          <div className="input-row">
            <textarea
              placeholder={
                featureEnabled
                  ? "Tell me what you need, or say 'post' when you are ready."
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
            <p className="text-muted">Current phase: {statusLabel}</p>
            <p className="text-muted">Draft ID: {currentPost?.id ?? "pending"}</p>
          </article>

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
        </section>
      </div>
    </div>
  );
}
