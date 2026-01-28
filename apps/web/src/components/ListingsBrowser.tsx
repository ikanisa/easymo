import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

type VendorJoin = {
  business_name: string;
  phone: string | null;
  verified: boolean | null;
  is_opted_in?: boolean | null;
  is_opted_out?: boolean | null;
};

export type PublishedListing = {
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
  availability: string;
  status: string;
  is_verified_seller: boolean;
  published_at: string | null;
  created_at: string;
  vendors?: VendorJoin | VendorJoin[] | null;
};

type ListingInquiry = {
  id: string;
  listing_id: string;
  buyer_session_id: string;
  message: string;
  status: string;
  created_at: string;
};

type ListingsBrowserProps = {
  enabled: boolean;
  sessionId: string | null;
  onStartListingChat?: (listingType: "product" | "service") => void;
  onOpenListingChat?: (listingId: string) => void;
};

function toWhatsAppLink(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

function formatPrice(listing: Pick<PublishedListing, "price_type" | "price" | "price_min" | "price_max" | "currency">): string {
  if (listing.price_type === "negotiable") return `Negotiable (${listing.currency})`;
  if (listing.price_type === "range" && listing.price_min !== null && listing.price_max !== null) {
    return `${listing.price_min}-${listing.price_max} ${listing.currency}`;
  }
  if (listing.price !== null) return `${listing.price} ${listing.currency}`;
  return `Price: —`;
}

export function ListingsBrowser({ enabled, sessionId, onStartListingChat, onOpenListingChat }: ListingsBrowserProps) {
  const [published, setPublished] = useState<PublishedListing[]>([]);
  const [mine, setMine] = useState<PublishedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeInquiryListingId, setActiveInquiryListingId] = useState<string | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryStatus, setInquiryStatus] = useState<string | null>(null);

  const [selectedMyListingId, setSelectedMyListingId] = useState<string | null>(null);
  const [myInquiries, setMyInquiries] = useState<ListingInquiry[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [publishedRes, mineRes] = await Promise.all([
        supabase
          .from("product_listings")
          .select(
            "id,session_id,vendor_id,listing_type,category,title,description,price,currency,price_type,price_min,price_max,location_text,availability,status,is_verified_seller,published_at,created_at,vendors:vendors(business_name,phone,verified,is_opted_in,is_opted_out)",
          )
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(40),
        sessionId
          ? supabase
              .from("product_listings")
              .select(
                "id,session_id,vendor_id,listing_type,category,title,description,price,currency,price_type,price_min,price_max,location_text,availability,status,is_verified_seller,published_at,created_at,vendors:vendors(business_name,phone,verified,is_opted_in,is_opted_out)",
              )
              .eq("session_id", sessionId)
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (publishedRes.error) throw publishedRes.error;
      if ((mineRes as any).error) throw (mineRes as any).error;

      setPublished((publishedRes.data ?? []) as PublishedListing[]);
      setMine(((mineRes as any).data ?? []) as PublishedListing[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled || !sessionId || !selectedMyListingId) return;
    let cancelled = false;
    const run = async () => {
      const { data, error: queryError } = await supabase
        .from("listing_inquiries")
        .select("id,listing_id,buyer_session_id,message,status,created_at")
        .eq("listing_id", selectedMyListingId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (queryError) {
        if (!cancelled) setError(queryError.message);
        return;
      }

      if (!cancelled) setMyInquiries((data ?? []) as ListingInquiry[]);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [enabled, sessionId, selectedMyListingId]);

  const handleSendInquiry = useCallback(async () => {
    if (!sessionId || !activeInquiryListingId) return;
    const message = inquiryMessage.trim();
    if (!message) return;

    setInquiryStatus("Sending…");
    try {
      const { error: insertError } = await supabase
        .from("listing_inquiries")
        .insert({ listing_id: activeInquiryListingId, buyer_session_id: sessionId, message });
      if (insertError) throw insertError;

      setInquiryStatus("Sent.");
      setInquiryMessage("");
      setActiveInquiryListingId(null);
    } catch (err) {
      setInquiryStatus(err instanceof Error ? err.message : String(err));
    }
  }, [activeInquiryListingId, inquiryMessage, sessionId]);

  const publishedCards = useMemo(() => {
    return published.map((listing) => {
      const vendor = Array.isArray(listing.vendors) ? listing.vendors[0] : listing.vendors ?? null;
      const isVerified = Boolean(listing.vendor_id && listing.is_verified_seller && vendor?.verified);
      const canWhatsApp = Boolean(isVerified && vendor?.phone && vendor?.is_opted_in && !vendor?.is_opted_out);
      const badge = isVerified ? (
        <span className="badge badge-verified">{vendor?.business_name ?? "Verified vendor"}</span>
      ) : (
        <span className="badge badge-unverified">Unverified seller</span>
      );

      return (
        <article key={listing.id} className="browse-card">
          <header className="browse-card-header">
            <h3>{listing.title}</h3>
            {badge}
          </header>
          <p className="text-muted">
            {listing.listing_type} · {listing.category}
          </p>
          {listing.description ? <p>{listing.description}</p> : <p className="text-muted">No description.</p>}
          <div className="browse-card-footer">
            <span className="text-muted">{formatPrice(listing)}</span>
            <span className="text-muted">{listing.location_text ? listing.location_text : "Location: —"}</span>
          </div>
          <div className="browse-actions">
            {sessionId ? (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setInquiryStatus(null);
                  setInquiryMessage("");
                  setActiveInquiryListingId(listing.id);
                }}
              >
                Message seller
              </button>
            ) : (
              <span className="text-muted">Sign in to message seller</span>
            )}
            {canWhatsApp ? (
              <a className="link-button" href={toWhatsAppLink(vendor!.phone!)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            ) : null}
          </div>
          {activeInquiryListingId === listing.id ? (
            <div className="inquiry-box">
              <textarea
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="Write a short message to the seller…"
              />
              <div className="inquiry-actions">
                <button type="button" className="send-button" onClick={handleSendInquiry}>
                  Send
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() => {
                    setActiveInquiryListingId(null);
                    setInquiryStatus(null);
                  }}
                >
                  Cancel
                </button>
                {inquiryStatus ? <span className="text-muted">{inquiryStatus}</span> : null}
              </div>
            </div>
          ) : null}
        </article>
      );
    });
  }, [activeInquiryListingId, handleSendInquiry, inquiryMessage, inquiryStatus, published, sessionId]);

  const myCards = useMemo(() => {
    if (!sessionId) return null;
    return mine.map((listing) => {
      const vendor = Array.isArray(listing.vendors) ? listing.vendors[0] : listing.vendors ?? null;
      const isVerified = Boolean(listing.vendor_id && listing.is_verified_seller && vendor?.verified);
      const badge = isVerified ? (
        <span className="badge badge-verified">Verified vendor</span>
      ) : (
        <span className="badge badge-unverified">Unverified seller</span>
      );
      const selected = selectedMyListingId === listing.id;

      return (
        <button
          key={listing.id}
          type="button"
          className={selected ? "my-listing-button my-listing-button-active" : "my-listing-button"}
          onClick={() => setSelectedMyListingId(listing.id)}
        >
          <div>
            <strong>{listing.title}</strong>
            <div className="text-muted">{listing.status}</div>
          </div>
          {badge}
        </button>
      );
    });
  }, [mine, selectedMyListingId, sessionId]);

  const selectedMyListing = useMemo(() => mine.find((l) => l.id === selectedMyListingId) ?? null, [mine, selectedMyListingId]);

  if (!enabled) {
    return (
      <div className="panel">
        <h2>Listings</h2>
        <p className="text-muted">Feature flag is off.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Listings</h2>
        <p className="text-muted">Browse listings, or manage your own listings anonymously.</p>
      </div>

      {onStartListingChat ? (
        <div className="browse-actions">
          <button type="button" className="link-button" onClick={() => onStartListingChat("product")}>
            Create product listing (via chat)
          </button>
          <button type="button" className="link-button" onClick={() => onStartListingChat("service")}>
            Create service listing (via chat)
          </button>
        </div>
      ) : null}

      {loading ? <p className="text-muted">Loading…</p> : null}
      {error ? <p className="text-muted">Error: {error}</p> : null}

      {sessionId ? (
        <section className="my-section">
          <h3>My Listings</h3>
          <div className="my-listings">{myCards}</div>

          {selectedMyListing ? (
            <div className="my-detail">
              <div className="browse-actions">
                {onOpenListingChat ? (
                  <button type="button" className="link-button" onClick={() => onOpenListingChat(selectedMyListing.id)}>
                    Open in chat
                  </button>
                ) : null}
                <button type="button" className="link-button" onClick={refresh}>
                  Refresh
                </button>
              </div>

              <h4>Inquiries</h4>
              {myInquiries.length ? (
                <ul className="inquiry-list">
                  {myInquiries.map((inq) => (
                    <li key={inq.id}>
                      <div className="text-muted">{new Date(inq.created_at).toLocaleString()}</div>
                      <p>{inq.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No inquiries yet.</p>
              )}
            </div>
          ) : (
            <p className="text-muted">Select a listing to see inquiries.</p>
          )}
        </section>
      ) : null}

      <section>
        <h3>Browse Published Listings</h3>
        <div className="browse-grid">{publishedCards}</div>
      </section>
    </div>
  );
}
