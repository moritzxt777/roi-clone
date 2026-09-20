import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const proxy = auth((req) => {
  const ip = getClientIp(req);
  const pathname = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth;
  const userRole = (req.auth?.user as any)?.role;

  // 1. Rate Limiting contra Força Bruta e Abusos
  if (pathname.startsWith('/api/auth')) {
    const limitResult = checkRateLimit(`auth_${ip}`, 12, 60000); // 12 requisições por minuto
    if (!limitResult.success) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Muitas tentativas de autenticação. Por segurança, aguarde alguns segundos.', 
          retryAfter: limitResult.resetTime 
        }),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': String(limitResult.resetTime) 
          } 
        }
      );
    }
  }

  if (pathname.startsWith('/admin-master') || pathname.startsWith('/api/admin-master') || pathname.startsWith('/admin')) {
    const limitResult = checkRateLimit(`admin_${ip}`, 30, 60000); // 30 requisições por minuto
    if (!limitResult.success) {
      return new NextResponse(
        JSON.stringify({ error: 'Limite de requisições administrativas excedido.', retryAfter: limitResult.resetTime }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(limitResult.resetTime) } }
      );
    }
  }

  if (pathname.startsWith('/api/ai/chat')) {
    const limitResult = checkRateLimit(`ai_${ip}`, 25, 60000); // 25 mensagens por minuto
    if (!limitResult.success) {
      return new NextResponse(
        JSON.stringify({ error: 'Muitas mensagens enviadas à ROI IA em sequência. Aguarde um instante.', retryAfter: limitResult.resetTime }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(limitResult.resetTime) } }
      );
    }
  }

  // 2. Proteção de Rotas Administrativas (/admin-master e /admin)
  const isMasterAdmin = pathname.startsWith('/admin-master') || pathname.startsWith('/api/admin-master');
  const isLegacyAdmin = pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  const isAnyAdmin = isMasterAdmin || isLegacyAdmin;

  if (isAnyAdmin) {
    if (!isLoggedIn) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      }
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.nextUrl));
    }
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }
  }

  // 3. Proteção do Dashboard do Usuário
  const isOnDashboard = pathname.startsWith('/dashboard');
  if (isOnDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.nextUrl));
  }

  // 4. Redirecionar usuário logado tentando acessar /login ou /register
  const isOnAuth = pathname.startsWith('/login') || pathname.startsWith('/register');
  if (isOnAuth && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
  }

  // 5. Roteamento Inteligente de Subdomínios Wildcard para roi-clone.site
  const host = req.headers.get('host') || req.nextUrl.host || '';
  const cleanHost = host.split(':')[0].toLowerCase();
  if (cleanHost.endsWith('.roi-clone.site')) {
    const subdomain = cleanHost.replace('.roi-clone.site', '');
    if (subdomain && !['www', 'app', 'admin', 'api', 'dashboard'].includes(subdomain)) {
      if (pathname === '/' || pathname === '') {
        return NextResponse.rewrite(new URL(`/p/${subdomain}`, req.nextUrl));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/admin-master/:path*',
    '/admin/:path*',
    '/api/:path*',
  ],
};

export default proxy;