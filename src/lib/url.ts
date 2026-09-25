import { NextRequest } from 'next/server';

/**
 * Retorna a URL canônica da aplicação.
 * Prioriza SEMPRE o domínio oficial de produção https://roi-clone.site,
 * evitando redirecionamentos para o subdomínio interno .vercel.app.
 */
export function getAppUrl(req?: NextRequest | Request): string {
  // Se uma requisição for passada, verifica o host real acessado pelo usuário
  if (req) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'https';

    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      // Se estiver acessando pelo domínio próprio (roi-clone.site), mantém ele
      if (host.includes('roi-clone.site')) {
        return `${proto}://${host.replace(/^www\./, '')}`;
      }
    }
  }

  // Se NEXTAUTH_URL estiver definido explicitamente e for do domínio próprio
  if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.includes('localhost') && !process.env.NEXTAUTH_URL.includes('vercel.app')) {
    return process.env.NEXTAUTH_URL.replace('://www.', '://');
  }

  // Domínio de produção oficial definitivo
  return 'https://roi-clone.site';
}
