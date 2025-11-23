import { NextResponse } from 'next/server';

const mockPolicies = [
  { id: '1', policyNumber: 'POL-001', holderName: 'John Doe', status: 'active' },
];

export async function GET() {
  return NextResponse.json({ policies: mockPolicies });
}

export async function POST(request: Request) {
  const data = await request.json();
  return NextResponse.json({ policy: { id: Math.random().toString(), ...data } }, { status: 201 });
}
