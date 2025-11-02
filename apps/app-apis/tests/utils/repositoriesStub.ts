import type { DomainRepositories } from "@app-apis/lib/supabase";
import type { AppDatabase } from "@app-apis/types/database";

export interface RepositoryCall {
  operation: string;
  args: unknown[];
}

export interface RepositoryOverrides {
  favoritesList?: DomainRepositories["favorites"]["list"];
  driverGet?: DomainRepositories["driver"]["get"];
  matchCreate?: DomainRepositories["match"]["create"];
  deeplinkUpsert?: DomainRepositories["deeplink"]["upsert"];
  brokerPublish?: DomainRepositories["broker"]["publish"];
  adminList?: DomainRepositories["admin"]["list"];
}

const defaultRows: AppDatabase["public"]["Tables"]["favorites"]["Row"][] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    user_id: "00000000-0000-0000-0000-000000000010",
    driver_id: "00000000-0000-0000-0000-000000000020",
    created_at: new Date().toISOString(),
  },
];

const defaultDriver: AppDatabase["public"]["Tables"]["drivers"]["Row"] = {
  id: "00000000-0000-0000-0000-000000000020",
  name: "Test Driver",
  rating: 4.5,
  vehicle: "Sedan",
  updated_at: new Date().toISOString(),
};

const defaultMatch: AppDatabase["public"]["Tables"]["matches"]["Row"] = {
  id: "00000000-0000-0000-0000-000000000030",
  rider_id: "00000000-0000-0000-0000-000000000011",
  driver_id: defaultDriver.id,
  pickup_time: new Date().toISOString(),
  status: "pending",
};

const defaultDeeplink: AppDatabase["public"]["Tables"]["deeplinks"]["Row"] = {
  id: "00000000-0000-0000-0000-000000000040",
  target: "booking",
  url: "https://example.com/booking",
  metadata: { type: "test" },
  created_at: new Date().toISOString(),
};

const defaultBrokerMessage: AppDatabase["public"]["Tables"]["broker_messages"]["Row"] = {
  id: "00000000-0000-0000-0000-000000000050",
  topic: "events",
  payload: { value: "example" },
  created_at: new Date().toISOString(),
};

const defaultAdminAudit: AppDatabase["public"]["Tables"]["admin_audit"]["Row"][] = [
  {
    id: "00000000-0000-0000-0000-000000000060",
    actor: "admin",
    action: "login",
    metadata: { ip: "127.0.0.1" },
    created_at: new Date().toISOString(),
  },
];

export const createRepositoryStub = (
  overrides: RepositoryOverrides = {}
): { repositories: DomainRepositories; calls: RepositoryCall[] } => {
  const calls: RepositoryCall[] = [];

  const repositories: DomainRepositories = {
    favorites: {
      list: overrides.favoritesList ?? (async (...args) => {
        const [context, query] = args as Parameters<DomainRepositories["favorites"]["list"]>;
        calls.push({ operation: "favorites.list", args: [context, query] });
        return {
          rows: defaultRows,
          total: defaultRows.length,
        };
      }),
    },
    driver: {
      get: overrides.driverGet ?? (async (...args) => {
        const [context, driverId] = args as Parameters<DomainRepositories["driver"]["get"]>;
        calls.push({ operation: "driver.get", args: [context, driverId] });
        return driverId === defaultDriver.id ? defaultDriver : null;
      }),
    },
    match: {
      create: overrides.matchCreate ?? (async (...args) => {
        const [context, payload] = args as Parameters<DomainRepositories["match"]["create"]>;
        calls.push({ operation: "match.create", args: [context, payload] });
        return { ...defaultMatch, ...payload };
      }),
    },
    deeplink: {
      upsert: overrides.deeplinkUpsert ?? (async (...args) => {
        const [context, payload] = args as Parameters<DomainRepositories["deeplink"]["upsert"]>;
        calls.push({ operation: "deeplink.upsert", args: [context, payload] });
        return { ...defaultDeeplink, ...payload };
      }),
    },
    broker: {
      publish: overrides.brokerPublish ?? (async (...args) => {
        const [context, payload] = args as Parameters<DomainRepositories["broker"]["publish"]>;
        calls.push({ operation: "broker.publish", args: [context, payload] });
        return { ...defaultBrokerMessage, ...payload };
      }),
    },
    admin: {
      list: overrides.adminList ?? (async (...args) => {
        const [context, query] = args as Parameters<DomainRepositories["admin"]["list"]>;
        calls.push({ operation: "admin.list", args: [context, query] });
        return {
          rows: defaultAdminAudit,
          total: defaultAdminAudit.length,
        };
      }),
    },
  };

  return { repositories, calls };
};
