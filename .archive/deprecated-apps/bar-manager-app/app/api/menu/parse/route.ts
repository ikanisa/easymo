import { NextRequest, NextResponse } from 'next/server'
import { parseMenuFromImage, parseMenuFromPDF, parseMenuFromText } from '@/lib/gemini/menu-parser'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { file, mimeType, fileName, barId } = body

    if (!file || !mimeType) {
      return NextResponse.json(
        { success: false, error: "Missing file or mimeType" },
        { status: 400 }
      )
    }

    let result

    if (mimeType.startsWith('image/')) {
      result = await parseMenuFromImage(file, mimeType)
    } else if (mimeType === 'application/pdf') {
      result = await parseMenuFromPDF(file)
    } else if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      const textContent = Buffer.from(file, 'base64').toString('utf-8')
      result = await parseMenuFromText(textContent)
    } else {
      return NextResponse.json(
        { success: false, error: `Unsupported file type: ${mimeType}` },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Menu parsing error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        items: [],
        processingTimeMs: 0,
      },
      { status: 500 }
    )
  }
}
