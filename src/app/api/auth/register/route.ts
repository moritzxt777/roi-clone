import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { registerSchema } from '@/lib/validations';
import { generateApiKey } from '@/lib/validations';
import { sendWelcomeEmail } from '@/lib/mail';
import { createVerificationToken } from '@/lib/tokens';
import { getAppUrl } from '@/lib/url';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido ou vazio' },
        { status: 400 }
      );
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const cleanEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email já cadastrado' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const hasEmailService = !!(process.env.RESEND_API_KEY || process.env.EMAIL_SERVER_HOST);

    const user = await prisma.user.create({
      data: {
        name,
        email: cleanEmail,
        passwordHash,
        emailVerified: hasEmailService ? null : new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    try {
      const { prefix, hash } = generateApiKey();
      await prisma.apiKey.create({
        data: {
          name: 'Default API Key',
          keyHash: hash,
          prefix,
          userId: user.id,
        },
      });
    } catch (apiKeyErr) {
      console.warn('[Register] Aviso ao gerar chave de API:', apiKeyErr);
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'REGISTER',
          entity: 'User',
          entityId: user.id,
        },
      });
    } catch (auditErr) {
      console.warn('[Register] Aviso ao gravar audit log:', auditErr);
    }

    // Gerar token de verificação e auto-login
    let autoLoginToken = '';
    try {
      autoLoginToken = await createVerificationToken(user.email);
    } catch (tokenErr) {
      console.error('Erro ao gerar token de verificação:', tokenErr);
    }

    // Enviar e-mail de boas-vindas com o template visual da ROI Clone e link direto
    let emailSent = false;
    let emailError: string | undefined;
    const appUrl = getAppUrl(request);
    const confirmUrl = autoLoginToken ? `${appUrl}/auth/verify?token=${autoLoginToken}` : `${appUrl}/dashboard`;

    try {
      const emailRes = await sendWelcomeEmail({
        to: user.email,
        name: user.name || 'Usuário',
        confirmUrl,
        token: autoLoginToken,
      });

      emailSent = emailRes.success;
      if (!emailRes.success) {
        emailError = emailRes.error;
        console.warn(`[Register] Falha no envio de e-mail para ${user.email}:`, emailRes.error);
      } else {
        console.log(`[Register] E-mail enviado com sucesso para ${user.email}`);
      }
    } catch (err: any) {
      emailError = err?.message || 'Erro inesperado no envio de e-mail';
      console.warn('Falha no envio de e-mail de boas-vindas:', err);
    }

    // NUNCA vazar o token ou confirmUrl na resposta HTTP pública (apenas enviado por e-mail)
    return NextResponse.json(
      { 
        user, 
        emailSent, 
        emailError, 
        autoVerified: !hasEmailService,
        message: hasEmailService
          ? (emailSent 
              ? 'Conta criada com sucesso! Enviamos um link de confirmação para o seu e-mail.' 
              : 'Conta criada com sucesso! Por favor, acerte a confirmação no seu e-mail.')
          : 'Conta criada com sucesso! Seu acesso foi liberado imediatamente.',
      },
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