import { createClient } from "@/lib/supabase/server";
import type {
  WhatsAppHomeMenuItem,
  UpdateMenuItemInput,
} from "@/types/whatsapp-menu";

export async function fetchWhatsAppMenuItems(): Promise<WhatsAppHomeMenuItem[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("whatsapp_home_menu_items")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch WhatsApp menu items:", error);
    throw new Error("Failed to fetch menu items");
  }

  return data || [];
}

export async function updateWhatsAppMenuItem(
  id: string,
  updates: UpdateMenuItemInput
): Promise<WhatsAppHomeMenuItem> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("whatsapp_home_menu_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update WhatsApp menu item:", error);
    throw new Error("Failed to update menu item");
  }

  return data;
}

export const whatsappMenuQueryKeys = {
  all: ["whatsapp-menu"] as const,
  list: () => [...whatsappMenuQueryKeys.all, "list"] as const,
  detail: (id: string) => [...whatsappMenuQueryKeys.all, "detail", id] as const,
};
