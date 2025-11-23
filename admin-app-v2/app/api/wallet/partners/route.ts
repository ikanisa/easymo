import { NextResponse } from 'next/server';

const mockPartners = [
  { id: '1', name: 'Total Energies', category: 'Fuel Station', balance: '50,000', status: 'active' },
];

export async function GET() {
  return NextResponse.json({ partners: mockPartners });
}
