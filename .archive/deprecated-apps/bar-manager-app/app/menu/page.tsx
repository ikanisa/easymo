"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import type { MenuItem } from "@/lib/types"

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const barId = typeof window !== 'undefined' ? localStorage.getItem("bar_id") : null

  useEffect(() => {
    if (!barId) return

    async function loadMenu() {
      const { data } = await supabase
        .from("restaurant_menu_items")
        .select("*")
        .eq("bar_id", barId)
        .order("display_order", { ascending: true })

      if (data) {
        setItems(data as any)
        const uniqueCategories = [...new Set(data.map((item) => item.category))]
        setCategories(uniqueCategories)
      }
      setIsLoading(false)
    }

    loadMenu()
  }, [barId, supabase])

  const toggleAvailability = async (itemId: string, isAvailable: boolean) => {
    const { error } = await supabase
      .from("restaurant_menu_items")
      .update({ is_available: !isAvailable })
      .eq("id", itemId)

    if (!error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, is_available: !isAvailable } : item
        )
      )
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return

    const { error } = await supabase
      .from("restaurant_menu_items")
      .delete()
      .eq("id", itemId)

    if (!error) {
      setItems((prev) => prev.filter((item) => item.id !== itemId))
    }
  }

  const filteredItems =
    selectedCategory === "all"
      ? items
      : items.filter((item) => item.category === selectedCategory)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu Manager</h1>
          <p className="text-gray-600">{items.length} items</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/menu/upload"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
          >
            🤖 AI Upload
          </Link>
          <Link
            href="/menu/new"
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
          >
            + Add Item
          </Link>
        </div>
      </header>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-4 py-2 rounded-full whitespace-nowrap ${
            selectedCategory === "all"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 border"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full whitespace-nowrap ${
              selectedCategory === cat
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-gray-500 text-lg">No menu items yet</p>
          <p className="text-gray-400 text-sm mt-2">
            Use AI Upload to extract items from menus, or add manually
          </p>
          <div className="flex gap-4 justify-center mt-6">
            <Link
              href="/menu/upload"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
            >
              🤖 AI Upload
            </Link>
            <Link
              href="/menu/new"
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
            >
              + Add Manually
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-bold">{item.name}</h3>
                <button
                  onClick={() => toggleAvailability(item.id, item.is_available)}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.is_available
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {item.is_available ? "Available" : "Unavailable"}
                </button>
              </div>

              {item.description && (
                <p className="text-sm text-gray-600 mb-2">{item.description}</p>
              )}

              <p className="text-xl font-bold text-blue-600 mb-3">
                {item.price.toLocaleString()} RWF
              </p>

              <div className="flex gap-2">
                <Link
                  href={`/menu/${item.id}/edit`}
                  className="flex-1 px-3 py-2 text-center bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  Edit
                </Link>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="flex-1 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
