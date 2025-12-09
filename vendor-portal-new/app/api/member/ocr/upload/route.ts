import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("document");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing document" }, { status: 400 });
  }

  // In production this endpoint would upload to storage and invoke OCR.
  // For now we return a mocked response so the onboarding flow remains functional.
  const ocr = {
    name: null as string | null,
    idNumber: null as string | null,
    dob: null as string | null,
    sex: null as string | null,
    address: null as string | null,
  };

  const guessedId = file.name.split(".")[0];
  if (guessedId) {
    ocr.idNumber = guessedId;
  }

  return NextResponse.json({
    ocr,
    uploaded: { name: file.name, size: file.size },
  });
}
