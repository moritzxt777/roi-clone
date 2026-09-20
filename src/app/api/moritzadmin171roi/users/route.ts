import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const ADMIN_AUTHORIZED_EMAIL = 'moritzadmin777roi@gmail.com';

// GET /api/moritzadmin171roi/users
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    const userEmail = session?.user?.email?.toLowerCase();

    if (!session?.user || userEmail !== ADMIN_AUTHORIZED_EMAIL || (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || '';
    const roleFilter = searchParams.get('role');

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (roleFilter && ['USER', 'ADMIN', 'SUPER_ADMIN'].includes(roleFilter)) {
      where.role = roleFilter;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            clones: true,
            pages: true,
            domains: true,
          }
        }
      }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({ error: 'Erro interno ao listar usuários' }, { status: 500 });
  }
}

// PATCH /api/moritzadmin171roi/users - Alterar cargo
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    const userEmail = session?.user?.email?.toLowerCase();

    if (!session?.user || userEmail !== ADMIN_AUTHORIZED_EMAIL || (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 404 });
    }

    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Proteger o admin supremo contra auto-rebaixamento
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (targetUser?.email.toLowerCase() === ADMIN_AUTHORIZED_EMAIL && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'O Administrador Principal não pode ser rebaixado' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, name: true, role: true }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Erro ao atualizar cargo:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// DELETE /api/moritzadmin171roi/users - Excluir usuário
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const userRole = (session?.user as any)?.role;
    const userEmail = session?.user?.email?.toLowerCase();

    if (!session?.user || userEmail !== ADMIN_AUTHORIZED_EMAIL || (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuário obrigatório' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (targetUser?.email.toLowerCase() === ADMIN_AUTHORIZED_EMAIL) {
      return NextResponse.json({ error: 'Não é permitido excluir a conta do Administrador Principal' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ success: true, message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 });
  }
}
