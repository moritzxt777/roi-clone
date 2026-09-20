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
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID || process.env.AUTH_DISCORD_ID || '1551107958325121145',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || process.env.AUTH_DISCORD_SECRET || 'CJTXIUnnZABZojAxPkHcWnhKlvKrbacL',
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
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

        if (!user.emailVerified) {
          throw new Error('Email não verificado. Verifique sua caixa de entrada.');
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