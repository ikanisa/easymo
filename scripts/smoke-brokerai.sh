#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

echo "OpenAPI head:"
curl -sS "${BASE_URL}/openapi.yaml" | head -n 120 || true
echo "---"

echo "Insurance OCR (expect 200 from route handler):"
curl -sS -i -X POST "${BASE_URL}/api/insurance/ocr" \
  -H 'Content-Type: application/json' \
  -d '{"document_ids":["00000000-0000-0000-0000-000000000000"]}' || true
echo "---"

echo "Mobility match (expect 200 from route handler):"
curl -sS -i -X POST "${BASE_URL}/api/mobility/match" \
  -H 'Content-Type: application/json' \
  -d '{"ride_id":"00000000-0000-0000-0000-000000000000","vehicle_type":"moto","pickup":{"lat":-1.95,"lng":30.06}}' || true
echo "---"

echo "Done."

