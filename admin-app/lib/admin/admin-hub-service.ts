import { shouldUseMocks } from "@/lib/runtime-config";
import { type AdminHubSnapshot, adminHubSnapshotSchema } from "@/lib/schemas";
import { mockAdminHubSnapshot } from "@/lib/mock-data";

const useMocks = shouldUseMocks();

export async function getAdminHubSnapshot(): Promise<AdminHubSnapshot> {
  if (useMocks) {
    return mockAdminHubSnapshot;
  }

  try {
    const response = await fetch("/api/admin/hub", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Admin hub request failed with ${response.status}`);
    }
    const json = await response.json();
    return adminHubSnapshotSchema.parse(json);
  } catch (error) {
    console.error("Admin hub fetch failed", error);
    return adminHubSnapshotSchema.parse({
      sections: mockAdminHubSnapshot.sections,
      messages: [
        ...mockAdminHubSnapshot.messages,
        "Failed to load live admin hub sections. Showing mock snapshot instead.",
      ],
    });
  }
}
