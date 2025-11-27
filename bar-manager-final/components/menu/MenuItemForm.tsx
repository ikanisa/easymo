"use client"

import { useState } from "react"

export interface MenuItemFormData {
  name: string
  description: string
  price: number
  category: string
  is_available: boolean
  image_url?: string
}

interface MenuItemFormProps {
  onSubmit: (data: MenuItemFormData) => Promise<void>
  initialData?: Partial<MenuItemFormData>
  categories: string[]
}

export function MenuItemForm({ onSubmit, initialData, categories }: MenuItemFormProps) {
  const [form, setForm] = useState<MenuItemFormData>({
    name: "",
    description: "",
    price: 0,
    category: categories[0] || "",
    is_available: true,
    ...initialData,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    await onSubmit(form)
    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Item Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Mojito"
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
            required
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="e.g., Fresh mint, lime, white rum, soda"
          className="w-full px-4 py-2 border rounded-lg"
          rows={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Price (RWF) *</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            placeholder="5000"
            className="w-full px-4 py-2 border rounded-lg"
            min={0}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Image URL</label>
          <input
            type="url"
            value={form.image_url || ""}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="https://..."
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_available"
          checked={form.is_available}
          onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
          className="w-5 h-5 text-blue-600 rounded"
        />
        <label htmlFor="is_available" className="text-sm font-medium">
          Available for ordering
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
      >
        {isSubmitting ? "Saving..." : "Save Menu Item"}
      </button>
    </form>
  )
}
