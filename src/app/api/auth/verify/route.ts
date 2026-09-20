import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.roi-clone.site');

  if (token) {
    return NextResponse.redirect(`${appUrl}/auth/verify?token=${token}`);
  }

  return NextResponse.redirect(`${appUrl}/login`);
}
