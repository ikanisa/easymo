import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (session) {
      const user = JSON.parse(session.value);
      return NextResponse.json({ user });
    }

    return NextResponse.json({ user: null }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
