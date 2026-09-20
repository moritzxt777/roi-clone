import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { domainSchema } from '@/lib/validations';
import crypto from 'crypto';

async function checkTxtRecord(domain: string, token: string): Promise<boolean> {
  try {
    const dns = await import('dns/promises');
    const records = await dns.resolveTxt(`_roi-verify.${domain}`);
    return records.some((record) => record.join('').includes(`roi-verify=${token}`));
  } catch {
    return false;
  }
}

async function checkCnameRecord(domain: string): Promise<boolean> {
  try {
    const dns = await import('dns/promises');
    const records = await dns.resolveCname(domain);
    return records.some(
      (record) =>
        record.includes('roi-clone.site') ||
        record.includes('cname.roi-clone.site') ||
        record.includes('roi-clone.pages.dev')
    );
  } catch {
    return false;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const domain = await prisma.domain.findFirst({
      where: { id, userId: session.user.id },
      include: {
        verification: true,
        pages: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!domain) {
      return NextResponse.json({ error: 'Domínio não encontrado' }, { status: 404 });
    }

    return NextResponse.json(domain);
  } catch (error) {
    console.error('Get domain error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const domain = await prisma.domain.findFirst({
      where: { id, userId: session.user.id },
      include: { verification: true },
    });

    if (!domain) {
      return NextResponse.json({ error: 'Domínio não encontrado' }, { status: 404 });
    }

    if (action === 'verify') {
      if (!domain.verification) {
        return NextResponse.json({ error: 'Token de verificação não encontrado' }, { status: 400 });
      }

      const txtVerified = await checkTxtRecord(domain.name, domain.verification.value);
      const cnameVerified = await checkCnameRecord(domain.name);

      if (txtVerified || cnameVerified) {
        const updated = await prisma.domain.update({
          where: { id },
          data: {
            status: 'VERIFIED',
            verification: {
              update: {
                verified: true,
                verifiedAt: new Date(),
              },
            },
          },
          include: { verification: true },
        });

        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: 'VERIFY_DOMAIN',
            entity: 'Domain',
            entityId: domain.id,
          },
        });

        return NextResponse.json(updated);
      } else {
        await prisma.domain.update({
          where: { id },
          data: { status: 'FAILED' },
        });
        return NextResponse.json(
          { error: 'Verificação falhou. Verifique os registros DNS.' },
          { status: 400 }
        );
      }
    }

    if (action === 'retry') {
      const newToken = crypto.randomBytes(32).toString('hex');
      const dnsRecords = {
        txt: {
          name: `_roi-verify.${domain.name}`,
          type: 'TXT',
          value: `roi-verify=${newToken}`,
          ttl: 300,
        },
        cname: {
          name: domain.name,
          type: 'CNAME',
          value: 'cname.roi-clone.site',
          ttl: 300,
        },
      };

      const updated = await prisma.domain.update({
        where: { id },
        data: {
          status: 'PENDING',
          dnsRecords,
          verification: {
            update: {
              value: newToken,
              verified: false,
              verifiedAt: null,
            },
          },
        },
        include: { verification: true },
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Domain action error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const domain = await prisma.domain.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!domain) {
      return NextResponse.json({ error: 'Domínio não encontrado' }, { status: 404 });
    }

    await prisma.domain.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_DOMAIN',
        entity: 'Domain',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete domain error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}