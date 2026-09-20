import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/url';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  const appUrl = getAppUrl(req);

  if (token) {
    return NextResponse.redirect(`${appUrl}/auth/verify?token=${token}`);
  }

  return NextResponse.redirect(`${appUrl}/login`);
}
