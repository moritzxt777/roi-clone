import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const proxy = auth((req) => {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host || '';
  const cleanHost = host.split(':')[0].toLowerCase();

  // Se acessar pelo subdomínio da Vercel (roi-clone.vercel.app), redireciona para o domínio próprio
  if (cleanHost.includes('vercel.app')) {
    const url = req.nextUrl.clone();
    url.protocol = 'https';
    url.host = 'roi-clone.site';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

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

  // Bloqueio permanente de rotas legadas antigas deletadas (Retorna 404)
  if (
    pathname === '/admin' || 
    pathname.startsWith('/admin/') || 
    pathname === '/admin-master' || 
    pathname.startsWith('/admin-master/') ||
    pathname.startsWith('/api/admin/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin-master')
  ) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Rate Limiting para Moritz Admin
  if (pathname.startsWith('/moritzadmin171roi') || pathname.startsWith('/api/moritzadmin171roi')) {
    const limitResult = checkRateLimit(`moritzadmin_${ip}`, 45, 60000); // 45 req/min
    if (!limitResult.success) {
      return new NextResponse(
        JSON.stringify({ error: 'Limite de requisições excedido.', retryAfter: limitResult.resetTime }),
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

  // 2. Proteção Estrita do Painel Moritz Admin (/moritzadmin171roi)
  const isMoritzAdmin = pathname.startsWith('/moritzadmin171roi') || pathname.startsWith('/api/moritzadmin171roi');
  if (isMoritzAdmin) {
    if (!isLoggedIn) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      }
      return NextResponse.redirect(new URL(`/login?callbackUrl=${pathname}`, req.nextUrl));
    }

    const userEmail = req.auth?.user?.email?.toLowerCase();
    const isAuthorizedAdmin = userEmail === 'moritzadmin777roi@gmail.com' || userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

    if (!isAuthorizedAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
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

  // 5. Roteamento Inteligente de Subdomínios Wildcard para roi.app e roi-clone.site
  const matchedDomain = ['.roi.app', '.roi-clone.site'].find((d) => cleanHost.endsWith(d));
  if (matchedDomain) {
    const subdomain = cleanHost.replace(matchedDomain, '');
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
    '/moritzadmin171roi/:path*',
    '/admin-master/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/login',
    '/register',
    '/api/:path*',
  ],
};

export default proxy;