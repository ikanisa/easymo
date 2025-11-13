'use client'

import { useMenu } from '@/contexts/MenuContext'
import { XMarkIcon, MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { useRouter } from 'next/navigation'

interface CartModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CartModal({ isOpen, onClose }: CartModalProps) {
  const { cart, cartTotal, updateCartQuantity, removeFromCart, clearCart } = useMenu()
  const router = useRouter()

  const handleCheckout = () => {
    onClose()
    router.push('/checkout')
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-end sm:items-center sm:justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-full sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-full sm:scale-95"
          >
            <Dialog.Panel className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <Dialog.Title className="text-lg font-semibold">
                  Your Cart ({cart.length})
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    Your cart is empty
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex gap-3 bg-gray-50 p-3 rounded-lg">
                      {item.menu_item.image_url && (
                        <img
                          src={item.menu_item.image_url}
                          alt={item.menu_item.name}
                          className="w-16 h-16 rounded object-cover"
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {item.menu_item.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {item.menu_item.currency} {item.menu_item.price.toFixed(2)}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                            className="p-1 hover:bg-white rounded transition-colors"
                          >
                            <MinusIcon className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                            className="p-1 hover:bg-white rounded transition-colors"
                          >
                            <PlusIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-auto p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {item.menu_item.currency} {item.subtotal.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {cart.length > 0 && (
                <div className="border-t p-4 space-y-3">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary-600">
                      {cart[0]?.menu_item.currency || '$'} {cartTotal.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (confirm('Clear all items from cart?')) {
                          clearCart()
                          onClose()
                        }
                      }}
                      className="flex-1 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Clear Cart
                    </button>
                    <button
                      onClick={handleCheckout}
                      className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                    >
                      Checkout
                    </button>
                  </div>
                </div>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}
