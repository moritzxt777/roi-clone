import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createVerificationToken } from '@/lib/tokens';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Localiza ou garante usuário no banco
    let user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      // Se não existir, cria o registro básico sincronizado
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          name: cleanEmail.split('@')[0],
          emailVerified: new Date(),
        },
      });
    } else if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    }

    // Gera um token de verificação/auto-login de uso único
    const token = await createVerificationToken(cleanEmail);

    return NextResponse.json({ success: true, token });
  } catch (error: any) {
    console.error('Erro na rota de auto-login:', error);
    return NextResponse.json({ error: 'Erro ao gerar acesso automático' }, { status: 500 });
  }
}
