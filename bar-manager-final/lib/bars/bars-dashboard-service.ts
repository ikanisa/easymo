import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";

export interface BarFloorTable {
  table: string;
  openOrders: number;
  lastOrderAt: string;
}

export interface KitchenTicketItem {
  id: string;
  name: string;
  quantity: number;
  status: string;
}

export interface KitchenTicket {
  id: string;
  orderCode: string;
  status: string;
  table: string;
  createdAt: string;
  items: KitchenTicketItem[];
}

export interface BarThreadEvent {
  id: string;
  direction: "user" | "assistant";
  content: string;
  createdAt: string;
  agent: string | null;
}

export interface BarDashboardSnapshot {
  floor: BarFloorTable[];
  kitchen: KitchenTicket[];
  threads: BarThreadEvent[];
}

export interface BarDashboardParams {
  barId?: string;
  limit?: number;
}

export async function fetchBarDashboard(params: BarDashboardParams): Promise<BarDashboardSnapshot> {
  const searchParams = new URLSearchParams();
  if (params.barId) searchParams.set("barId", params.barId);
  if (params.limit) searchParams.set("limit", String(params.limit));

  const response = await apiFetch<BarDashboardSnapshot>(
    `${getAdminApiPath("bars/dashboard")}?${searchParams.toString()}`,
  );
  return response;
}
