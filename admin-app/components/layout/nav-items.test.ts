import { beforeEach, describe, expect, it, vi } from "vitest";

declare global {
   
  var __EASYMO_FEATURE_FLAGS__:
    | {
        adminHubV2?: boolean;
      }
    | undefined;
}

const legacySectionTitles = ["Overview", "AI agents", "Operations", "Business", "Marketing", "System"] as const;

const legacyNavTitles = [
  "Dashboard",
  "Analytics",
  "Agent overview",
  "Agent dashboard",
  "Driver agent",
  "Pharmacy agent",
  "Shops and services agent",
  "Hardware agent",
  "Property agent",
  "Schedule agent",
  "Live conversations",
  "Playbooks",
  "Agent learning",
  "Performance",
  "Agent settings",
  "Provider routing",
  "Tools registry",
  "Tasks and workflows",
  "Active sessions",
  "Negotiations",
  "Vendor responses",
  "Video jobs",
  "Users",
  "Trips",
  "Insurance",
  "Marketplace",
  "SMS Vendors",
  "Client Portal",
  "Pharmacies",
  "Quincailleries",
  "Shops and services",
  "Bars and restaurants",
  "Property rentals",
  "MoMo QR and tokens",
  "Leads",
  "Live calls",
  "Voice analytics",
  "Video analytics",
  "Integrations",
  "System logs",
  "WhatsApp health",
  "WhatsApp menu",
  "Support",
  "Settings",
  "Admin controls",
] as const;

describe("layout navigation vocabulary", () => {
  beforeEach(() => {
    vi.resetModules();
    delete global.__EASYMO_FEATURE_FLAGS__;
    process.env.NEXT_PUBLIC_UI_V2_ENABLED = "false";
  });

  it("uses approved vocabulary when legacy navigation is enabled", async () => {
    global.__EASYMO_FEATURE_FLAGS__ = { adminHubV2: false };
    const navModule = await import("./nav-items");

    const sectionTitles = navModule.NAV_SECTIONS.map((section) => section.title);
    expect(sectionTitles).toEqual(Array.from(legacySectionTitles));

    const navTitles = navModule.NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.title));
    expect(navTitles).toEqual(Array.from(legacyNavTitles));

    [...sectionTitles, ...navTitles].forEach((title) => {
      expect(title.trim()).toBe(title);
      expect(title).not.toMatch(/&/);
      expect(title).not.toMatch(/\s{2,}/);
    });
  });

  it("exposes the hub navigation vocabulary when the flag is enabled", async () => {
    global.__EASYMO_FEATURE_FLAGS__ = { adminHubV2: true };
    const navModule = await import("./nav-items");

    const hubTitles = navModule.NAV_SECTIONS.flatMap((section) => [section.title, ...section.items.map((item) => item.title)]);
    expect(hubTitles).toEqual(["Hub", "Admin hub"]);

    hubTitles.forEach((title) => {
      expect(title.trim()).toBe(title);
      expect(title).not.toMatch(/&/);
    });
  });
});
