# Coding Standards

## TypeScript

### General Rules
- Use TypeScript for all new files
- Avoid `any` type - use `unknown` or proper types
- Use interfaces for object shapes, types for unions/intersections
- Enable strict mode incrementally

### Naming Conventions
- **Files**: kebab-case (`user-service.ts`)
- **Components**: PascalCase (`UserProfile.tsx`)
- **Functions**: camelCase (`getUserById()`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Interfaces**: PascalCase with `I` prefix (`IUserData`) or without
- **Types**: PascalCase (`UserRole`)

### Import Order
1. External dependencies (react, next, etc.)
2. Internal packages (@easymo/*, @va/*)
3. Relative imports (../*, ./*)
4. Type imports (separate from value imports)

Example:
```typescript
import { useState } from 'react';
import { NextResponse } from 'next/server';

import { logger } from '@easymo/commons';
import type { User } from '@va/shared';

import { getUserById } from '../services/user-service';
import type { LocalConfig } from './types';
```

## React/Next.js

### Component Structure
```typescript
// 1. Imports
import { useState } from 'react';
import type { FC } from 'react';

// 2. Types/Interfaces
interface Props {
  userId: string;
  onUpdate?: () => void;
}

// 3. Component
export const UserProfile: FC<Props> = ({ userId, onUpdate }) => {
  // Hooks first
  const [user, setUser] = useState<User | null>(null);
  
  // Event handlers
  const handleUpdate = () => {
    // ...
  };
  
  // Render
  return <div>...</div>;
};
```

### Hooks
- Always use hooks at the top level
- Custom hooks should start with `use` prefix
- Extract complex logic into custom hooks

### Props
- Destructure props in function signature
- Use optional chaining for optional props
- Provide default values where appropriate

## API Routes

### Structure
```typescript
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  // Define schema
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    // Implementation
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'message' }, { status: 500 });
  }
}
```

### Error Handling
- Always use try-catch
- Return appropriate HTTP status codes
- Don't expose internal errors to client
- Log errors with context

## Security

### Sensitive Data
- Never log passwords or tokens
- Mask PII in logs
- Use environment variables for secrets
- Validate all user input with Zod

### API Security
- Implement rate limiting
- Validate CSRF tokens
- Add security headers
- Use HTTPS in production

## Testing

### File Naming
- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

### Test Structure
```typescript
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '123';
      
      // Act
      const result = await getUserById(userId);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(userId);
    });
    
    it('should throw when user not found', async () => {
      await expect(getUserById('invalid')).rejects.toThrow();
    });
  });
});
```

## Git

### Commit Messages
Follow Conventional Commits:
- `feat: add user profile page`
- `fix: resolve login redirect issue`
- `docs: update API documentation`
- `refactor: simplify auth logic`
- `test: add user service tests`
- `chore: update dependencies`

### Branch Naming
- `feature/user-authentication`
- `fix/login-redirect-bug`
- `refactor/api-error-handling`
- `docs/api-documentation`

## Documentation

### Code Comments
- Use JSDoc for functions and components
- Explain "why", not "what"
- Keep comments up to date
- Remove commented-out code

### README Files
- Every package should have a README
- Include: purpose, installation, usage, API
- Keep examples up to date

## Performance

### Best Practices
- Use React.memo for expensive components
- Implement proper loading states
- Lazy load routes and components
- Optimize images (use Next.js Image component)
- Monitor bundle size

### Database
- Use indexes for frequently queried fields
- Implement pagination
- Cache when appropriate
- Avoid N+1 queries

## Tools

### Required
- ESLint (linting)
- Prettier (formatting)
- TypeScript (type checking)
- Vitest/Jest (testing)

### Recommended
- Husky (git hooks)
- lint-staged (pre-commit checks)
- Zod (runtime validation)

## Quality Gates

Before committing:
1. `pnpm type-check` - No TypeScript errors
2. `pnpm lint` - No ESLint errors
3. `pnpm test` - All tests pass
4. `pnpm format:check` - Code is formatted

Before deploying:
1. All quality gates pass
2. Build succeeds
3. E2E tests pass
4. Security audit clean

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Best Practices](https://react.dev/learn)
- [Conventional Commits](https://www.conventionalcommits.org/)
