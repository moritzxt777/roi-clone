import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const cloneId = (await params).id;

    let targetUserId = session.user.id;
    let isAdmin = false;

    if (session.user.email) {
      const emailLower = session.user.email.toLowerCase();
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(targetUserId ? [{ id: targetUserId }] : []),
            { email: emailLower },
          ],
        },
        select: { id: true, role: true },
      });
      if (dbUser) {
        targetUserId = dbUser.id;
        isAdmin =
          dbUser.role === 'ADMIN' ||
          emailLower === 'moritzadmin777roi@gmail.com' ||
          emailLower === 'moritzdoblack@proton.me';
      }
    }

    const whereCondition = isAdmin ? { id: cloneId } : { id: cloneId, userId: targetUserId };

    const clone = await prisma.clone.findFirst({
      where: whereCondition,
      select: {
        status: true,
        progress: true,
        error: true,
      },
    });

    if (!clone) {
      return new NextResponse('Clone not found', { status: 404 });
    }

    return NextResponse.json(clone);
  } catch (error) {
    console.error('Error fetching clone status:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
