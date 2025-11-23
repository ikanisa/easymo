import { NextResponse } from 'next/server';

const mockTransactions = [
  { id: 'TX123', type: 'allocation', amount: '+500', status: 'completed' },
];

export async function GET() {
  return NextResponse.json({ transactions: mockTransactions });
}
