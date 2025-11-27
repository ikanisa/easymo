"use client"

import { useState } from "react"

export interface PromoFormData {
  name: string
  description: string
  promo_type: "percentage" | "fixed_amount" | "buy_x_get_y" | "happy_hour"
  discount_value: number
  buy_quantity?: number
  get_quantity?: number
  applies_to: "all" | "category" | "items"
  category?: string
  start_time?: string
  end_time?: string
  days_of_week: number[]
  valid_from: string
  valid_until: string
}

interface PromoFormProps {
  onSubmit: (data: PromoFormData) => Promise<void>
  categories: string[]
  initialData?: Partial<PromoFormData>
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
]

export function PromoForm({ onSubmit, categories, initialData }: PromoFormProps) {
  const [form, setForm] = useState<PromoFormData>({
    name: "",
    description: "",
    promo_type: "percentage",
    discount_value: 0,
    applies_to: "all",
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    valid_from: new Date().toISOString().split("T")[0],
    valid_until: "",
    ...initialData,
  })

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    await onSubmit(form)
    setIsSubmitting(false)
  }

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...prev.days_of_week, day],
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Promo Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Happy Hour"
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g., 20% off all cocktails"
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Promo Type *</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { value: "percentage", label: "% Discount" },
            { value: "fixed_amount", label: "Fixed Amount" },
            { value: "buy_x_get_y", label: "Buy X Get Y" },
            { value: "happy_hour", label: "Happy Hour" },
          ].map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setForm({ ...form, promo_type: type.value as any })}
              className={`px-4 py-3 rounded-lg border text-center ${
                form.promo_type === type.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "hover:bg-gray-50"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {(form.promo_type === "percentage" || form.promo_type === "fixed_amount") && (
        <div>
          <label className="block text-sm font-medium mb-1">
            Discount {form.promo_type === "percentage" ? "(%)" : "(RWF)"}
          </label>
          <input
            type="number"
            value={form.discount_value}
            onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
            className="w-32 px-4 py-2 border rounded-lg"
            min={0}
            max={form.promo_type === "percentage" ? 100 : undefined}
          />
        </div>
      )}

      {form.promo_type === "happy_hour" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              value={form.start_time || "16:00"}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Time</label>
            <input
              type="time"
              value={form.end_time || "19:00"}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Applies To</label>
        <div className="flex gap-2">
          {[
            { value: "all", label: "All Items" },
            { value: "category", label: "Category" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm({ ...form, applies_to: opt.value as any })}
              className={`px-4 py-2 rounded-lg border ${
                form.applies_to === opt.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {form.applies_to === "category" && (
          <select
            value={form.category || ""}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-2 w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Active Days</label>
        <div className="flex gap-2">
          {DAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => toggleDay(day.value)}
              className={`w-12 h-12 rounded-full border ${
                form.days_of_week.includes(day.value)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "hover:bg-gray-50"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Valid From</label>
          <input
            type="date"
            value={form.valid_from}
            onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Valid Until</label>
          <input
            type="date"
            value={form.valid_until}
            onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
      >
        {isSubmitting ? "Saving..." : "Save Promo"}
      </button>
    </form>
  )
}
