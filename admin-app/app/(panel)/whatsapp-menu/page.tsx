export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { WhatsAppMenuClient } from "./WhatsAppMenuClient";
import type { WhatsAppHomeMenuItem } from "@/types/whatsapp-menu";

export const metadata = {
  title: "WhatsApp Home Menu | EasyMO Admin",
  description: "Manage dynamic WhatsApp home menu items",
};

async function fetchMenuItems(): Promise<WhatsAppHomeMenuItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("whatsapp_home_menu_items")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch WhatsApp menu items:", error);
    return [];
  }

  return data || [];
}

export default async function WhatsAppMenuPage() {
  const initialItems = await fetchMenuItems();

  return <WhatsAppMenuClient initialItems={initialItems} />;
}
