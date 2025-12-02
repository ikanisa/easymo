# Test Quality Checklist

## Unit Tests

### Coverage
- [ ] All public functions have tests
- [ ] All handlers have tests
- [ ] Edge cases are tested
- [ ] Error paths are tested

### Quality
- [ ] Tests are independent (no shared state)
- [ ] Tests are deterministic (no random failures)
- [ ] Tests use mocks for external dependencies
- [ ] Tests have clear assertions
- [ ] Tests have descriptive names

## Integration Tests

### E2E Flows
- [ ] Ride booking flow tested
- [ ] Insurance claim flow tested
- [ ] Wallet transfer flow tested
- [ ] Profile update flow tested

### Cross-Service
- [ ] Routing between services tested
- [ ] State persistence tested
- [ ] Error propagation tested

## CI/CD

### Pipeline
- [ ] Tests run on every PR
- [ ] Tests run on merge to main
- [ ] Coverage report generated
- [ ] Failed tests block merge

### Performance
- [ ] Tests complete within 5 minutes
- [ ] No flaky tests
- [ ] Coverage threshold enforced

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| QA Lead | | | |
| Developer | | | |
| DevOps | | | |
