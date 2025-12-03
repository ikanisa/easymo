import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const metric = await req.json();
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals]', metric);
    }
    
    // TODO: Send to observability platform (Honeycomb, Sentry, etc.)
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Web Vitals] Error:', error);
    return NextResponse.json({ error: 'Failed to record vitals' }, { status: 500 });
  }
}
