"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PromoCard } from "@/components/promos/PromoCard"

interface Promo {
  id: string
  name: string
  description: string
  promo_type: string
  discount_value: number
  is_active: boolean
  valid_from: string
  valid_until: string
}

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const barId = typeof window !== 'undefined' ? localStorage.getItem("bar_id") : null

  useEffect(() => {
    if (!barId) return

    async function loadPromos() {
      const { data, error } = await supabase
        .from("menu_promos")
        .select("*")
        .eq("bar_id", barId)
        .order("created_at", { ascending: false })

      if (data) {
        setPromos(data as any)
      }
      setIsLoading(false)
    }

    loadPromos()
  }, [barId, supabase])

  const toggleActive = async (promoId: string, isActive: boolean) => {
    const { error } = await supabase
      .from("menu_promos")
      .update({ is_active: !isActive })
      .eq("id", promoId)

    if (!error) {
      setPromos((prev) =>
        prev.map((promo) =>
          promo.id === promoId ? { ...promo, is_active: !isActive } : promo
        )
      )
    }
  }

  const deletePromo = async (promoId: string) => {
    const { error } = await supabase
      .from("menu_promos")
      .delete()
      .eq("id", promoId)

    if (!error) {
      setPromos((prev) => prev.filter((promo) => promo.id !== promoId))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Promotions</h1>
            <p className="text-gray-600">{promos.length} promos</p>
          </div>
          <Link
            href="/promos/new"
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
          >
            + Create Promo
          </Link>
        </header>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promos.map((promo) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                onToggleActive={toggleActive}
                onDelete={deletePromo}
              />
            ))}
          </div>
        )}

        {!isLoading && promos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No promotions yet</p>
            <Link
              href="/promos/new"
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700"
            >
              Create Your First Promo
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
