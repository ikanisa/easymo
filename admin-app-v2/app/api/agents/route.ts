import { NextResponse } from 'next/server';

const mockAgents = [
  { id: '1', name: 'Sales Assistant', status: 'active', conversations: 1234 },
  { id: '2', name: 'Support Bot', status: 'active', conversations: 5678 },
];

export async function GET() {
  return NextResponse.json({ agents: mockAgents });
}
