'use client'

import { createContext, useCallback, useContext, useEffect,useState } from 'react'

import { createClient } from '@/lib/supabase'
import type { MenuItem } from '@/types/menu'

export interface CartItem {
  id: string
  menu_item_id: string
  name: string
  description?: string
  price: number
  quantity: number
  image_url?: string
  options?: Record<string, any>
  special_requests?: string
}

interface CartContextType {
  items: CartItem[]
  total: number
  subtotal: number
  tax: number
  itemCount: number
  draftOrderId: string | null
  isLoading: boolean
  addItem: (item: MenuItem, quantity?: number, options?: Record<string, any>, specialRequests?: string) => Promise<void>
  updateQuantity: (itemId: string, quantity: number) => Promise<void>
  removeItem: (itemId: string) => Promise<void>
  clearCart: () => Promise<void>
  syncCart: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const supabase = createClient()
  const [items, setItems] = useState<CartItem[]>([])
  const [draftOrderId, setDraftOrderId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = subtotal * 0.1 // 10% tax
  const total = subtotal + tax
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('waiter-ai-cart')
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart)
        setItems(parsed.items || [])
        setDraftOrderId(parsed.draftOrderId || null)
      } catch (error) {
        console.error('Failed to load cart from localStorage:', error)
      }
    }
  }, [])

  // Save cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('waiter-ai-cart', JSON.stringify({ 
      items, 
      draftOrderId,
      timestamp: new Date().toISOString()
    }))
  }, [items, draftOrderId])

  // Sync cart with backend
  const syncCart = useCallback(async () => {
    if (items.length === 0) return

    try {
      setIsLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        const { data: { user: anonUser } } = await supabase.auth.signInAnonymously()
        if (!anonUser) throw new Error('Failed to create session')
      }

      // Get or create draft order
      let orderId = draftOrderId

      if (!orderId) {
        const { data: newOrder, error } = await supabase
          .from('draft_orders')
          .insert({
            user_id: user?.id,
            status: 'draft',
            subtotal,
            tax,
            total
          })
          .select('id')
          .single()

        if (error) throw error
        orderId = newOrder.id
        setDraftOrderId(orderId)
      } else {
        // Update existing draft order totals
        await supabase
          .from('draft_orders')
          .update({
            subtotal,
            tax,
            total,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
      }

      // Sync items
      // First, delete all existing items
      await supabase
        .from('draft_order_items')
        .delete()
        .eq('draft_order_id', orderId)

      // Then insert current items
      if (items.length > 0) {
        const itemsToInsert = items.map(item => ({
          draft_order_id: orderId,
          user_id: user?.id,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          unit_price: item.price,
          options: item.options || {},
          special_requests: item.special_requests
        }))

        await supabase
          .from('draft_order_items')
          .insert(itemsToInsert)
      }

      console.log('Cart synced successfully')
    } catch (error) {
      console.error('Failed to sync cart:', error)
    } finally {
      setIsLoading(false)
    }
  }, [items, draftOrderId, subtotal, tax, total, supabase])

  const addItem = useCallback(async (
    menuItem: MenuItem, 
    quantity = 1, 
    options?: Record<string, any>,
    specialRequests?: string
  ) => {
    setItems(prev => {
      const existingIndex = prev.findIndex(
        i => i.menu_item_id === menuItem.id && 
        JSON.stringify(i.options) === JSON.stringify(options)
      )

      if (existingIndex >= 0) {
        // Update existing item quantity
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity
        }
        return updated
      }

      // Add new item
      const newItem: CartItem = {
        id: `cart-${Date.now()}-${Math.random()}`,
        menu_item_id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description || undefined,
        price: menuItem.price,
        quantity,
        image_url: menuItem.image_url || undefined,
        options,
        special_requests: specialRequests
      }
      return [...prev, newItem]
    })

    // Sync after a short delay to batch updates
    setTimeout(() => syncCart(), 500)
  }, [syncCart])

  const removeItem = useCallback(async (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId))
    setTimeout(() => syncCart(), 500)
  }, [syncCart])

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeItem(itemId)
      return
    }

    setItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    )

    setTimeout(() => syncCart(), 500)
  }, [removeItem, syncCart])

  const clearCart = useCallback(async () => {
    setItems([])
    
    if (draftOrderId) {
      try {
        await supabase
          .from('draft_orders')
          .update({ status: 'cancelled' })
          .eq('id', draftOrderId)
      } catch (error) {
        console.error('Failed to cancel draft order:', error)
      }
    }

    setDraftOrderId(null)
    localStorage.removeItem('waiter-ai-cart')
  }, [draftOrderId, supabase])

  return (
    <CartContext.Provider
      value={{
        items,
        total,
        subtotal,
        tax,
        itemCount,
        draftOrderId,
        isLoading,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        syncCart,
      }}
    >
      {children as any}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
