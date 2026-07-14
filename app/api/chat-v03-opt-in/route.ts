import { NextRequest, NextResponse } from 'next/server';
import { createOptInToken } from '@/lib/chat-v03/opt-in';

export async function GET(request: NextRequest) {
  const expectedKey = process.env.CHAT_LAB_KEY;
  const suppliedKey = request.nextUrl.searchParams.get('key');
  const turnOff = request.nextUrl.searchParams.get('off') === '1';

  if (!expectedKey || suppliedKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redirectPath = request.nextUrl.searchParams.get('redirect');
  const safePath = redirectPath?.startsWith('/') && !redirectPath.startsWith('//') ? redirectPath : '/';
  const destination = new URL(`${safePath}${safePath.includes('?') ? '&' : '?'}v03=${turnOff ? '0' : '1'}`, request.url);
  const response = NextResponse.redirect(destination);

  if (turnOff) {
    response.cookies.delete('sibantu_v03_force');
  } else {
    response.cookies.set('sibantu_v03_force', createOptInToken(), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    });
  }
  return response;
}
