"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { MenuItemForm } from "@/components/menu/MenuItemForm"
import type { MenuItemFormData } from "@/components/menu/MenuItemForm"

const CATEGORIES = [
  "Cocktails",
  "Beers",
  "Wines",
  "Spirits",
  "Soft Drinks",
  "Coffee & Tea",
  "Starters",
  "Main Course",
  "Desserts",
  "Sides",
  "Fast Food",
  "Snacks",
]

export default function NewMenuItemPage() {
  const router = useRouter()
  const supabase = createClient()
  const barId = typeof window !== 'undefined' ? localStorage.getItem("bar_id") : null

  const handleSubmit = async (data: MenuItemFormData) => {
    if (!barId) {
      alert("Please set bar_id in localStorage")
      return
    }

    const { error } = await supabase
      .from("restaurant_menu_items")
      .insert({
        bar_id: barId,
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        is_available: data.is_available,
        image_url: data.image_url,
        currency: "RWF",
      })

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      router.push("/menu")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Add Menu Item</h1>
          <p className="text-gray-600">Create a new item for your menu</p>
        </header>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <MenuItemForm
            onSubmit={handleSubmit}
            categories={CATEGORIES}
          />
        </div>
      </div>
    </div>
  )
}
