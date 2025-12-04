# Mobility V2 API Documentation

**Version**: 2.0.0  
**Last Updated**: December 4, 2025

---

## Overview

The Mobility V2 API provides a microservices-based architecture for matching passengers with drivers in a ride-sharing platform. The system uses spatial queries, sophisticated ranking algorithms, and Redis caching for optimal performance.

---

## Architecture

```
WhatsApp → Edge Function → Orchestrator → Services → Database
                                ↓
                            Redis Cache
```

### Services

| Service | Port | Purpose |
|---------|------|---------|
| Orchestrator | 4600 | Workflow coordination |
| Matching | 4700 | Spatial driver search |
| Ranking | 4500 | Driver scoring & sorting |
| Tracking | 4800 | Location & trip updates |

---

## Orchestrator API

### Base URL
```
Production: https://orchestrator.internal:4600
Development: http://localhost:4600
```

### Endpoints

#### 1. Find Drivers

**POST** `/workflows/find-drivers`

Finds nearby drivers based on passenger location and vehicle type.

**Request Body**:
```json
{
  "userId": "uuid",
  "passengerTripId": "uuid",
  "vehicleType": "car|moto|bus",
  "radiusKm": 15,
  "limit": 9
}
```

**Response**:
```json
{
  "count": 5,
  "drivers": [
    {
      "user_id": "uuid",
      "trip_id": "uuid",
      "vehicle_type": "car",
      "distance_km": 2.5,
      "score": 95.5,
      "rating": 4.8,
      "acceptance_rate": 0.92,
      "completion_rate": 0.95,
      "surge_multiplier": 1.0,
      "pickup_lat": -1.9441,
      "pickup_lng": 30.0619,
      "pickup_text": "Downtown"
    }
  ],
  "cached": false,
  "timestamp": "2025-12-04T20:00:00Z"
}
```

**Caching**: Results cached for 5 minutes per (passengerTripId, vehicleType, radiusKm).

**Performance**:
- Cached: ~5ms
- Uncached: ~200-400ms

**Error Responses**:
```json
{
  "error": "Passenger trip not found",
  "code": "TRIP_NOT_FOUND"
}
```

Status codes: 200 (OK), 400 (Bad Request), 404 (Not Found), 500 (Server Error)

---

#### 2. Accept Match

**POST** `/workflows/accept-match`

Creates a match between passenger and driver.

**Request Body**:
```json
{
  "driverTripId": "uuid",
  "passengerTripId": "uuid",
  "driverUserId": "uuid",
  "passengerUserId": "uuid"
}
```

**Response**:
```json
{
  "matchId": "uuid",
  "status": "pending",
  "createdAt": "2025-12-04T20:00:00Z",
  "driver": {
    "userId": "uuid",
    "tripId": "uuid"
  },
  "passenger": {
    "userId": "uuid",
    "tripId": "uuid"
  }
}
```

**Side Effects**:
- Invalidates cache for both trips
- Updates trip status to 'matched'
- Creates notification records

**Performance**: ~100-200ms

**Error Responses**:
```json
{
  "error": "Trip already matched",
  "code": "TRIP_ALREADY_MATCHED"
}
```

---

#### 3. Health Check

**GET** `/health`

Service health status.

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-12-04T20:00:00Z",
  "services": {
    "matching": "healthy",
    "ranking": "healthy",
    "tracking": "healthy",
    "redis": "healthy",
    "database": "healthy"
  },
  "version": "2.0.0"
}
```

---

#### 4. Metrics

**GET** `/metrics`

Prometheus metrics endpoint.

**Response**: Prometheus text format

```
# HELP http_request_duration_seconds HTTP request latencies
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="POST",route="/workflows/find-drivers",le="0.005"} 100
...
```

---

## Matching Service API

### Base URL
```
Internal: http://matching-service:4700
```

### Endpoints

#### 1. Find Nearby Drivers

**POST** `/matching/find-nearby`

Performs spatial search using PostGIS.

**Request Body**:
```json
{
  "lat": -1.9441,
  "lng": 30.0619,
  "vehicleType": "car",
  "radiusKm": 15,
  "excludeUserIds": ["uuid1", "uuid2"]
}
```

**Response**:
```json
{
  "drivers": [
    {
      "user_id": "uuid",
      "trip_id": "uuid",
      "vehicle_type": "car",
      "distance_km": 2.5,
      "pickup_lat": -1.9441,
      "pickup_lng": 30.0619,
      "pickup_text": "Downtown",
      "created_at": "2025-12-04T19:00:00Z"
    }
  ],
  "count": 5
}
```

**Query Performance**: O(log n) with spatial index, typically <100ms

---

## Ranking Service API

### Base URL
```
Internal: http://ranking-service:4500
```

### Endpoints

#### 1. Rank Drivers

**POST** `/mobility/rank-drivers`

Applies sophisticated scoring algorithm.

**Request Body**:
```json
{
  "drivers": [
    {
      "user_id": "uuid",
      "trip_id": "uuid",
      "distance_km": 2.5
    }
  ],
  "strategy": "balanced",
  "passengerLat": -1.9441,
  "passengerLng": 30.0619
}
```

**Strategies**:
- `balanced`: 40% rating + 30% acceptance + 30% completion
- `quality`: 60% rating + 20% acceptance + 20% completion
- `proximity`: 20% rating + 20% acceptance + 20% completion + 40% distance

**Response**:
```json
{
  "rankedDrivers": [
    {
      "user_id": "uuid",
      "trip_id": "uuid",
      "distance_km": 2.5,
      "score": 95.5,
      "rating": 4.8,
      "acceptance_rate": 0.92,
      "completion_rate": 0.95,
      "surge_multiplier": 1.0
    }
  ]
}
```

**Scoring Formula**:
```
base_score = (rating_weight * rating_normalized) +
             (acceptance_weight * acceptance_rate) +
             (completion_weight * completion_rate)

