import { NextResponse } from 'next/server';

const mockHealth = [
  { service: 'WhatsApp API', status: 'healthy', latency: '45ms' },
  { service: 'Webhook Handler', status: 'healthy', latency: '120ms' },
];

export async function GET() {
  return NextResponse.json({ services: mockHealth });
}
