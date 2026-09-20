import crypto from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Cria um token de verificação e auto-login para o e-mail do usuário.
 * Validade padrão: 2 horas (tempo ideal para segurança e confirmação).
 */
export async function createVerificationToken(email: string, expiresInHours = 2): Promise<string> {
  const cleanEmail = email.toLowerCase().trim();
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  // Remove tokens anteriores para o mesmo e-mail para evitar acúmulo
  try {
    await prisma.verificationToken.deleteMany({
      where: { identifier: cleanEmail },
    });
  } catch {
    // Silently ignore se não houver
  }

  // Cria novo token de verificação
  await prisma.verificationToken.create({
    data: {
      identifier: cleanEmail,
      token,
      expires,
    },
  });

  return token;
}

/**
 * Valida um token de verificação e retorna o e-mail associado
 */
export async function validateVerificationToken(token: string): Promise<{ valid: boolean; email?: string; error?: string }> {
  if (!token) {
    return { valid: false, error: 'Token não fornecido' };
  }

  try {
    const vToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!vToken) {
      return { valid: false, error: 'Token não encontrado ou inválido' };
    }

    if (vToken.expires < new Date()) {
      // Token expirado: remove
      await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
      return { valid: false, error: 'Token expirado' };
    }

    return { valid: true, email: vToken.identifier };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
