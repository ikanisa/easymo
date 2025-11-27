"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import type { Order } from "@/lib/types"

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const barId = typeof window !== 'undefined' ? localStorage.getItem("bar_id") : null

  useEffect(() => {
    if (!barId) return

    async function loadOrders() {
      let query = supabase
        .from("orders")
        .select(`
          *,
          order_items (*)
        `)
        .eq("bar_id", barId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (filter !== "all") {
        query = query.eq("status", filter)
      }

      const { data, error } = await query

      if (data) {
        setOrders(data as any)
      }
      setIsLoading(false)
    }

    loadOrders()
  }, [barId, filter, supabase])

  const statusCounts = {
    all: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    preparing: orders.filter(o => o.status === "preparing").length,
    confirmed: orders.filter(o => o.status === "confirmed").length,
    served: orders.filter(o => o.status === "served").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">All Orders</h1>
          <p className="text-gray-600">View and manage order history</p>
        </header>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-full whitespace-nowrap ${
                filter === status
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border hover:bg-gray-50"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Order</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Table</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Items</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Time</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50 cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${order.id}`} className="font-medium text-blue-600 hover:underline">
                        #{order.order_code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{order.table_label}</td>
                    <td className="px-4 py-3">{order.order_items?.length || 0}</td>
                    <td className="px-4 py-3 font-medium">
                      {(order.total_minor / 100).toLocaleString()} RWF
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        order.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                        order.status === "preparing" ? "bg-blue-100 text-blue-700" :
                        order.status === "confirmed" ? "bg-green-100 text-green-700" :
                        order.status === "served" ? "bg-gray-100 text-gray-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {orders.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No orders found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
