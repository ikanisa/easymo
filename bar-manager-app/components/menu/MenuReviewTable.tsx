"use client"

import { useState } from "react"
import type { ExtractedMenuItem } from "@/lib/gemini/menu-parser"

interface MenuReviewTableProps {
  items: ExtractedMenuItem[]
  selectedItems: Set<number>
  onToggle: (index: number) => void
  onEdit: (index: number, updates: Partial<ExtractedMenuItem>) => void
  onDelete: (index: number) => void
}

export function MenuReviewTable({
  items,
  selectedItems,
  onToggle,
  onEdit,
  onDelete,
}: MenuReviewTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<ExtractedMenuItem>>({})

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setEditForm(items[index])
  }

  const saveEdit = () => {
    if (editingIndex !== null) {
      onEdit(editingIndex, editForm)
      setEditingIndex(null)
      setEditForm({})
    }
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setEditForm({})
  }

  const groupedItems = items.reduce((acc, item, index) => {
    const category = item.category || "Uncategorized"
    if (!acc[category]) acc[category] = []
    acc[category].push({ ...item, originalIndex: index })
    return acc
  }, {} as Record<string, (ExtractedMenuItem & { originalIndex: number })[]>)

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <div key={category}>
          <div className="px-4 py-2 bg-gray-100 border-b font-medium text-gray-700">
            {category} ({categoryItems.length} items)
          </div>

          <table className="w-full">
            <tbody>
              {categoryItems.map((item) => {
                const isSelected = selectedItems.has(item.originalIndex)
                const isEditing = editingIndex === item.originalIndex

                return (
                  <tr
                    key={item.originalIndex}
                    className={`border-b hover:bg-gray-50 ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(item.originalIndex)}
                        className="w-5 h-5 text-blue-600 rounded"
                      />
                    </td>

                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="w-full px-2 py-1 border rounded"
                        />
                      ) : (
                        <span className="font-medium">{item.name}</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.description || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, description: e.target.value })
                          }
                          className="w-full px-2 py-1 border rounded"
                          placeholder="Description"
                        />
                      ) : (
                        item.description || "-"
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.price || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, price: Number(e.target.value) })
                          }
                          className="w-24 px-2 py-1 border rounded text-right"
                        />
                      ) : (
                        <span className={item.price ? "" : "text-red-500"}>
                          {item.price ? `${item.price.toLocaleString()} ${item.currency}` : "No price"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          item.confidence >= 0.9
                            ? "bg-green-100 text-green-700"
                            : item.confidence >= 0.7
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={saveEdit}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1 border rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => startEdit(item.originalIndex)}
                            className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDelete(item.originalIndex)}
                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
