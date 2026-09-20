import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { registerSchema } from '@/lib/validations';
import { generateApiKey } from '@/lib/validations';
import { sendWelcomeEmail } from '@/lib/mail';
import { createVerificationToken } from '@/lib/tokens';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        emailVerified: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    const { key, prefix, hash } = generateApiKey();
    await prisma.apiKey.create({
      data: {
        name: 'Default API Key',
        keyHash: hash,
        prefix,
        userId: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        entity: 'User',
        entityId: user.id,
      },
    });

    // Gerar token de verificação e auto-login
    let autoLoginToken = '';
    try {
      autoLoginToken = await createVerificationToken(user.email);
    } catch (tokenErr) {
      console.error('Erro ao gerar token de verificação:', tokenErr);
    }

    // Enviar e-mail de boas-vindas com o template visual da ROI Clone e link direto
    try {
      const appUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.roi-clone.site');
      const confirmUrl = autoLoginToken ? `${appUrl}/auth/verify?token=${autoLoginToken}` : `${appUrl}/dashboard`;

      await sendWelcomeEmail({
        to: user.email,
        name: user.name || 'Usuário',
        confirmUrl,
        token: autoLoginToken,
      });
    } catch (err) {
      console.warn('Falha no envio de e-mail de boas-vindas:', err);
    }

    return NextResponse.json(
      { user, autoLoginToken, message: 'Conta criada com sucesso' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}