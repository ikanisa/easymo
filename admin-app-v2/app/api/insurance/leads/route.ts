import { NextResponse } from 'next/server';

const mockLeads = [
  { id: '1', customerName: 'Alice Johnson', type: 'motor', status: 'new' },
  { id: '2', customerName: 'Bob Smith', type: 'health', status: 'reviewing' },
];

export async function GET() {
  return NextResponse.json({ leads: mockLeads });
}
