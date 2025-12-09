"use client"

import { useState } from "react"
import { FileDropzone } from "@/components/ui/FileDropzone"
import { MenuReviewTable } from "@/components/menu/MenuReviewTable"
import { createClient } from "@/lib/supabase/client"
import type { ExtractedMenuItem } from "@/lib/gemini/menu-parser"

type UploadStatus = "idle" | "uploading" | "parsing" | "review" | "saving" | "complete" | "error"

export default function MenuUploadPage() {
  const [status, setStatus] = useState<UploadStatus>("idle")
  const [progress, setProgress] = useState(0)
  const [extractedItems, setExtractedItems] = useState<ExtractedMenuItem[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [processingTime, setProcessingTime] = useState<number>(0)
  
  const supabase = createClient()
  const barId = typeof window !== "undefined" ? localStorage.getItem("bar_id") : null

  const handleFilesAccepted = async (files: File[]) => {
    setStatus("uploading")
    setProgress(10)
    setError(null)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setProgress(20 + (i / files.length) * 30)

        const base64 = await fileToBase64(file)
        
        setStatus("parsing")
        setProgress(50 + (i / files.length) * 30)

        const response = await fetch("/api/menu/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: base64,
            mimeType: file.type,
            fileName: file.name,
            barId,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to parse menu")
        }

        const result = await response.json()
        
        if (result.success) {
          setExtractedItems((prev) => [...prev, ...result.items])
          setProcessingTime(result.processingTimeMs)
          
          const newSelected = new Set<number>()
          result.items.forEach((_: any, idx: number) => {
            newSelected.add(extractedItems.length + idx)
          })
          setSelectedItems((prev) => new Set([...prev, ...newSelected]))
        } else {
          throw new Error(result.error || "Parsing failed")
        }
      }

      setStatus("review")
      setProgress(100)
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Unknown error")
    }
  }

  const handleSaveSelected = async () => {
    setStatus("saving")
    setProgress(0)

    try {
      const itemsToSave = extractedItems.filter((_, idx) => selectedItems.has(idx))
      
      const { error: insertError } = await supabase
        .from("restaurant_menu_items")
        .insert(
          itemsToSave.map((item) => ({
            bar_id: barId,
            name: item.name,
            category: item.category,
            description: item.description,
            price: item.price || 0,
            currency: item.currency || "RWF",
            is_available: item.is_available,
            ocr_extracted: true,
            ocr_confidence: item.confidence,
          }))
        )

      if (insertError) throw insertError

      setStatus("complete")
      setProgress(100)

      setTimeout(() => {
        window.location.href = "/menu"
      }, 2000)
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Failed to save menu items")
    }
  }

  const handleItemToggle = (index: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleItemEdit = (index: number, updates: Partial<ExtractedMenuItem>) => {
    setExtractedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    )
  }

  const handleItemDelete = (index: number) => {
    setExtractedItems((prev) => prev.filter((_, i) => i !== index))
    setSelectedItems((prev) => {
      const next = new Set(prev)
      next.delete(index)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🤖 AI Menu Upload</h1>
          <p className="text-gray-600">
            Upload images, PDFs, or spreadsheets - our AI will extract menu items
          </p>
        </div>

        {status === "complete" && (
          <div className="mb-6 p-4 bg-green-100 border border-green-300 rounded-lg text-green-800">
            ✅ {selectedItems.size} menu items saved successfully! Redirecting...
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">
            ❌ {error}
          </div>
        )}

        {(status === "idle" || status === "error") && (
          <FileDropzone
            onFilesAccepted={handleFilesAccepted}
            isProcessing={false}
          />
        )}

        {(status === "uploading" || status === "parsing") && (
          <div className="p-8 bg-white rounded-xl border shadow-sm">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full" />
              <p className="text-lg font-medium">
                {status === "uploading" ? "Uploading files..." : "🤖 AI is extracting menu items..."}
              </p>
              <div className="w-full max-w-md bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{progress}% complete</p>
            </div>
          </div>
        )}

        {status === "review" && extractedItems.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div>
                <p className="text-lg font-medium text-blue-900">
                  {extractedItems.length} items extracted
                </p>
                <p className="text-sm text-blue-700">
                  Processed in {(processingTime / 1000).toFixed(1)}s
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedItems(new Set(extractedItems.map((_, i) => i)))}
                  className="px-4 py-2 text-blue-700 hover:bg-blue-100 rounded-lg"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedItems(new Set())}
                  className="px-4 py-2 text-blue-700 hover:bg-blue-100 rounded-lg"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <MenuReviewTable
              items={extractedItems}
              selectedItems={selectedItems}
              onToggle={handleItemToggle}
              onEdit={handleItemEdit}
              onDelete={handleItemDelete}
            />

            <div className="flex justify-between">
              <button
                onClick={() => {
                  setStatus("idle")
                  setExtractedItems([])
                  setSelectedItems(new Set())
                }}
                className="px-6 py-3 text-gray-700 border rounded-lg hover:bg-gray-100"
              >
                ← Upload More
              </button>
              <button
                onClick={handleSaveSelected}
                disabled={selectedItems.size === 0}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
              >
                Save {selectedItems.size} Items →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1]
      resolve(base64)
    }
    reader.onerror = reject
  })
}
