# Code Quality Checklist

**Last Updated:** 2025-01-17  
**Purpose:** Checklist for maintaining code quality across Edge Functions

## Pre-Commit Checklist

### ✅ Imports
- [ ] No duplicate imports
- [ ] Imports are organized (external → internal → types)
- [ ] Heavy imports (LLM, agents) use lazy loading
- [ ] Dynamic imports for optional features

### ✅ Error Handling
- [ ] Uses standardized error classes from `_shared/errors.ts`
- [ ] All errors are logged with structured logging
- [ ] Correlation IDs included in error logs
- [ ] User-friendly error messages for user errors
- [ ] System errors don't expose internal details

### ✅ Type Safety
- [ ] No `any` types (use `unknown` if needed)
- [ ] Null checks for potentially undefined values
- [ ] Type guards for union types
- [ ] Proper type imports (use `import type` for types)

### ✅ Performance
- [ ] Database queries use indexes
- [ ] Query results are limited
- [ ] Only select needed columns
- [ ] Large objects are cleaned up after use
- [ ] Cache is used for idempotent operations

### ✅ Logging
- [ ] Structured logging with `logStructuredEvent`
- [ ] Correlation IDs for request tracing
- [ ] Appropriate log levels (error, warn, info)
- [ ] Sensitive data is masked (phone numbers, etc.)

### ✅ Security
- [ ] Webhook signatures are verified
- [ ] Rate limiting is implemented
- [ ] Input validation is performed
- [ ] No hardcoded secrets
- [ ] RLS policies are enforced

### ✅ Testing
- [ ] Unit tests for utilities
- [ ] Integration tests for workflows
- [ ] Error cases are tested
- [ ] Edge cases are covered

## Code Review Checklist

### Function Structure
- [ ] Single responsibility principle
- [ ] Functions are not too long (<100 lines)
- [ ] Clear function names
- [ ] Proper error handling

### Database Operations
- [ ] Queries use indexes
- [ ] Results are limited
- [ ] Transactions for multi-step operations
- [ ] Proper error handling for DB errors

### API Design
- [ ] Consistent response format
- [ ] Proper HTTP status codes
- [ ] Error responses follow standard format
- [ ] CORS headers for web requests

## Performance Checklist

### Cold Start
- [ ] Minimal top-level imports
- [ ] Heavy dependencies use lazy loading
- [ ] No unnecessary initialization

### Runtime
- [ ] Database queries are optimized
- [ ] Caching is used appropriately
- [ ] Memory is cleaned up
- [ ] No memory leaks

## Documentation Checklist

- [ ] Function purpose is documented
- [ ] Complex logic has comments
- [ ] Parameters are documented
- [ ] Return types are documented
- [ ] Examples for complex functions

## Tools

Run these scripts before committing:

```bash
# Check for duplicate imports
node scripts/check-duplicate-imports.mjs

# Analyze import optimization
node scripts/optimize-imports.mjs

# Analyze test coverage
node scripts/analyze-test-coverage.mjs

# Fix duplicate imports (auto-fix)
node scripts/fix-duplicate-imports.mjs
```

## Standards

- **Error Handling:** See `docs/ERROR_HANDLING_STANDARD.md`
- **Performance:** See `docs/PERFORMANCE_OPTIMIZATION.md`
- **Testing:** Target 80%+ coverage for critical modules

