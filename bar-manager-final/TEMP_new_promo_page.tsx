"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PromoForm } from "@/components/promos/PromoForm"

const CATEGORIES = ["Cocktails", "Beers", "Wines", "Spirits", "Food", "Soft Drinks", "Coffee & Tea", "Desserts"]

export default function NewPromoPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()
  const barId = typeof window !== 'undefined' ? localStorage.getItem("bar_id") : null

  async function handleSubmit(data: any) {
    setIsSubmitting(true)
    setError(null)

    try {
      if (!barId) {
        throw new Error("Bar ID not set. Please set bar_id in localStorage.")
      }

      const { error: insertError } = await supabase
        .from("menu_promos")
        .insert({
          bar_id: barId,
          ...data,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (insertError) throw insertError

      router.push("/promos")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create promo")
      setIsSubmitting(false)
    }
  }

  if (!barId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="p-6 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800">
            ⚠️ Bar ID not set. Open DevTools (Cmd+Option+I) and run:
            <code className="block mt-2 p-2 bg-white rounded">
              localStorage.setItem("bar_id", "YOUR-BAR-UUID")
            </code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Create Promo</h1>
          <p className="text-gray-600">Set up happy hours, discounts, and special offers</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">
            ❌ {error}
          </div>
        )}

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <PromoForm 
            onSubmit={handleSubmit} 
            categories={CATEGORIES}
          />
        </div>

        <div className="mt-4 flex justify-between">
          <button
            onClick={() => router.push("/promos")}
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
