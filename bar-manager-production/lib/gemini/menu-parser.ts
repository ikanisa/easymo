import { geminiVision } from "./client"
import { MENU_EXTRACTION_PROMPT } from "./prompts"

export interface ExtractedMenuItem {
  name: string
  category: string
  description: string | null
  price: number | null
  currency: string
  size: string | null
  alcohol_percentage: string | null
  is_available: boolean
  confidence: number
}

export interface MenuParseResult {
  success: boolean
  items: ExtractedMenuItem[]
  rawText?: string
  processingTimeMs: number
  error?: string
}

export async function parseMenuFromImage(
  imageBase64: string,
  mimeType: string
): Promise<MenuParseResult> {
  const startTime = Date.now()

  try {
    const result = await geminiVision.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      },
      { text: MENU_EXTRACTION_PROMPT },
    ])

    const responseText = result.response.text()
    
    let jsonStr = responseText.trim()
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "")
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "")
    }

    const items = JSON.parse(jsonStr) as ExtractedMenuItem[]

    return {
      success: true,
      items,
      rawText: responseText,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      items: [],
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function parseMenuFromPDF(
  pdfBase64: string
): Promise<MenuParseResult> {
  const startTime = Date.now()

  try {
    const result = await geminiVision.generateContent([
      {
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBase64,
        },
      },
      { text: MENU_EXTRACTION_PROMPT },
    ])

    const responseText = result.response.text()
    
    let jsonStr = responseText.trim()
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "")
    }

    const items = JSON.parse(jsonStr) as ExtractedMenuItem[]

    return {
      success: true,
      items,
      rawText: responseText,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      items: [],
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function parseMenuFromText(
  text: string
): Promise<MenuParseResult> {
  const startTime = Date.now()

  try {
    const result = await geminiVision.generateContent([
      { text: `${MENU_EXTRACTION_PROMPT}\n\nMENU TEXT:\n${text}` },
    ])

    const responseText = result.response.text()
    
    let jsonStr = responseText.trim()
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "")
    }

    const items = JSON.parse(jsonStr) as ExtractedMenuItem[]

    return {
      success: true,
      items,
      rawText: responseText,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    return {
      success: false,
      items: [],
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
