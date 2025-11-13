'use client'

import { useMenu } from '@/contexts/MenuContext'
import { ShoppingCartIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import CartModal from './CartModal'

export default function CartButton() {
  const { cartCount, cartTotal } = useMenu()
  const [isOpen, setIsOpen] = useState(false)

  if (cartCount === 0) return null

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all p-4 flex items-center gap-3 z-40"
      >
        <div className="relative">
          <ShoppingCartIcon className="w-6 h-6" />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </div>
        <div className="text-left">
          <div className="text-xs opacity-90">View Cart</div>
          <div className="font-bold">${cartTotal.toFixed(2)}</div>
        </div>
      </button>

      <CartModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}
