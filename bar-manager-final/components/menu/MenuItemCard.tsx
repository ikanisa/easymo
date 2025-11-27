"use client"

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  is_available: boolean
  image_url: string | null
}

interface MenuItemCardProps {
  item: MenuItem
  onToggleAvailability: (itemId: string, isAvailable: boolean) => Promise<void>
  onDelete: (itemId: string) => Promise<void>
  onEdit?: (itemId: string) => void
}

export function MenuItemCard({ item, onToggleAvailability, onDelete, onEdit }: MenuItemCardProps) {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden hover:shadow-md transition">
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-48 object-cover"
        />
      )}
      
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-bold">{item.name}</h3>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            item.is_available 
              ? "bg-green-100 text-green-700" 
              : "bg-red-100 text-red-700"
          }`}>
            {item.is_available ? "Available" : "Unavailable"}
          </span>
        </div>

        {item.description && (
          <p className="text-sm text-gray-600 mb-3">{item.description}</p>
        )}

        <p className="text-xl font-bold text-gray-900 mb-4">
          {item.price.toLocaleString()} RWF
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => onToggleAvailability(item.id, item.is_available)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${
              item.is_available
                ? "bg-red-50 text-red-700 hover:bg-red-100"
                : "bg-green-50 text-green-700 hover:bg-green-100"
            }`}
          >
            {item.is_available ? "Mark Unavailable" : "Mark Available"}
          </button>

          {onEdit && (
            <button
              onClick={() => onEdit(item.id)}
              className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100"
            >
              Edit
            </button>
          )}

          <button
            onClick={() => {
              if (confirm(`Delete "${item.name}"?`)) {
                onDelete(item.id)
              }
            }}
            className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
