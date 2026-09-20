import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createVerificationToken } from '@/lib/tokens';
import { sendWelcomeEmail } from '@/lib/mail';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.toLowerCase().trim();

    if (!email) {
      return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, emailVerified: true },
    });

    if (!user) {
      // Retorna sucesso para evitar enumeração de usuários
      return NextResponse.json({ success: true, message: 'Se o e-mail estiver cadastrado, um novo link foi enviado.' });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true, message: 'Este e-mail já foi verificado. Faça login diretamente.' });
    }

    const token = await createVerificationToken(user.email);
    const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.roi-clone.site');
    const confirmUrl = `${appUrl}/auth/verify?token=${token}`;

    await sendWelcomeEmail({
      to: user.email,
      name: user.name || 'Usuário',
      confirmUrl,
      token,
    });

    return NextResponse.json({ success: true, message: 'Novo e-mail de confirmação enviado com sucesso!' });
  } catch (error: any) {
    console.error('Erro ao reenviar e-mail de confirmação:', error);
    return NextResponse.json({ error: 'Erro ao enviar e-mail. Tente novamente mais tarde.' }, { status: 500 });
  }
}
