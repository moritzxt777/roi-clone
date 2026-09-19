import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { domainSchema } from '@/lib/validations';
import { validateDomain } from '@/lib/validations';
import crypto from 'crypto';

function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateDnsRecords(domain: string, token: string) {
  return {
    txt: {
      name: `_roi-verify.${domain}`,
      type: 'TXT',
      value: `roi-verify=${token}`,
      ttl: 300,
    },
    cname: {
      name: domain,
      type: 'CNAME',
      value: 'roi-clone.pages.dev',
      ttl: 300,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const domains = await prisma.domain.findMany({
      where: { userId: session.user.id },
      include: {
        verification: true,
        pages: {
          select: { id: true, name: true, slug: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(domains);
  } catch (error) {
    console.error('Get domains error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = domainSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name } = parsed.data;
    const normalizedDomain = name.toLowerCase().trim();

    if (!validateDomain(normalizedDomain)) {
      return NextResponse.json({ error: 'Formato de domínio inválido' }, { status: 400 });
    }

    const existing = await prisma.domain.findUnique({
      where: { name: normalizedDomain },
    });

    if (existing) {
      return NextResponse.json({ error: 'Domínio já cadastrado' }, { status: 409 });
    }

    const token = generateVerificationToken();
    const dnsRecords = generateDnsRecords(normalizedDomain, token);

    const domain = await prisma.domain.create({
      data: {
        name: normalizedDomain,
        userId: session.user.id,
        status: 'PENDING',
        dnsRecords,
        verification: {
          create: {
            type: 'TXT',
            value: token,
          },
        },
      },
      include: { verification: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_DOMAIN',
        entity: 'Domain',
        entityId: domain.id,
        newData: { name: normalizedDomain },
      },
    });

    return NextResponse.json(domain, { status: 201 });
  } catch (error) {
    console.error('Create domain error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}