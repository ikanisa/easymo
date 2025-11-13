import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { UpdateMenuItemInput } from "@/types/whatsapp-menu";

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("whatsapp_home_menu_items")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch WhatsApp menu items:", error);
      return NextResponse.json(
        { error: "Failed to fetch menu items" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body as { id: string } & UpdateMenuItemInput;

    if (!id) {
      return NextResponse.json(
        { error: "Menu item ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from("whatsapp_home_menu_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update WhatsApp menu item:", error);
      return NextResponse.json(
        { error: "Failed to update menu item" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
