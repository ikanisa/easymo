'use client'

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

import { useMenu } from '@/contexts/MenuContext'
import { searchMenuItems } from '@/lib/supabase/menu'
import type { MenuItem } from '@/types/menu'

export default function MenuSearch({ restaurantId }: { restaurantId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MenuItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const { addToCart } = useMenu()

  const handleSearch = async (searchQuery: string) => {
    setQuery(searchQuery)
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    try {
      const data = await searchMenuItems(restaurantId, searchQuery)
      setResults(data)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="search"
          placeholder="Search menu..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {query && results.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
          {results.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                addToCart(item)
                setQuery('')
                setResults([])
              }}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center border-b last:border-b-0"
            >
              <div>
                <div className="font-medium text-gray-900">{item.name}</div>
                {item.description && (
                  <div className="text-sm text-gray-500 line-clamp-1">{item.description}</div>
                )}
              </div>
              <div className="text-primary-600 font-semibold">
                {item.currency} {item.price.toFixed(2)}
              </div>
            </button>
          ))}
        </div>
      )}

      {query && !isSearching && results.length === 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-4 text-center text-gray-500">
          No items found
        </div>
      )}
    </div>
  )
}
