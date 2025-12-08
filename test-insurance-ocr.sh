#!/bin/bash
# Test Insurance OCR via unified-ocr
# Usage: ./test-insurance-ocr.sh <image-url>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <image-url>"
  echo "Example: $0 https://example.com/insurance-cert.jpg"
  exit 1
fi

IMAGE_URL="$1"

echo "🧪 Testing unified-ocr with insurance domain..."
echo "Image: $IMAGE_URL"
echo ""

# Call unified-ocr edge function
curl -X POST "https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/unified-ocr" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"domain\": \"insurance\",
    \"inline\": {
      \"signedUrl\": \"$IMAGE_URL\",
      \"mime\": \"image/jpeg\"
    }
  }" | jq '.'

echo ""
echo "✅ Test complete. Check response above for OCR results."
