import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { useSupabase } from './SupabaseContext'

const log = console

export interface CartItem {
  id: string
  name: string
  description?: string
  price: number
  quantity: number
  imageUrl?: string
  options?: Record<string, any>
}

interface CartContextType {
  items: CartItem[]
  total: number
  addItem: (item: Omit<CartItem, 'id'>) => void
  updateQuantity: (itemId: string, quantity: number) => void
  removeItem: (itemId: string) => void
  clearCart: () => void
  syncCart: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'waiter-ai-cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const { supabase, userId } = useSupabase()
  const [items, setItems] = useState<CartItem[]>([])

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY)
      if (savedCart) {
        const parsed = JSON.parse(savedCart)
        setItems(parsed.items || [])
        log.info('[Cart] Loaded from localStorage', { items: parsed.items?.length || 0 })
      }
    } catch (error) {
      log.error('[Cart] Load error', error)
    }
  }, [])

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items, updatedAt: new Date().toISOString() }))
      log.info('[Cart] Saved to localStorage', { items: items.length })
    } catch (error) {
      log.error('[Cart] Save error', error)
    }
  }, [items])

  // Sync cart with backend
  const syncCart = useCallback(async () => {
    if (!userId || items.length === 0) return

    try {
      const { error } = await supabase
        .from('draft_orders')
        .upsert({
          user_id: userId,
          items: items,
          total: total,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      log.info('[Cart] Synced to backend', { items: items.length, total })
    } catch (error) {
      log.error('[Cart] Sync error', error)
    }
  }, [userId, items, supabase])

  // Auto-sync every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (items.length > 0) {
        syncCart()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [items, syncCart])

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.name === item.name)

      if (existing) {
        return prev.map((i) =>
          i.name === item.name
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      }

      return [...prev, { ...item, id: `cart-${Date.now()}-${Math.random()}` }]
    })

    log.info('[Cart] Item added', { name: item.name, quantity: item.quantity })
  }, [])

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId)
      return
    }

    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    )

    log.info('[Cart] Quantity updated', { itemId, quantity })
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId))
    log.info('[Cart] Item removed', { itemId })
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    localStorage.removeItem(CART_STORAGE_KEY)
    log.info('[Cart] Cleared')
  }, [])

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        total,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        syncCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
