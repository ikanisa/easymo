"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { playNotificationSound, showDesktopNotification, requestNotificationPermission } from "@/lib/notifications"
import type { Order } from "@/lib/types"

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const barId = typeof window !== 'undefined' ? localStorage.getItem("bar_id") : null

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  useEffect(() => {
    if (!barId) return

    async function loadOrders() {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (*)
        `)
        .eq("bar_id", barId)
        .in("status", ["pending", "preparing", "confirmed"])
        .order("created_at", { ascending: true })

      if (data) {
        setOrders(data as any)
      }
      setIsLoading(false)
    }

    loadOrders()
  }, [barId, supabase])

  useEffect(() => {
    if (!barId) return

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `bar_id=eq.${barId}`,
        },
        (payload) => {
          setOrders((prev) => [...prev, payload.new as Order])
          playNotificationSound()
          showDesktopNotification("New Order!", `Order #${payload.new.order_code}`)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `bar_id=eq.${barId}`,
        },
        (payload) => {
          setOrders((prev) =>
            prev.map((order) =>
              order.id === payload.new.id ? { ...order, ...payload.new } : order
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [barId, supabase])

  async function updateOrderStatus(orderId: string, newStatus: string) {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId)

    if (error) {
      console.error("Failed to update order:", error)
    }
  }

  const pendingCount = orders.filter((o) => o.status === "pending").length
  const preparingCount = orders.filter((o) => o.status === "preparing").length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Kitchen Queue</h1>
        <div className="flex gap-4 mt-2">
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
            {pendingCount} Pending
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {preparingCount} Preparing
          </span>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-gray-500 text-lg">No active orders</p>
          <p className="text-gray-400 text-sm mt-2">Orders will appear here when customers place them via WhatsApp</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onStatusChange={updateOrderStatus} />
          ))}
        </div>
      )}
    </div>
  )
}

function OrderCard({ order, onStatusChange }: { order: Order; onStatusChange: (id: string, status: string) => Promise<void> }) {
  const [isUpdating, setIsUpdating] = useState(false)

  const STATUS_FLOW = {
    pending: { next: "preparing", label: "Start Preparing", color: "bg-yellow-500" },
    preparing: { next: "confirmed", label: "Mark Ready", color: "bg-blue-500" },
    confirmed: { next: "served", label: "Mark Served", color: "bg-green-500" },
  }

  const statusConfig = STATUS_FLOW[order.status as keyof typeof STATUS_FLOW]

  const handleStatusUpdate = async () => {
    if (!statusConfig) return
    setIsUpdating(true)
    await onStatusChange(order.id, statusConfig.next)
    setIsUpdating(false)
  }

  const timeSince = getTimeSince(order.created_at)

  return (
    <div className={`
      rounded-xl border-2 p-4 shadow-lg
      ${order.status === "pending" ? "border-yellow-400 bg-yellow-50" : ""}
      ${order.status === "preparing" ? "border-blue-400 bg-blue-50" : ""}
      ${order.status === "confirmed" ? "border-green-400 bg-green-50" : ""}
    `}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xl font-bold">#{order.order_code}</h3>
          <p className="text-sm text-gray-600">Table {order.table_label}</p>
        </div>
        <div className="text-right">
          <span className={`
            px-3 py-1 rounded-full text-white text-sm font-medium
            ${statusConfig?.color || "bg-gray-500"}
          `}>
            {order.status.toUpperCase()}
          </span>
          <p className="text-xs text-gray-500 mt-1">{timeSince}</p>
        </div>
      </div>

      <ul className="space-y-2 mb-4">
        {order.items?.map((item) => (
          <li key={item.id} className="flex justify-between text-sm">
            <span className="font-medium">
              {item.qty}× {item.item_name}
            </span>
            <span className="text-gray-500">{item.status}</span>
          </li>
        ))}
      </ul>

      <div className="border-t pt-2 mb-3">
        <p className="text-lg font-bold text-right">
          {formatPrice(order.total_minor)} RWF
        </p>
      </div>

      {statusConfig && (
        <button
          onClick={handleStatusUpdate}
          disabled={isUpdating}
          className={`
            w-full py-3 rounded-lg text-white font-bold text-lg
            ${statusConfig.color} hover:opacity-90 transition
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isUpdating ? "Updating..." : statusConfig.label}
        </button>
      )}

      <button
        onClick={() => onStatusChange(order.id, "cancelled")}
        className="w-full mt-2 py-2 text-red-600 text-sm hover:underline"
      >
        Cancel Order
      </button>
    </div>
  )
}

function getTimeSince(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

function formatPrice(minor: number): string {
  return (minor / 100).toLocaleString()
}