distance_bonus = max(0, 10 * (1 - distance_km / 15))
recency_bonus = min(5, hours_old)

final_score = (base_score + distance_bonus - recency_bonus) * surge_multiplier
```

---

## Tracking Service API

### Base URL
```
Internal: http://tracking-service:4800
```

### Endpoints

#### 1. Update Trip Location

**POST** `/tracking/update-location`

Updates driver/passenger real-time location.

**Request Body**:
```json
{
  "tripId": "uuid",
  "lat": -1.9441,
  "lng": 30.0619,
  "timestamp": "2025-12-04T20:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "tripId": "uuid",
  "updatedAt": "2025-12-04T20:00:00Z"
}
```

---

#### 2. Get Trip Status

**GET** `/tracking/trip/:tripId`

Retrieves current trip status and location.

**Response**:
```json
{
  "tripId": "uuid",
  "status": "active",
  "currentLat": -1.9441,
  "currentLng": 30.0619,
  "lastUpdate": "2025-12-04T20:00:00Z",
  "estimatedArrival": "2025-12-04T20:15:00Z"
}
```

---

## Database Schema

### Tables

#### `mobility_trips`
```sql
CREATE TABLE mobility_trips (
  id UUID PRIMARY KEY,
  creator_user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('car', 'moto', 'bus')),
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  pickup_text TEXT,
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mobility_trips_spatial ON mobility_trips 
  USING GIST (pickup_location);
```

#### `mobility_trip_matches`
```sql
CREATE TABLE mobility_trip_matches (
  id UUID PRIMARY KEY,
  driver_trip_id UUID REFERENCES mobility_trips(id),
  passenger_trip_id UUID REFERENCES mobility_trips(id),
  driver_user_id UUID NOT NULL,
  passenger_user_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_trip_id, passenger_trip_id)
);
```

#### `mobility_driver_metrics`
```sql
CREATE TABLE mobility_driver_metrics (
  user_id UUID PRIMARY KEY,
  rating NUMERIC(3,2) DEFAULT 5.00,
  total_ratings INTEGER DEFAULT 0,
  acceptance_rate NUMERIC(4,3) DEFAULT 1.000,
  completion_rate NUMERIC(4,3) DEFAULT 1.000,
  total_trips INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Caching Strategy

### Cache Keys

```
mobility:drivers:{passengerTripId}:{vehicleType}:{radiusKm}
mobility:metrics:{userId}
```

### TTL

- Driver searches: 5 minutes
- Driver metrics: 10 minutes

### Invalidation

Cache invalidated on:
- New trip creation
- Match acceptance
- Trip status change
- Metrics update

---

## Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| TRIP_NOT_FOUND | Trip ID doesn't exist | 404 |
| TRIP_EXPIRED | Trip has expired | 400 |
| TRIP_ALREADY_MATCHED | Trip already has a match | 400 |
| INVALID_VEHICLE_TYPE | Invalid vehicle type | 400 |
| INVALID_LOCATION | Invalid coordinates | 400 |
| SERVICE_UNAVAILABLE | Downstream service down | 503 |
| DATABASE_ERROR | Database query failed | 500 |
| CACHE_ERROR | Redis error (non-fatal) | 200 |

---

## Rate Limiting

Not currently implemented. Consider adding:
- 100 req/min per user for find-drivers
- 20 req/min per user for accept-match

---

## Authentication

All internal service-to-service calls are unauthenticated (private network).

Edge function calls use Supabase JWT authentication.

---

## Monitoring

### Key Metrics

- `http_request_duration_seconds` - Request latency histogram
- `http_requests_total` - Request count by status
- `cache_hits_total` - Cache hit counter
- `cache_misses_total` - Cache miss counter
- `drivers_found` - Drivers found distribution
- `matches_created_total` - Successful matches

### Dashboards

Grafana: `http://localhost:3000/d/mobility-overview`

### Alerts

- HighErrorRate: error rate > 5% for 5 minutes
- SlowResponseTime: p95 latency > 1s for 5 minutes
- ServiceDown: service unhealthy for 2 minutes

---

## Changelog

### v2.0.0 (2025-12-04)
- Initial microservices release
- Spatial search with PostGIS
- Sophisticated ranking algorithm
- Redis caching layer
- Prometheus metrics
- 83% code reduction from v1

---

## Support

- Issues: Create GitHub issue
- Runbook: See `docs/RUNBOOK.md`
- Deployment: See `MOBILITY_V2_PRODUCTION_DEPLOYMENT.md`

---

**Maintained by**: Platform Team  
**Last Review**: December 4, 2025
