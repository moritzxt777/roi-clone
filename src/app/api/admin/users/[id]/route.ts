import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'ADMIN' && (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        domains: { select: { id: true, name: true, status: true } },
        pages: { select: { id: true, name: true, slug: true, status: true } },
        clones: { select: { id: true, name: true, status: true, sourceUrl: true } },
        apiKeys: { select: { id: true, name: true, prefix: true, lastUsed: true, createdAt: true } },
        sessions: { select: { id: true, expires: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: id },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ user, auditLogs });
  } catch (error) {
    console.error('Admin user detail error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'ADMIN' && (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { role, emailVerified } = body;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role && { role }),
        ...(typeof emailVerified === 'boolean' && { emailVerified: emailVerified ? new Date() : null }),
      },
      select: { id: true, email: true, name: true, role: true, emailVerified: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ADMIN_UPDATE_USER',
        entity: 'User',
        entityId: id,
        newData: { role, emailVerified },
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;

    if (id === session.user.id) {
      return NextResponse.json({ error: 'Não pode deletar a si mesmo' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'ADMIN_DELETE_USER',
        entity: 'User',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}