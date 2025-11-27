"use client"

import { OrderCard } from "./OrderCard"
import type { Order } from "@/lib/types"

interface OrderQueueProps {
  orders: Order[]
  onStatusChange: (orderId: string, status: string) => Promise<void>
}

export function OrderQueue({ orders, onStatusChange }: OrderQueueProps) {
  const pendingOrders = orders.filter(o => o.status === "pending")
  const preparingOrders = orders.filter(o => o.status === "preparing")
  const confirmedOrders = orders.filter(o => o.status === "confirmed")

  return (
    <div className="space-y-6">
      {pendingOrders.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 text-yellow-700">
            Pending ({pendingOrders.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </section>
      )}

      {preparingOrders.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 text-blue-700">
            Preparing ({preparingOrders.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {preparingOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </section>
      )}

      {confirmedOrders.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 text-green-700">
            Ready for Pickup ({confirmedOrders.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {confirmedOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusChange={onStatusChange}
              />
            ))}
          </div>
        </section>
      )}

      {orders.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No active orders</p>
        </div>
      )}
    </div>
  )
}
