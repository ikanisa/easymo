# Type Safety Guide

## Overview

This guide provides best practices and utilities for writing type-safe code in the admin app.

## Core Utilities

### Type Guards (`lib/validation/type-guards.ts`)

Type guards help you safely validate unknown values at runtime:

```typescript
import { isString, isObject, requireString } from "@/lib/validation/type-guards";

// Basic type checking
if (isString(value)) {
  // TypeScript knows value is string here
  console.log(value.toUpperCase());
}

// Required validation (throws on failure)
const name = requireString(payload.name, "name");

// Safe property access
const email = getString(user, "email", "default@example.com");
```

### API Error Classes (`lib/errors/api-errors.ts`)

Standardized error handling for API routes:

```typescript
import {
  NotFoundError,
  ValidationError,
  errorToResponse,
  logError,
} from "@/lib/errors/api-errors";

export async function GET(request: Request) {
  try {
    const data = await fetchData();
    if (!data) {
      throw new NotFoundError("Resource", id);
    }
    return Response.json({ data });
  } catch (error) {
    logError(error, { route: "/api/example" });
    return errorToResponse(error);
  }
}
```

## Best Practices

### 1. Avoid `any` Types

**❌ Bad:**
```typescript
function processData(data: any) {
  return data.map((item: any) => item.value);
}
```

**✅ Good:**
```typescript
interface DataItem {
  value: string;
}

function processData(data: DataItem[]) {
  return data.map((item) => item.value);
}
```

### 2. Use `unknown` for Truly Unknown Data

**❌ Bad:**
```typescript
function handleError(error: any) {
  console.error(error.message);
}
```

**✅ Good:**
```typescript
import { normalizeError } from "@/lib/errors/api-errors";

function handleError(error: unknown) {
  const apiError = normalizeError(error);
  console.error(apiError.message);
}
```

### 3. Validate External Data

Always validate data from external sources (APIs, user input, etc.):

```typescript
import { requireObject, getString } from "@/lib/validation/type-guards";

export async function POST(request: Request) {
  const body = await request.json(); // unknown
  const payload = requireObject(body, "request body");
  const email = getString(payload, "email");
  
  if (!email) {
    throw new ValidationError("Email is required");
  }
  
  // email is guaranteed to be string here
}
```

### 4. Define Response Types

**❌ Bad:**
```typescript
async function fetchUsers() {
  const response = await fetch("/api/users");
  return response.json(); // returns any
}
```

**✅ Good:**
```typescript
interface User {
  id: string;
  email: string;
  name: string;
}

interface UsersResponse {
  data: User[];
  total: number;
}

async function fetchUsers(): Promise<UsersResponse> {
  const response = await fetch("/api/users");
  return response.json();
}
```

### 5. Use Type Guards in Conditionals

```typescript
import { isApiError } from "@/lib/validation/type-guards";

const result = await fetchData();

if (isApiError(result)) {
  console.error(result.error);
  return;
}

// TypeScript knows result is success here
console.log(result.data);
```

## Common Patterns

### API Route Pattern

```typescript
import { errorToResponse, logError } from "@/lib/errors/api-errors";
import { requireObject, getString } from "@/lib/validation/type-guards";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requireObject(body);
    const email = getString(payload, "email");
    
    // ... business logic
    
    return Response.json({ success: true });
  } catch (error) {
    logError(error, { route: request.url });
    return errorToResponse(error);
  }
}
```

### Component Props Pattern

```typescript
interface UserCardProps {
  user: {
    id: string;
    name: string;
    email: string;
  };
  onEdit?: (userId: string) => void;
}

export function UserCard({ user, onEdit }: UserCardProps) {
  // ...
}
```

### Hook Return Type Pattern

```typescript
interface UseUserResult {
  user: User | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useUser(id: string): UseUserResult {
  // ...
}
```

## Migration Strategy

When you encounter `any` types:

1. **Identify the actual type** - What is this value really?
2. **Define an interface** - Create a proper type definition
3. **Add validation** - Use type guards if needed
4. **Update usage** - Fix any type errors

Example:

```typescript
// Before (with any)
function processUser(user: any) {
  return user.name.toUpperCase();
}

// After (type-safe)
interface User {
  name: string;
  email: string;
}

function processUser(user: User) {
  return user.name.toUpperCase();
}
```

## Testing

Always test code that validates types:

```typescript
import { requireString, ValidationError } from "@/lib/validation";

describe("requireString", () => {
  it("returns string value", () => {
    expect(requireString("test")).toBe("test");
  });

  it("throws on non-string", () => {
    expect(() => requireString(123)).toThrow(TypeError);
  });
});
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Type Guards and Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Unknown vs Any](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-0.html#new-unknown-top-type)

## Summary

✅ Use `unknown` instead of `any`
✅ Validate external data
✅ Define proper interfaces
✅ Use type guards
✅ Handle errors with typed error classes
✅ Test type validation logic
