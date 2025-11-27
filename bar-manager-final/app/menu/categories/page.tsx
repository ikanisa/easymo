"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function CategoriesPage() {
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const barId = typeof window !== 'undefined' ? localStorage.getItem("bar_id") : null

  useEffect(() => {
    if (!barId) return

    async function loadCategories() {
      const { data, error } = await supabase
        .from("restaurant_menu_items")
        .select("category")
        .eq("bar_id", barId)

      if (data) {
        const categoryCounts = data.reduce((acc: any, item) => {
          acc[item.category] = (acc[item.category] || 0) + 1
          return acc
        }, {})

        setCategories(
          Object.entries(categoryCounts).map(([category, count]) => ({
            category,
            count: count as number,
          }))
        )
      }
      setIsLoading(false)
    }

    loadCategories()
  }, [barId, supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Menu Categories</h1>
          <p className="text-gray-600">Manage your menu organization</p>
        </header>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(({ category, count }) => (
              <div
                key={category}
                className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-2">{category}</h3>
                <p className="text-gray-600">{count} items</p>
              </div>
            ))}
          </div>
        )}

        {!isLoading && categories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No categories found. Add menu items to see categories.</p>
          </div>
        )}
      </div>
    </div>
  )
}
