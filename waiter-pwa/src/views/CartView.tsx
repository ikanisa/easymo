import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { Button } from '@/components/ui/button'

const log = console

export function CartView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { items, total, updateQuantity, removeItem, clearCart } = useCart()

  const handleCheckout = () => {
    if (items.length === 0) return
    log.info('[Cart] Proceeding to checkout', { items: items.length, total })
    navigate('/payment')
  }

  const handleClearCart = () => {
    if (confirm(t('cart.clearConfirm') || 'Clear all items from cart?')) {
      clearCart()
      log.info('[Cart] Cart cleared')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm px-4 py-3 flex items-center justify-between safe-area-inset-top">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <h1 className="text-lg font-semibold">{t('cart.title')}</h1>

        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearCart}
            className="text-destructive"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        )}
        {items.length === 0 && <div className="w-10" />}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t('cart.empty')}</h2>
            <p className="text-muted-foreground mb-6">
              {t('cart.emptyDescription') || 'Add items from the menu to get started'}
            </p>
            <Button onClick={() => navigate('/menu')}>
              {t('menu.browseMenu') || 'Browse Menu'}
            </Button>
          </div>
        ) : (
          <div className="px-4 py-4 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-card rounded-lg border p-4 shadow-sm"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold ml-4">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted disabled:opacity-50"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <span className="w-8 text-center font-medium">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="h-8 w-8 rounded-full border flex items-center justify-center hover:bg-muted"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(item.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground mt-2">
                  ${item.price.toFixed(2)} each
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer - Total and Checkout */}
      {items.length > 0 && (
        <div className="bg-card border-t p-4 safe-area-inset-bottom space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t('cart.items', { count: items.length })}
              </span>
              <span>{items.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('cart.subtotal')}</span>
              <span>${total.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold text-lg">
              <span>{t('cart.total')}</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={handleCheckout}>
            {t('cart.checkout')}
          </Button>
        </div>
      )}
    </div>
  )
}
