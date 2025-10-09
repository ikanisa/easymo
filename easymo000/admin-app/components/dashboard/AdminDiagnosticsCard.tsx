"use client";

import { useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAdminDiagnosticsQuery } from "@/lib/queries/adminDiagnostics";
import { getAdminDiagnosticsMatch } from "@/lib/data-provider";
import type { AdminDiagnosticsMatch } from "@/lib/schemas";

export function AdminDiagnosticsCard() {
  const diagnosticsQuery = useAdminDiagnosticsQuery();
  const snapshot = diagnosticsQuery.data;
  const [tripId, setTripId] = useState("");
  const [matchResult, setMatchResult] = useState<AdminDiagnosticsMatch | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tripId.trim()) {
      setMatchError("Enter a trip id");
      return;
    }
    setMatchError(null);
    setMatchLoading(true);
    try {
      const result = await getAdminDiagnosticsMatch(tripId.trim());
      setMatchResult(result);
    } catch (error) {
      console.error("Diagnostics match failed", error);
      setMatchError("Unable to fetch trip diagnostics. Try again later.");
    } finally {
      setMatchLoading(false);
    }
  };

  return (
    <SectionCard
      title="Diagnostics snapshot"
      description="Latest config and webhook health sourced from the WhatsApp admin flow."
    >
      {diagnosticsQuery.isLoading
        ? (
          <LoadingState
            title="Loading diagnostics"
            description="Fetching flow-exchange diagnostics."
          />
        )
        : snapshot
        ? (
          <div className="space-y-4">
            {snapshot.health.messages.length > 0 && (
              <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {snapshot.health.messages.map((message, index) => (
                  <p key={`health-${index}`}>{message}</p>
                ))}
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-foreground">Admin config</h3>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Admin numbers
                  </dt>
                  <dd>
                    {snapshot.health.config?.admin_numbers?.join(", ") ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    Insurance admins
                  </dt>
                  <dd>
                    {snapshot.health.config?.insurance_admin_numbers?.join(", ") ??
                      "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-muted-foreground">
                    PIN required
                  </dt>
                  <dd>
                    {snapshot.health.config?.admin_pin_required ? "Yes" : "No"}
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Recent webhook logs</h3>
              {snapshot.logs.messages.length > 0 && (
                <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground mb-2">
                  {snapshot.logs.messages.map((message, index) => (
                    <p key={`log-msg-${index}`}>{message}</p>
                  ))}
                </div>
              )}
              <ul className="grid gap-2 text-sm">
                {snapshot.logs.logs.slice(0, 5).map((log) => (
                  <li
                    key={log.id}
                    className="rounded-md border border-border bg-card p-2"
                  >
                    <div className="font-medium text-foreground">
                      {log.endpoint ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Status {log.status_code ?? "—"} · {log.received_at ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Trip diagnostics</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Enter a trip ID to inspect matching metadata from the WhatsApp admin flow.
              </p>
              <form className="flex flex-wrap gap-2" onSubmit={onSubmit}>
                <input
                  type="text"
                  value={tripId}
                  onChange={(event) => setTripId(event.target.value)}
                  placeholder="trip id"
                  className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  disabled={matchLoading}
                >
                  {matchLoading ? "Checking..." : "Check"}
                </button>
              </form>
              {matchError && (
                <p className="mt-2 text-xs text-destructive">{matchError}</p>
              )}
              {matchResult && (
                <div className="mt-3 rounded-md border border-border bg-card p-3 text-sm">
                  {matchResult.messages.length > 0 && (
                    <div className="mb-2 rounded border border-dashed border-border bg-muted/40 p-2 text-xs text-muted-foreground">
                      {matchResult.messages.map((message, index) => (
                        <p key={`match-msg-${index}`}>{message}</p>
                      ))}
                    </div>
                  )}
                  {matchResult.trip
                    ? (
                      <dl className="grid gap-2">
                        <div>
                          <dt className="text-xs uppercase text-muted-foreground">
                            Trip ID
                          </dt>
                          <dd>{matchResult.trip.id}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-muted-foreground">
                            Role
                          </dt>
                          <dd>{matchResult.trip.role ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-muted-foreground">
                            Vehicle
                          </dt>
                          <dd>{matchResult.trip.vehicleType ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-xs uppercase text-muted-foreground">
                            Status
                          </dt>
                          <dd>{matchResult.trip.status ?? "—"}</dd>
                        </div>
                      </dl>
                    )
                    : (
                      <p className="text-xs text-muted-foreground">
                        No trip data returned.
                      </p>
                    )}
                </div>
              )}
            </div>
          </div>
        )
        : (
          <EmptyState
            title="Diagnostics unavailable"
            description="Unable to load diagnostics from flow-exchange."
          />
        )}
    </SectionCard>
  );
}
