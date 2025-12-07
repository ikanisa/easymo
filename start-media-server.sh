#!/bin/bash
# Start WhatsApp Voice Call Media Server

set -e

echo "🚀 Starting EasyMO Voice Call Media Server..."

# Navigate to services directory
cd "$(dirname "$0")/services/voice-media-server"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Build and start the media server
echo "📦 Building media server container..."
docker-compose up --build -d

echo "✅ Media server started successfully!"
echo ""
echo "🔗 Endpoints:"
echo "   - WebRTC Bridge: http://localhost:8080"
echo "   - Health Check: http://localhost:8080/health"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop:"
echo "   docker-compose down"
