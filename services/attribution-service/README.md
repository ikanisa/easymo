# Attribution Service

The Attribution Service tracks user attribution, marketing campaigns, and conversion funnels across the EasyMO platform.

## Purpose

- **Campaign Tracking**: Monitor marketing campaign performance
- **Attribution Modeling**: Track user acquisition sources
- **Conversion Analytics**: Measure conversion rates and user journeys
- **Source Attribution**: Identify which channels drive user acquisition

## Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (via Prisma)
- **Package Dependencies**:
  - `@easymo/commons` - Shared utilities and logging
  - `@easymo/db` - Database client

## Architecture

### Key Components

1. **Campaign Tracker**: Records campaign interactions
2. **Attribution Engine**: Calculates attribution based on various models
3. **Analytics Reporter**: Generates conversion reports
4. **Source Identifier**: Identifies user acquisition sources

### Attribution Models

- **First Touch**: Credits the first interaction
- **Last Touch**: Credits the final interaction before conversion
- **Multi-Touch**: Distributes credit across touchpoints
- **Time Decay**: Credits more recent interactions more heavily

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/agent_core

# Logging
LOG_LEVEL=info

# Service Port (optional)
PORT=4800
```

See [ENV_VARIABLES.md](../../docs/ENV_VARIABLES.md) for complete reference.

## Installation

```bash
# Install dependencies
pnpm install

# Build the service
pnpm --filter attribution-service build
```

## Development

```bash
# Run in development mode with hot reload
pnpm --filter attribution-service dev

# Run tests
pnpm --filter attribution-service test

# Run tests with coverage
pnpm --filter attribution-service test:cov
```

## API Endpoints

### Campaign Tracking

**POST /campaigns/track**
```json
{
  "campaignId": "uuid",
  "userId": "uuid",
  "source": "facebook",
  "medium": "cpc",
  "content": "ad-variant-a"
}
```

**Response:**
```json
{
  "ok": true,
  "trackingId": "uuid"
}
```

### Attribution Report

**GET /attribution/user/:userId**

Returns attribution data for a specific user.

**Response:**
```json
{
  "userId": "uuid",
  "firstTouch": {
    "source": "facebook",
    "timestamp": "2025-01-15T10:00:00Z"
  },
  "lastTouch": {
    "source": "direct",
    "timestamp": "2025-01-20T14:30:00Z"
  },
  "conversions": 2
}
```

### Campaign Analytics

**GET /campaigns/:campaignId/analytics**

Returns performance metrics for a campaign.

**Response:**
```json
{
  "campaignId": "uuid",
  "impressions": 10000,
  "clicks": 500,
  "conversions": 50,
  "ctr": 0.05,
  "conversionRate": 0.1
}
```

## Database Schema

### Tables

**campaigns**
- `id` - UUID primary key
- `name` - Campaign name
- `source` - Traffic source
- `medium` - Marketing medium
- `created_at` - Timestamp

**attribution_events**
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `campaign_id` - Foreign key to campaigns
- `event_type` - Event type (impression, click, conversion)
- `timestamp` - Event timestamp

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Watch mode
pnpm test:watch
```

## Deployment

The service is deployed as part of the microservices stack. See [deployment documentation](../../docs/deployment/) for details.

## Monitoring

### Metrics

- Campaign impressions count
- Click-through rate (CTR)
- Conversion rate
- Attribution model distribution
- API response times

### Logs

All significant events are logged using structured logging:

```typescript
import { logger } from '@easymo/commons';

logger.info({
  event: 'CAMPAIGN_TRACKED',
  campaignId: campaign.id,
  userId: user.id,
  source: campaign.source
});
```

## Troubleshooting

### Common Issues

**Issue: Attribution data missing**
- Check if campaign tracking is enabled
- Verify user_id and campaign_id are valid
- Check database connectivity

**Issue: Incorrect attribution**
- Review attribution model configuration
- Verify timestamp accuracy
- Check for data consistency issues

See [TROUBLESHOOTING.md](../../docs/TROUBLESHOOTING.md) for more help.

## Contributing

Follow the [GROUND_RULES.md](../../docs/GROUND_RULES.md) for:
- Structured logging requirements
- Security best practices
- Feature flag usage

## Related Services

- **Agent-Core**: User management
- **Buyer Service**: Conversion tracking
- **Reconciliation Service**: Payment attribution

## Documentation

- [Architecture Overview](../../docs/ARCHITECTURE.md)
- [API Documentation](./docs/api.md)
- [Database Schema](./docs/schema.md)

---

**Maintained by**: EasyMO Platform Team  
**Last Updated**: 2025-10-29
