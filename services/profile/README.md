# Profile Microservice

A TypeScript/Express microservice for managing user profiles and saved locations in EasyMO.

## Features

- **CRUD Operations**: Create, read, update, and delete user profiles
- **Saved Locations**: Manage user's saved locations (home, work, etc.)
- **Input Validation**: Zod-based schema validation with detailed error messages
- **Rate Limiting**: In-memory rate limiting to prevent abuse
- **Structured Logging**: JSON logging with correlation IDs using pino
- **Health Checks**: Liveness and readiness endpoints
- **Error Handling**: Centralized error handling with standardized responses

## API Endpoints

### Profiles

| Method | Endpoint                     | Description          |
|--------|------------------------------|----------------------|
| POST   | `/api/v1/profiles`           | Create profile       |
| GET    | `/api/v1/profiles/:id`       | Get profile by ID    |
| PUT    | `/api/v1/profiles/:id`       | Update profile       |
| DELETE | `/api/v1/profiles/:id`       | Delete profile       |
| GET    | `/api/v1/profiles/search`    | Search profiles      |

### Saved Locations

| Method | Endpoint                               | Description             |
|--------|----------------------------------------|-------------------------|
| GET    | `/api/v1/profiles/:id/locations`       | Get saved locations     |
| POST   | `/api/v1/profiles/:id/locations`       | Create saved location   |
| DELETE | `/api/v1/profiles/:id/locations/:locId`| Delete saved location   |

### Health

| Method | Endpoint        | Description                        |
|--------|-----------------|------------------------------------|
| GET    | `/health`       | Liveness check                     |
| GET    | `/health/ready` | Readiness check (includes DB ping) |

## Environment Variables

| Variable                    | Description                | Default    |
|-----------------------------|----------------------------|------------|
| `PORT`                      | Server port                | 4001       |
| `SUPABASE_URL`              | Supabase project URL       | -          |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key  | -          |
| `RATE_LIMIT_WINDOW_MS`      | Rate limit window (ms)     | 60000      |
| `RATE_LIMIT_MAX_REQUESTS`   | Max requests per window    | 100        |
| `NODE_ENV`                  | Environment                | development|

## Quick Start

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Start development server
pnpm start:dev

# Start production server
pnpm start
```

## Project Structure

```
services/profile/
├── src/
│   ├── server.ts      # Express app and routes
│   ├── service.ts     # Profile service layer
│   ├── schemas.ts     # Zod validation schemas
│   ├── errors.ts      # Error handling
│   ├── middleware.ts  # Rate limiting, validation
│   ├── config.ts      # Environment configuration
│   ├── logger.ts      # Structured logging
│   └── supabase.ts    # Supabase client
├── test/
│   ├── service.spec.ts  # Service unit tests
│   ├── schemas.spec.ts  # Schema validation tests
│   └── errors.spec.ts   # Error handling tests
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Error Responses

All errors follow this format:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "fields": {
      "email": ["Invalid email format"]
    }
  },
  "requestId": "abc-123"
}
```

### Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource already exists
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Unexpected server error

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test -- test/service.spec.ts
```

## Database Schema

The service uses the following Supabase tables:

```sql
-- profiles table
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY,
  whatsapp_e164 TEXT,
  wa_id TEXT,
  name TEXT,
  email TEXT,
  locale TEXT DEFAULT 'en',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_saved_locations table
CREATE TABLE user_saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id),
  label TEXT NOT NULL,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Monitoring

The service exposes structured logs compatible with common log aggregation tools:

```json
{
  "level": "info",
  "time": "2025-01-15T10:30:00.000Z",
  "service": "profile-service",
  "msg": "profile.create.success",
  "profileId": "123e4567-e89b-12d3-a456-426614174000"
}
```

## License

MIT
