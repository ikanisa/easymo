#!/bin/bash

# Cleanup duplicate Fly.io apps
# Keep only: whatsapp-voice-bridge-dark-dew-6515

echo "🧹 Cleaning up duplicate Fly.io apps..."
echo ""

apps=(
  "whatsapp-voice-bridge-snowy-pond-1543"
  "whatsapp-voice-bridge-morning-surf-3945"
  "whatsapp-voice-bridge-cool-leaf-8892"
  "whatsapp-voice-bridge-twilight-sunset-7950"
  "whatsapp-voice-bridge-cool-shadow-5075"
  "whatsapp-voice-bridge-long-haze-5011"
  "whatsapp-voice-bridge"
)

for app in "${apps[@]}"; do
  echo "Deleting: $app"
  flyctl apps destroy "$app" --yes
  if [ $? -eq 0 ]; then
    echo "✅ Deleted: $app"
  else
    echo "❌ Failed to delete: $app"
  fi
  echo ""
done

echo "✅ Cleanup complete!"
echo ""
echo "Remaining apps:"
flyctl apps list | grep whatsapp-voice-bridge
