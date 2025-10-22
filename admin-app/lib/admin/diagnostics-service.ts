import {
  adminDiagnosticsMatchSchema,
  adminDiagnosticsSnapshotSchema,
  type AdminDiagnosticsMatch,
  type AdminDiagnosticsSnapshot,
} from "@/lib/schemas";
import { mockAdminDiagnostics, mockAdminDiagnosticsMatch } from "@/lib/mock-data";
import { shouldUseMocks } from "@/lib/runtime-config";
import { getAdminApiPath } from "@/lib/routes";

const useMocks = shouldUseMocks();

export async function getAdminDiagnostics(): Promise<AdminDiagnosticsSnapshot> {
  if (useMocks) {
    return mockAdminDiagnostics;
  }

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
      health: {
        ...mockAdminDiagnostics.health,
        messages: [
          ...mockAdminDiagnostics.health.messages,
          "Failed to load diagnostics. Showing mock snapshot instead.",
        ],
      },
      logs: {
        ...mockAdminDiagnostics.logs,
        messages: [
          ...mockAdminDiagnostics.logs.messages,
          "Diagnostics logs fallback to mock data.",
        ],
      },
    });
  }
}

export async function getAdminDiagnosticsMatch(
  tripId: string,
): Promise<AdminDiagnosticsMatch> {
  if (useMocks) {
    return mockAdminDiagnosticsMatch;
  }

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
    return adminDiagnosticsMatchSchema.parse({
      ...mockAdminDiagnosticsMatch,
      messages: [
        ...mockAdminDiagnosticsMatch.messages,
        "Failed to load trip diagnostics. Showing mock data instead.",
      ],
    });
  }
}
