import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

export type VerifiedVendor = {
  id: string;
  business_name: string;
  phone: string | null;
  tags: string[] | null;
  average_rating: number | null;
  verified: boolean | null;
  is_opted_in?: boolean | null;
  is_opted_out?: boolean | null;
};

type VendorsDirectoryProps = {
  enabled: boolean;
};

function toWhatsAppLink(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export function VendorsDirectory({ enabled }: VendorsDirectoryProps) {
  const [vendors, setVendors] = useState<VerifiedVendor[]>([]);
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
          .from("vendors")
          .select("id,business_name,phone,tags,average_rating,verified,is_opted_in,is_opted_out")
          .eq("verified", true)
          .order("average_rating", { ascending: false })
          .limit(50);

        if (queryError) throw queryError;
        if (!cancelled) setVendors((data ?? []) as VerifiedVendor[]);
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

  const cards = useMemo(() => {
    return vendors.map((vendor) => {
      const canWhatsApp = Boolean(vendor.phone && vendor.is_opted_in && !vendor.is_opted_out);
      return (
        <article key={vendor.id} className="browse-card">
          <header className="browse-card-header">
            <h3>{vendor.business_name}</h3>
            <span className="badge badge-verified">Verified</span>
          </header>
          {vendor.tags?.length ? (
            <p className="text-muted">Tags: {vendor.tags.slice(0, 5).join(", ")}</p>
          ) : (
            <p className="text-muted">No tags yet.</p>
          )}
          <div className="browse-card-footer">
            <span className="text-muted">
              Rating: {vendor.average_rating !== null ? vendor.average_rating.toFixed(1) : "—"}
            </span>
            {canWhatsApp ? (
              <a className="link-button" href={toWhatsAppLink(vendor.phone!)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            ) : (
              <span className="text-muted">WhatsApp not available</span>
            )}
          </div>
        </article>
      );
    });
  }, [vendors]);

  if (!enabled) {
    return (
      <div className="panel">
        <h2>Vendors</h2>
        <p className="text-muted">Feature flag is off.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Verified Vendors</h2>
        <p className="text-muted">Directory shows verified vendors only.</p>
      </div>
      {loading ? <p className="text-muted">Loading…</p> : null}
      {error ? <p className="text-muted">Error: {error}</p> : null}
      <div className="browse-grid">{cards}</div>
    </div>
  );
}

