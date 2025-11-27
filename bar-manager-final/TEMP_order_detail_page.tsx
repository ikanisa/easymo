"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Order, OrderItem } from "@/lib/types"

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notes, setNotes] = useState("")
  const supabase = createClient()
  const orderId = params.id as string

  useEffect(() => {
    async function loadOrder() {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (*)
        `)
        .eq("id", orderId)
        .single()

      if (data) {
        setOrder(data as any)
        setNotes(data.metadata?.notes || "")
      }
      setIsLoading(false)
    }

    loadOrder()
  }, [orderId, supabase])

  const updateOrderStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ 
        status: newStatus, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", orderId)

    if (!error && order) {
      setOrder({ ...order, status: newStatus })
    }
  }

  const updateItemStatus = async (itemId: string, newStatus: string) => {
    const { error } = await supabase
      .from("order_items")
      .update({ status: newStatus })
      .eq("id", itemId)

    if (!error && order) {
      setOrder({
        ...order,
        order_items: order.order_items?.map((item) =>
          item.id === itemId ? { ...item, status: newStatus } : item
        ),
      })
    }
  }

  const saveNotes = async () => {
    const { error } = await supabase
      .from("orders")
      .update({ 
        metadata: { ...order?.metadata, notes },
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId)

    if (!error) {
      alert("Notes saved!")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading order...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Order not found</p>
          <button
            onClick={() => router.push("/orders")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const STATUS_COLORS = {
    pending: "bg-yellow-100 text-yellow-800",
    preparing: "bg-blue-100 text-blue-800",
    confirmed: "bg-green-100 text-green-800",
    served: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.push("/orders")}
            className="text-blue-600 hover:underline mb-2"
          >
            ← Back to Orders
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Order #{order.order_code}
              </h1>
              <p className="text-gray-600">
                {new Date(order.created_at).toLocaleString()}
              </p>
            </div>
            <span
              className={`px-4 py-2 rounded-full font-medium ${
                STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] ||
                "bg-gray-100 text-gray-800"
              }`}
            >
              {order.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">Order Items</h2>
              <div className="space-y-3">
                {order.order_items?.map((item: OrderItem) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {item.qty}× {item.item_name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {((item.price_minor || 0) / 100).toLocaleString()} RWF each
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          item.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : item.status === "preparing"
                            ? "bg-blue-100 text-blue-700"
                            : item.status === "ready"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {item.status}
                      </span>
                      <select
                        value={item.status}
                        onChange={(e) => updateItemStatus(item.id, e.target.value)}
                        className="px-3 py-1 border rounded text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="served">Served</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t mt-6 pt-4 flex justify-between items-center">
                <span className="text-lg font-medium">Total</span>
                <span className="text-2xl font-bold text-blue-600">
                  {((order.total_minor || 0) / 100).toLocaleString()} RWF
                </span>
              </div>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">Order Notes</h2>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this order..."
                className="w-full px-4 py-3 border rounded-lg resize-none"
                rows={4}
              />
              <button
                onClick={saveNotes}
                className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Notes
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">Order Info</h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-600">Table</dt>
                  <dd className="text-lg font-medium">{order.table_label}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Items</dt>
                  <dd className="text-lg font-medium">{order.order_items?.length || 0}</dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Created</dt>
                  <dd className="text-sm">{new Date(order.created_at).toLocaleString()}</dd>
                </div>
                {order.updated_at !== order.created_at && (
                  <div>
                    <dt className="text-sm text-gray-600">Last Updated</dt>
                    <dd className="text-sm">{new Date(order.updated_at).toLocaleString()}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {order.status === "pending" && (
                  <button
                    onClick={() => updateOrderStatus("preparing")}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Start Preparing
                  </button>
                )}
                {order.status === "preparing" && (
                  <button
                    onClick={() => updateOrderStatus("confirmed")}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Mark as Ready
                  </button>
                )}
                {order.status === "confirmed" && (
                  <button
                    onClick={() => updateOrderStatus("served")}
                    className="w-full px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Mark as Served
                  </button>
                )}
                {order.status !== "cancelled" && order.status !== "served" && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to cancel this order?")) {
                        updateOrderStatus("cancelled")
                      }
                    }}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Cancel Order
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Print Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
