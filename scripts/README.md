# Scripts Directory

## Directory Structure

- **development/** - Development and testing scripts
- **deployment/** - Deployment and release scripts
- **database/** - Database migration and management
- **testing/** - Automated testing scripts
- **utilities/** - General utility scripts
- **cleanup/** - Cleanup and maintenance scripts

## Usage Guidelines

1. All scripts should have clear comments
2. Use `set -e` for error handling
3. Validate inputs before executing
4. Log actions for debugging
5. Provide usage examples

## Common Scripts

### Development
- `development/seed-data.sh` - Seed test data

### Deployment
- `deployment/deploy-production.sh` - Deploy to production
- `deployment/deploy-staging.sh` - Deploy to staging

### Testing
- `testing/run-all-tests.sh` - Run all test suites

### Utilities
- `utilities/check-health.sh` - Health check
- `utilities/verify-env.sh` - Verify environment setup
