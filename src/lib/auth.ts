import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import DiscordProvider from 'next-auth/providers/discord';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? [
          DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        // 1. Auto-login via Token de Confirmação de E-mail (Magic Link)
        if (credentials?.token && typeof credentials.token === 'string') {
          const vToken = await prisma.verificationToken.findUnique({
            where: { token: credentials.token },
          });

          if (!vToken || vToken.expires < new Date()) {
            throw new Error('Token de confirmação inválido ou expirado');
          }

          const user = await prisma.user.findUnique({
            where: { email: vToken.identifier.toLowerCase() },
          });

          if (!user) {
            throw new Error('Usuário não encontrado');
          }

          // Confirma o e-mail imediatamente no banco de dados
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          }).catch(() => {});

          // Dá uma janela de tolerância de 15 minutos para permitir recarregamento, duplo-clique e scanner de antivírus do e-mail
          const graceExpiration = new Date(Date.now() + 15 * 60 * 1000);
          if (vToken.expires > graceExpiration) {
            await prisma.verificationToken.update({
              where: { token: credentials.token },
              data: { expires: graceExpiration },
            }).catch(() => {});
          }

          // Limpa tokens já expirados em segundo plano
          prisma.verificationToken.deleteMany({
            where: { expires: { lt: new Date() } },
          }).catch(() => {});

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image || user.avatar,
          };
        }

        // 2. Login tradicional por Email e Senha
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error('Credenciais inválidas');
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Credenciais inválidas');
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          throw new Error('Credenciais inválidas');
        }

        const isMaster = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.email.toLowerCase() === 'moritzadmin777roi@gmail.com';
        const hasEmailService = !!(process.env.RESEND_API_KEY || process.env.EMAIL_SERVER_HOST);
        if (hasEmailService && !user.emailVerified && !isMaster) {
          throw new Error('E-mail pendente de confirmação. Por favor, abra seu e-mail e clique no link de validação para liberar o acesso.');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image || user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'USER';
      }
      if (token.email?.toLowerCase() === 'moritzadmin777roi@gmail.com') {
        token.role = 'SUPER_ADMIN';
      }
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.image = session.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        const isMaster = session.user.email?.toLowerCase() === 'moritzadmin777roi@gmail.com';
        (session.user as any).role = isMaster ? 'SUPER_ADMIN' : ((token.role as string) || 'USER');
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          });
        } catch {
          // ignore
        }
      }
    },
    async signIn({ user }) {
      if (user?.id) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'SIGN_IN',
              entity: 'User',
              entityId: user.id,
            },
          });
        } catch {
          // ignore
        }
      }
    },
  },
  debug: process.env.NODE_ENV === 'development',
});

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
    };
  }

  interface User {
    role: string;
  }
}