import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ exists: false, unverified: false });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ exists: false, unverified: false });
    }

    return NextResponse.json({
      exists: true,
      unverified: user.emailVerified === null,
    });
  } catch {
    return NextResponse.json({ exists: false, unverified: false });
  }
}
