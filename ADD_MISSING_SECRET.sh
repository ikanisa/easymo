#!/bin/bash
# Script to add the missing WA_ALLOW_INTERNAL_FORWARD secret

echo "Adding WA_ALLOW_INTERNAL_FORWARD secret..."
supabase secrets set WA_ALLOW_INTERNAL_FORWARD=true

echo ""
echo "✅ Secret added successfully!"
echo ""
echo "To verify, run:"
echo "  supabase secrets list | grep WA_ALLOW_INTERNAL_FORWARD"
