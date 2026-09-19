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

    const clone = await prisma.clone.findFirst({
      where: {
        id: cloneId,
        userId: session.user.id,
      },
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
