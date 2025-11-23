import { NextResponse } from 'next/server';

// Mock data - replace with actual database queries
const mockUsers = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    status: 'active',
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'user',
    status: 'active',
  },
];

export async function GET() {
  return NextResponse.json({ users: mockUsers });
}

export async function POST(request: Request) {
  const data = await request.json();
  const newUser = {
    id: Math.random().toString(),
    ...data,
  };
  
  return NextResponse.json({ user: newUser }, { status: 201 });
}
