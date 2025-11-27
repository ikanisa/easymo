"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"

interface FileDropzoneProps {
  onFilesAccepted: (files: File[]) => void
  accept?: Record<string, string[]>
  maxFiles?: number
  maxSize?: number
  isProcessing?: boolean
}

const ACCEPTED_FILE_TYPES = {
  "image/*": [".jpg", ".jpeg", ".png", ".webp", ".heic"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
}

export function FileDropzone({
  onFilesAccepted,
  accept = ACCEPTED_FILE_TYPES,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024,
  isProcessing = false,
}: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesAccepted(acceptedFiles)
    },
    [onFilesAccepted]
  )

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept,
      maxFiles,
      maxSize,
      disabled: isProcessing,
    })

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
        transition-all duration-200
        ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
        ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <input {...getInputProps()} />

      <div className="space-y-4">
        <div className="flex justify-center gap-4 text-4xl">
          <span>📷</span>
          <span>📄</span>
          <span>📊</span>
        </div>

        {isDragActive ? (
          <p className="text-lg font-medium text-blue-600">
            Drop your menu files here...
          </p>
        ) : (
          <>
            <p className="text-lg font-medium text-gray-700">
              Drag & drop your menu files here
            </p>
            <p className="text-sm text-gray-500">
              or click to browse
            </p>
          </>
        )}

        <div className="flex justify-center gap-2 text-xs text-gray-400">
          <span className="px-2 py-1 bg-gray-100 rounded">Images</span>
          <span className="px-2 py-1 bg-gray-100 rounded">PDF</span>
          <span className="px-2 py-1 bg-gray-100 rounded">Excel</span>
          <span className="px-2 py-1 bg-gray-100 rounded">CSV</span>
        </div>

        {isProcessing && (
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
            <span>Processing with AI...</span>
          </div>
        )}

        {fileRejections.length > 0 && (
          <div className="text-red-500 text-sm">
            {fileRejections.map(({ file, errors }) => (
              <div key={file.name}>
                {file.name}: {errors.map((e) => e.message).join(", ")}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
