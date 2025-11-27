"use client"

import { useState } from "react"
import type { Order } from "@/lib/types"

interface OrderCardProps {
  order: Order
  onStatusChange: (orderId: string, status: string) => Promise<void>
}

const STATUS_FLOW = {
  pending: { next: "preparing", label: "Start Preparing", color: "bg-yellow-500" },
  preparing: { next: "confirmed", label: "Mark Ready", color: "bg-blue-500" },
  confirmed: { next: "served", label: "Mark Served", color: "bg-green-500" },
}

export function OrderCard({ order, onStatusChange }: OrderCardProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const statusConfig = STATUS_FLOW[order.status as keyof typeof STATUS_FLOW]

  const handleStatusUpdate = async () => {
    if (!statusConfig) return
    setIsUpdating(true)
    await onStatusChange(order.id, statusConfig.next)
    setIsUpdating(false)
  }

  const timeSinceOrder = getTimeSince(order.created_at)

  return (
    <div className={`
      rounded-xl border-2 p-4 shadow-lg transition-all
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
          <p className="text-xs text-gray-500 mt-1">{timeSinceOrder}</p>
        </div>
      </div>

      <ul className="space-y-2 mb-4">
        {order.order_items?.map((item: any) => (
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
