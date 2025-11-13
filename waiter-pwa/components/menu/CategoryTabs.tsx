'use client'

import { useMenu } from '@/contexts/MenuContext'
import { cn } from '@/lib/utils'

export default function CategoryTabs() {
  const { categories, selectedCategory, setSelectedCategory } = useMenu()

  if (categories.length === 0) return null

  return (
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <div className="flex gap-2 min-w-min">
        <button
          onClick={() => setSelectedCategory(null)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
            selectedCategory === null
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          )}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              selectedCategory === category.id
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {category.icon_emoji && <span className="mr-1.5">{category.icon_emoji}</span>}
            {category.name}
          </button>
        ))}
      </div>
    </div>
  )
}
