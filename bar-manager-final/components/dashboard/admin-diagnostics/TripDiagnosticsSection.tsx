import { FormEvent, useState } from "react";

import { getAdminDiagnosticsMatch } from "@/lib/admin/diagnostics-service";
import type { AdminDiagnosticsMatch } from "@/lib/schemas";

import { DiagnosticsNotice } from "./DiagnosticsNotice";

export function TripDiagnosticsSection() {
  const [tripId, setTripId] = useState("");
  const [matchResult, setMatchResult] = useState<AdminDiagnosticsMatch | null>(
    null,
  );
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    <div>
      <h3 className="text-sm font-semibold text-foreground">Trip diagnostics</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        Enter a trip ID to inspect matching metadata from the WhatsApp admin flow.
      </p>
      <form className="flex flex-wrap gap-2" onSubmit={handleSubmit}>
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
      {matchError ? (
        <p className="mt-2 text-xs text-destructive">{matchError}</p>
      ) : null}
      {matchResult ? (
        <div className="mt-3 rounded-md border border-border bg-card p-3 text-sm">
          <DiagnosticsNotice
            messages={matchResult.messages}
            className="mb-2"
            dense
          />
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
      ) : null}
    </div>
  );
}
