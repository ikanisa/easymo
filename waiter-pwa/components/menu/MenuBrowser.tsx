'use client'

import { useMenu } from '@/contexts/MenuContext'
import CategoryTabs from './CategoryTabs'
import MenuItemCard from './MenuItemCard'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

function MenuBrowser() {
  const { items, loading, error } = useMenu()

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <div className="text-center">
          <p className="text-red-600 mb-2">Error loading menu</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-2" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <div className="text-center">
          <p className="text-gray-600">No items available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CategoryTabs />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

export { MenuBrowser }
export default MenuBrowser
