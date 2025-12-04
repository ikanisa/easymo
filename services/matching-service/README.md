# Matching Service

Production-grade spatial matching service for EasyMO mobility platform.

## Responsibility

Find nearby trip candidates using PostGIS spatial queries.

**Does**:
- ✅ Spatial search (drivers/passengers within radius)
- ✅ Filter by vehicle type
- ✅ Filter by location freshness (default: 30 min)
- ✅ Return raw candidates sorted by distance

**Does NOT**:
- ❌ Rank or score candidates (use `ranking-service`)
- ❌ Create matches (use `mobility-orchestrator`)
- ❌ Handle payments (use `payment-service`)

## API

### POST /matches

Find candidate matches for a trip.

**Request**:
```json
{
  "tripId": "uuid",
  "role": "driver" | "passenger",
  "vehicleType": "moto" | "cab" | "lifan" | "truck",
  "radiusKm": 15,
  "limit": 20
}
```

**Response**:
```json
{
  "success": true,
  "candidates": [
    {
      "trip_id": "uuid",
      "user_id": "uuid",
      "role": "driver",
      "vehicle_type": "moto",
      "pickup_lat": -1.95,
      "pickup_lng": 30.06,
      "distance_km": 2.5,
      "location_age_minutes": 5,
      "created_at": "2025-12-04T18:00:00Z"
    }
  ],
  "count": 1,
  "params": {
    "tripId": "uuid",
    "role": "passenger",
    "radiusKm": 15,
    "limit": 20
  }
}
```

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "service": "matching-service",
  "version": "1.0.0",
  "timestamp": "2025-12-04T18:00:00Z"
}
```

## Environment Variables

```bash
PORT=4700
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key

MATCHING_DEFAULT_RADIUS_KM=15
MATCHING_MAX_RADIUS_KM=50
MATCHING_DEFAULT_LIMIT=20
MATCHING_LOCATION_FRESHNESS_MINUTES=30

LOG_LEVEL=info
```

## Development

```bash
# Install dependencies
pnpm install

# Run in dev mode
pnpm start:dev

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint
```

## Deployment

```bash
# Docker
docker build -t matching-service:latest .
docker run -p 4700:4700 --env-file .env matching-service:latest

# Kubernetes (see k8s/matching-service.yaml)
kubectl apply -f k8s/matching-service.yaml
```

## Database Dependencies

Requires migration: `20251204180001_mobility_v2_matching_functions.sql`

Function used: `find_nearby_trips_v2()`

## Architecture

```
┌──────────────────┐
│  HTTP Request    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Validation      │ (Zod schemas)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Supabase RPC    │ (find_nearby_trips_v2)
│  PostGIS Query   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Response        │ (Raw candidates)
└──────────────────┘
```

## Monitoring

Metrics exposed via Pino logs:
- `matching.request` - Incoming requests
- `matching.candidates_found` - Number of candidates returned
- `matching.query_duration` - Database query time
- `matching.error` - Errors encountered

## Testing

```bash
# Unit tests
pnpm test

# Integration tests (requires Supabase)
pnpm test:integration

# Load testing
artillery quick --count 100 --num 10 http://localhost:4700/matches
```

## Performance

- **Target**: < 200ms p95 latency
- **Throughput**: 500 req/sec per instance
- **Database**: Uses PostGIS spatial indexes (GIST)

## Troubleshooting

### No candidates found
- Check trip exists: `SELECT * FROM mobility_trips WHERE id = 'tripId'`
- Check status is 'open'
- Check location is fresh (last_location_update within 30 min)
- Check radius is large enough

### Slow queries
- Verify spatial index exists: `\d mobility_trips`
- Check `EXPLAIN ANALYZE` on RPC function
- Consider increasing radius or freshness window

## Related Services

- `ranking-service` - Scores/ranks candidates
- `mobility-orchestrator` - Creates matches
- `tracking-service` - Updates locations
