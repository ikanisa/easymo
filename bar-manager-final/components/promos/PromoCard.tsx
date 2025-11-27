"use client"

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

interface PromoCardProps {
  promo: Promo
  onToggleActive: (promoId: string, isActive: boolean) => Promise<void>
  onDelete: (promoId: string) => Promise<void>
}

export function PromoCard({ promo, onToggleActive, onDelete }: PromoCardProps) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">{promo.name}</h3>
          {promo.description && (
            <p className="text-sm text-gray-600 mt-1">{promo.description}</p>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          promo.is_active 
            ? "bg-green-100 text-green-700" 
            : "bg-gray-100 text-gray-700"
        }`}>
          {promo.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mb-4">
        <p className="text-2xl font-bold text-blue-600">
          {promo.promo_type === "percentage" ? `${promo.discount_value}% OFF` : 
           promo.promo_type === "fixed_amount" ? `${promo.discount_value} RWF OFF` :
           promo.promo_type}
        </p>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        <p>Valid: {new Date(promo.valid_from).toLocaleDateString()} - {
          promo.valid_until ? new Date(promo.valid_until).toLocaleDateString() : "Ongoing"
        }</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onToggleActive(promo.id, promo.is_active)}
          className={`flex-1 py-2 rounded-lg text-sm font-medium ${
            promo.is_active
              ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          {promo.is_active ? "Deactivate" : "Activate"}
        </button>

        <button
          onClick={() => {
            if (confirm(`Delete "${promo.name}"?`)) {
              onDelete(promo.id)
            }
          }}
          className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
