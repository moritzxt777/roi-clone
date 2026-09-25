import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { cloneSchema } from '@/lib/validations';
import { clonePage } from '@/lib/cloning-engine';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

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

    // Administradores têm visão consolidada de todos os projetos
    const whereCondition = isAdmin || !targetUserId ? {} : { userId: targetUserId };

    const clones = await prisma.clone.findMany({
      where: whereCondition,
      include: {
        page: { select: { id: true, name: true, slug: true, domainId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json(clones);
  } catch (error) {
    console.error('Get clones error:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = cloneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { sourceUrl, name, newCheckoutUrl, pixKey, optimizeWithAi, crawlFullSite, maxPages } = parsed.data;

    let targetUserId = session.user.id;
    if (session.user.email) {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(targetUserId ? [{ id: targetUserId }] : []),
            { email: session.user.email.toLowerCase() },
          ],
        },
        select: { id: true },
      });
      if (dbUser) {
        targetUserId = dbUser.id;
      }
    }

    const clone = await prisma.clone.create({
      data: {
        name,
        sourceUrl,
        userId: targetUserId,
        status: 'PENDING',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: targetUserId,
        action: 'CREATE_CLONE',
        entity: 'Clone',
        entityId: clone.id,
        newData: { name, sourceUrl, newCheckoutUrl, pixKey, optimizeWithAi, crawlFullSite, maxPages },
      },
    });

    // Process clone in background so HTTP response is returned immediately to the client (<50ms).
    // The client UI navigates to /dashboard/clones/[id]/progress to track status via /api/clone/[id]/status.
    clonePage(clone.id, { newCheckoutUrl, pixKey, optimizeWithAi, crawlFullSite, maxPages }).catch((err) => {
      console.error('Clone background processing error:', err);
    });

    return NextResponse.json(clone, { status: 201 });
  } catch (error) {
    console.error('Create clone error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}