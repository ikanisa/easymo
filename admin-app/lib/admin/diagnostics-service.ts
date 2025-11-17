import {
  adminDiagnosticsMatchSchema,
  adminDiagnosticsSnapshotSchema,
  type AdminDiagnosticsMatch,
  type AdminDiagnosticsSnapshot,
} from "@/lib/schemas";
import { getAdminApiPath } from "@/lib/routes";

export async function getAdminDiagnostics(): Promise<AdminDiagnosticsSnapshot> {
  try {
    const response = await fetch(getAdminApiPath("admin", "diagnostics"), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        `Admin diagnostics request failed with ${response.status}`,
      );
    }
    const json = await response.json();
    return adminDiagnosticsSnapshotSchema.parse(json);
  } catch (error) {
    console.error("Admin diagnostics fetch failed", error);
    return adminDiagnosticsSnapshotSchema.parse({
      health: { status: "unknown", recentErrors: [], messages: ["Failed to load diagnostics."] },
      logs: { entries: [], messages: ["No logs."] },
      matches: { matchesLastHour: 0, matchesLast24h: 0, openTrips: 0, errorCountLastHour: 0, recentErrors: [], messages: [] },
      queues: { notificationsQueued: 0, ocrPending: 0, mobilityOpenTrips: 0 },
    } as any);
  }
}

export async function getAdminDiagnosticsMatch(
  tripId: string,
): Promise<AdminDiagnosticsMatch> {
  try {
    const response = await fetch(getAdminApiPath("admin", "diagnostics", "match"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tripId }),
    });
    if (!response.ok) {
      throw new Error(
        `Diagnostics match request failed with ${response.status}`,
      );
    }
    const json = await response.json();
    return adminDiagnosticsMatchSchema.parse(json);
  } catch (error) {
    console.error("Diagnostics match fetch failed", error);
    return adminDiagnosticsMatchSchema.parse({ trip: null, messages: ["Failed to load trip diagnostics."] } as any);
  }
}
