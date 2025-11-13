import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ShoppingCart, Search, Plus, Minus } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useSupabase } from '@/contexts/SupabaseContext'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const log = console

interface MenuItem {
  id: string
  category_id?: string
  name: string
  description?: string
  price: number
  image_url?: string
  tags?: string[]
  available?: boolean
}

interface MenuCategory {
  id: string
  name: string
  description?: string
  sort_order?: number
}

export function MenuView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { supabase } = useSupabase()
  const { addItem, items: cartItems } = useCart()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0)

  // Fetch menu categories
  const { data: categories = [] } = useQuery({
    queryKey: ['menu-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .order('sort_order')

      if (error) {
        log.error('[Menu] Categories error', error)
        return []
      }
      return data as MenuCategory[]
    },
    staleTime: 1000 * 60 * 60,
  })

  // Fetch menu items
  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menu-items', selectedCategory, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)

      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory)
      }

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
      }

      const { data, error } = await query.order('name')

      if (error) {
        log.error('[Menu] Items error', error)
        return []
      }
      return data as MenuItem[]
    },
    staleTime: 1000 * 60 * 30,
  })

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory('all')
    }
  }, [categories, selectedCategory])

  const handleAddToCart = (item: MenuItem) => {
    const quantity = quantities[item.id] || 1

    addItem({
      name: item.name,
      price: item.price,
      quantity,
    })

    setQuantities((prev) => ({ ...prev, [item.id]: 1 }))

    log.info('[Menu] Item added', { itemId: item.id, quantity })
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(1, (prev[itemId] || 1) + delta),
    }))
  }

  const getCartQuantity = (itemId: string) => {
    return cartItems
      .filter((item) => item.name === menuItems.find((m) => m.id === itemId)?.name)
      .reduce((sum, item) => sum + item.quantity, 0)
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm px-4 py-3 flex items-center justify-between safe-area-inset-top">
        <Button variant="ghost" size="sm" onClick={() => navigate('/chat')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <h1 className="text-lg font-semibold">{t('menu.title')}</h1>

        <Button
          variant="ghost"
          size="sm"
          className="relative"
          onClick={() => navigate('/cart')}
        >
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              {itemCount}
            </span>
          )}
        </Button>
      </header>

      {/* Search */}
      <div className="p-4 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <input
            placeholder={t('menu.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="px-4 py-2 bg-card border-b">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {t('menu.all') || 'All'}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : menuItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground">
              {searchQuery
                ? t('menu.noResults') || 'No items found'
                : t('menu.empty') || 'Menu is empty'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {menuItems.map((item) => {
              const cartQty = getCartQuantity(item.id)
              const qty = quantities[item.id] || 1

              return (
                <div
                  key={item.id}
                  className="bg-card rounded-lg border p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base">
                        {item.name}
                        {cartQty > 0 && (
                          <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {cartQty} in cart
                          </span>
                        )}
                      </h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold text-lg ml-4">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        disabled={qty <= 1}
                        className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted disabled:opacity-50"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="w-8 text-center font-medium">{qty}</span>

                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <Button size="sm" onClick={() => handleAddToCart(item)}>
                      {t('menu.addToCart')}
                    </Button>
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-muted px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer - View Cart */}
      {itemCount > 0 && (
        <div className="p-4 bg-card border-t safe-area-inset-bottom">
          <Button
            className="w-full"
            size="lg"
            onClick={() => navigate('/cart')}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            {t('menu.viewCart')} ({itemCount})
          </Button>
        </div>
      )}
    </div>
  )
}
