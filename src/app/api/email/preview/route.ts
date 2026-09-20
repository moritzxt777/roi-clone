import { NextRequest, NextResponse } from 'next/server';
import { generateWelcomeEmailHtml, sendWelcomeEmail } from '@/lib/mail';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/email/preview -> Renderiza o HTML do e-mail visualmente no navegador
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || 'Moritz Admin';
  const email = searchParams.get('email') || 'moritzadmin777roi@gmail.com';

  const html = generateWelcomeEmailHtml(name, email);

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

// POST /api/email/preview -> Envia um e-mail de teste real para o endereço informado
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const isMaster = session?.user?.email?.toLowerCase() === 'moritzadmin777roi@gmail.com' || (session?.user as any)?.role === 'SUPER_ADMIN' || (session?.user as any)?.role === 'ADMIN';

    if (!isMaster && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Apenas administradores podem disparar e-mails de teste' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetEmail = body.to || session?.user?.email || 'moritzadmin777roi@gmail.com';
    const targetName = body.name || session?.user?.name || 'Administrador';

    const result = await sendWelcomeEmail({
      to: targetEmail,
      name: targetName,
    });

    return NextResponse.json({
      success: result.success,
      targetEmail,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
