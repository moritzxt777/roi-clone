import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    if (!session?.user || (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            clones: true,
            pages: true,
            domains: true,
          }
        }
      },
      take: 100,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Admin master users error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;

    if (!session?.user || (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Impedir que um admin altere seu próprio papel para evitar lock out acidental
    if (userId === session.user.id && role === 'USER') {
      return NextResponse.json({ error: 'Você não pode rebaixar seu próprio papel.' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_USER_ROLE',
        entity: 'User',
        entityId: userId,
        newData: { newRole: role },
      }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Admin master update user error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
