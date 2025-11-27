"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { MenuItemForm } from "@/components/menu/MenuItemForm"
import type { MenuItemFormData } from "@/components/menu/MenuItemForm"
import type { MenuItem } from "@/lib/types"

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

export default function EditMenuItemPage() {
  const params = useParams()
  const router = useRouter()
  const [item, setItem] = useState<MenuItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const itemId = params.id as string

  useEffect(() => {
    async function loadItem() {
      const { data, error } = await supabase
        .from("restaurant_menu_items")
        .select("*")
        .eq("id", itemId)
        .single()

      if (data) {
        setItem(data as any)
      }
      setIsLoading(false)
    }

    loadItem()
  }, [itemId, supabase])

  const handleSubmit = async (data: MenuItemFormData) => {
    const { error } = await supabase
      .from("restaurant_menu_items")
      .update({
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category,
        is_available: data.is_available,
        image_url: data.image_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      router.push("/menu")
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this menu item?")) {
      return
    }

    const { error } = await supabase
      .from("restaurant_menu_items")
      .delete()
      .eq("id", itemId)

    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      router.push("/menu")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading item...</p>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Menu item not found</p>
          <button
            onClick={() => router.push("/menu")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Menu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6">
          <button
            onClick={() => router.push("/menu")}
            className="text-blue-600 hover:underline mb-2"
          >
            ← Back to Menu
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Edit Menu Item</h1>
          <p className="text-gray-600">Update the details of this menu item</p>
        </header>

        <div className="bg-white rounded-xl border shadow-sm p-6 mb-4">
          <MenuItemForm
            onSubmit={handleSubmit}
            categories={CATEGORIES}
            initialData={{
              name: item.name,
              description: item.description || "",
              price: item.price,
              category: item.category,
              is_available: item.is_available,
              image_url: item.image_url || "",
            }}
          />
        </div>

        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-red-600 mb-2">Danger Zone</h2>
          <p className="text-sm text-gray-600 mb-4">
            Once you delete this item, it cannot be recovered.
          </p>
          <button
            onClick={handleDelete}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete Menu Item
          </button>
        </div>
      </div>
    </div>
  )
}
