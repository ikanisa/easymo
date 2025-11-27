"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { MenuItemForm } from "@/components/menu/MenuItemForm"

const CATEGORIES = ["Cocktails", "Beers", "Wines", "Spirits", "Food", "Soft Drinks", "Coffee & Tea", "Desserts", "Starters", "Main Course"]

export default function EditMenuItemPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadItem() {
      try {
        const { data, error } = await supabase
          .from("restaurant_menu_items")
          .select("*")
          .eq("id", params.id)
          .single()

        if (error) {
          setError("Failed to load menu item: " + error.message)
        } else if (!data) {
          setError("Menu item not found")
        } else {
          setItem(data)
        }
      } catch (err) {
        setError("Unexpected error loading menu item")
      } finally {
        setIsLoading(false)
      }
    }

    loadItem()
  }, [params.id, supabase])

  async function handleSubmit(data: any) {
    setIsSubmitting(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from("restaurant_menu_items")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)

      if (updateError) throw updateError

      router.push("/menu")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update menu item")
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading menu item...</p>
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="p-6 bg-red-100 border border-red-300 rounded-lg text-red-800">
            ❌ {error || "Menu item not found"}
          </div>
          <button
            onClick={() => router.push("/menu")}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Edit Menu Item</h1>
          <p className="text-gray-600">Update {item.name}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">
            ❌ {error}
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <MenuItemForm 
            onSubmit={handleSubmit}
            initialData={item}
            categories={CATEGORIES}
            isSubmitting={isSubmitting}
          />
        </div>

        <div className="mt-4 flex justify-between">
          <button
            onClick={() => router.push("/menu")}
            disabled={isSubmitting}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            ← Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
