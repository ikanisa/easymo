#!/bin/bash

# Fly.io Voice Bridge Cleanup Script
# Deletes duplicate apps, keeps only whatsapp-voice-bridge-dark-dew-6515

echo "🧹 Cleaning up duplicate Fly.io apps..."
echo ""

# Apps to delete
APPS_TO_DELETE=(
  "whatsapp-voice-bridge-snowy-pond-1543"
  "whatsapp-voice-bridge-morning-surf-3945"
  "whatsapp-voice-bridge-cool-leaf-8892"
  "whatsapp-voice-bridge-twilight-sunset-7950"
  "whatsapp-voice-bridge-cool-shadow-5075"
  "whatsapp-voice-bridge-long-haze-5011"
  "whatsapp-voice-bridge"
)

# Keep this app
KEEP_APP="whatsapp-voice-bridge-dark-dew-6515"

echo "Apps to delete: ${#APPS_TO_DELETE[@]}"
echo "Keeping: $KEEP_APP"
echo ""

# Delete each app
for app in "${APPS_TO_DELETE[@]}"; do
  echo "Deleting: $app"
  fly apps destroy "$app" --yes
  if [ $? -eq 0 ]; then
    echo "✅ Deleted: $app"
  else
    echo "❌ Failed to delete: $app"
  fi
  echo ""
done

echo "🎉 Cleanup complete!"
echo ""
echo "Verifying remaining apps:"
fly apps list | grep voice-bridge
