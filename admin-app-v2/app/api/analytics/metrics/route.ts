import { NextResponse } from 'next/server';

const mockMetrics = {
  revenue: { value: '$45,231', change: '+20.1%' },
  users: { value: '2,345', change: '+15.2%' },
  bounceRate: { value: '42.3%', change: '-5.4%' },
};

export async function GET() {
  return NextResponse.json({ metrics: mockMetrics });
}
