import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export type PostedRequest = {
  id: string;
  type: "buy" | "sell";
  category: string | null;
  title: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  location_text: string | null;
  posted_at: string | null;
};

type RequestsBrowserProps = {
  enabled: boolean;
};

export function RequestsBrowser({ enabled }: RequestsBrowserProps) {
  const [requests, setRequests] = useState<PostedRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: queryError } = await supabase
          .from("market_posts")
          .select("id,type,category,title,description,price_min,price_max,currency,location_text,posted_at,status")
          .eq("status", "posted")
          .order("posted_at", { ascending: false })
          .limit(50);

        if (queryError) throw queryError;
        if (!cancelled) setRequests((data ?? []) as PostedRequest[]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Requests</h2>
        <p className="text-muted">Browse posted buy/sell requests.</p>
      </div>
      {!enabled ? <p className="text-muted">Feature flag is off.</p> : null}
      {loading ? <p className="text-muted">Loading…</p> : null}
      {error ? <p className="text-muted">Error: {error}</p> : null}
      <div className="browse-grid">
        {requests.map((req) => (
          <article key={req.id} className="browse-card">
            <header className="browse-card-header">
              <h3>{req.title ?? "Untitled request"}</h3>
              <span className={req.type === "buy" ? "badge badge-buy" : "badge badge-sell"}>
                {req.type.toUpperCase()}
              </span>
            </header>
            <p className="text-muted">{req.category ?? "uncategorized"}</p>
            {req.description ? <p>{req.description}</p> : <p className="text-muted">No description.</p>}
            <div className="browse-card-footer">
              <span className="text-muted">
                {req.price_min !== null && req.price_max !== null
                  ? `${req.price_min}-${req.price_max} ${req.currency}`
                  : "Price: —"}
              </span>
              <span className="text-muted">{req.location_text ? `Location: ${req.location_text}` : "Location: —"}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

