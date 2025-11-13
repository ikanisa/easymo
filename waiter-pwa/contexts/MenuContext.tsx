'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { getMenuCategories, getMenuItems } from '@/lib/supabase/menu'
import type { MenuCategory, MenuItem, CartItem } from '@/types/menu'

interface MenuContextType {
  categories: MenuCategory[]
  items: MenuItem[]
  cart: CartItem[]
  loading: boolean
  error: string | null
  selectedCategory: string | null
  setSelectedCategory: (categoryId: string | null) => void
  addToCart: (item: MenuItem, quantity?: number) => void
  removeFromCart: (itemId: string) => void
  updateCartQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  cartTotal: number
  cartCount: number
}

const MenuContext = createContext<MenuContextType | undefined>(undefined)

export function MenuProvider({ 
  children, 
  restaurantId 
}: { 
  children: ReactNode
  restaurantId?: string
}) {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Load categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getMenuCategories(restaurantId || '')
        setCategories(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load categories')
      }
    }
    if (restaurantId) {
      loadCategories()
    }
  }, [restaurantId])

  // Load items when category changes
  useEffect(() => {
    async function loadItems() {
      setLoading(true)
      try {
        const data = await getMenuItems(restaurantId || '', selectedCategory || undefined)
        setItems(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load menu items')
      } finally {
        setLoading(false)
      }
    }
    if (restaurantId) {
      loadItems()
    }
  }, [restaurantId, selectedCategory])

  // Cart operations
  const addToCart = (item: MenuItem, quantity = 1) => {
    setCart(prevCart => {
      const existing = prevCart.find(ci => ci.menu_item.id === item.id)
      if (existing) {
        return prevCart.map(ci =>
          ci.menu_item.id === item.id
            ? { ...ci, quantity: ci.quantity + quantity, subtotal: (ci.quantity + quantity) * item.price }
            : ci
        )
      }
      return [
        ...prevCart,
        {
          id: crypto.randomUUID(),
          menu_item: item,
          quantity,
          subtotal: item.price * quantity
        }
      ]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart(prevCart => prevCart.filter(ci => ci.id !== itemId))
  }

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId)
      return
    }
    setCart(prevCart =>
      prevCart.map(ci =>
        ci.id === itemId
          ? { ...ci, quantity, subtotal: quantity * ci.menu_item.price }
          : ci
      )
    )
  }

  const clearCart = () => {
    setCart([])
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <MenuContext.Provider
      value={{
        categories,
        items,
        cart,
        loading,
        error,
        selectedCategory,
        setSelectedCategory,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartTotal,
        cartCount
      }}
    >
      {children}
    </MenuContext.Provider>
  )
}

export function useMenu() {
  const context = useContext(MenuContext)
  if (!context) {
    throw new Error('useMenu must be used within MenuProvider')
  }
  return context
}
