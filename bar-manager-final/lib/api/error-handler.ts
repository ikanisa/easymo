import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAPIError(error: unknown) {
  console.error('API Error:', error);
  
  // Log to Sentry
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error);
  }
  
  if (error instanceof APIError) {
    return NextResponse.json(
      { 
        error: error.message, 
        code: error.code,
        details: error.details 
      },
      { status: error.statusCode }
    );
  }
  
  if (error instanceof Error) {
    // Handle Zod errors if they bubble up as standard errors
    if (error.name === 'ZodError') {
       return NextResponse.json(
        { error: 'Validation failed', details: JSON.parse(error.message) },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
  
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

export function jsonOk<T>(data: T) {
  return NextResponse.json(data, { status: 200 });
}

export function jsonError(message: string, status: number = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}
