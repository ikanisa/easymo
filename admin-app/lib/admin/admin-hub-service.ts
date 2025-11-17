import { type AdminHubSnapshot, adminHubSnapshotSchema } from "@/lib/schemas";
import { getAdminApiPath } from "@/lib/routes";

export async function getAdminHubSnapshot(): Promise<AdminHubSnapshot> {
  try {
    const response = await fetch(getAdminApiPath("admin", "hub"), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Admin hub request failed with ${response.status}`);
    }
    const json = await response.json();
    return adminHubSnapshotSchema.parse(json);
  } catch (error) {
    console.error("Admin hub fetch failed", error);
    return adminHubSnapshotSchema.parse({ sections: [], messages: ["Failed to load admin hub sections."] });
  }
}
