'use client'

import { useMenu } from '@/contexts/MenuContext'
import type { MenuItem } from '@/types/menu'
import { PlusIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface MenuItemCardProps {
  item: MenuItem
}

export default function MenuItemCard({ item }: MenuItemCardProps) {
  const { addToCart, cart } = useMenu()
  const [justAdded, setJustAdded] = useState(false)

  const inCart = cart.some(ci => ci.menu_item.id === item.id)

  const handleAdd = () => {
    addToCart(item)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1000)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {item.image_url && (
        <div className="aspect-video w-full bg-gray-100 overflow-hidden">
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900 flex-1">{item.name}</h3>
          <span className="text-primary-600 font-bold ml-2 whitespace-nowrap">
            {item.currency} {item.price.toFixed(2)}
          </span>
        </div>

        {item.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
        )}

        {(item.dietary_tags || item.allergens) && (
          <div className="flex flex-wrap gap-1 mb-3">
            {item.dietary_tags?.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full"
              >
                {tag}
              </span>
            ))}
            {item.allergens?.map((allergen) => (
              <span
                key={allergen}
                className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full"
              >
                ⚠️ {allergen}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={justAdded}
          className={cn(
            'w-full py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
            justAdded || inCart
              ? 'bg-green-500 text-white'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          )}
        >
          {justAdded ? (
            <>
              <CheckIcon className="w-5 h-5" />
              Added!
            </>
          ) : inCart ? (
            <>
              <CheckIcon className="w-5 h-5" />
              In Cart
            </>
          ) : (
            <>
              <PlusIcon className="w-5 h-5" />
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  )
}
