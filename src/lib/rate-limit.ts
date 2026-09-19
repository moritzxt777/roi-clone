import { NextRequest } from 'next/server';

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory store para tracking de requisições por chave/IP
const rateLimitStore = new Map<string, RateLimitRecord>();

// Limpeza automática de registros antigos a cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 15 * 60 * 1000);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Extrai o IP real do cliente mesmo através de proxies (Cloudflare, Vercel, Nginx)
 */
export function getClientIp(req: Request | NextRequest): string {
  const headers = req.headers;
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const parts = xForwardedFor.split(',');
    return parts[0].trim();
  }

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  return '127.0.0.1';
}

/**
 * Algoritmo de Janela Deslizante (Sliding Window) para limitação de taxa e proteção contra Brute-Force
 * @param key Identificador único (ex: IP ou IP + endpoint)
 * @param limit Número máximo de requisições permitidas na janela
 * @param windowMs Duração da janela em milissegundos
 */
export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60000
): {
  success: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
} {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filtrar apenas timestamps dentro da janela atual
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetTime = Math.ceil((oldest + windowMs - now) / 1000);

    return {
      success: false,
      remaining: 0,
      resetTime: Math.max(resetTime, 1),
      totalHits: record.timestamps.length,
    };
  }

  record.timestamps.push(now);

  return {
    success: true,
    remaining: Math.max(0, limit - record.timestamps.length),
    resetTime: Math.ceil(windowMs / 1000),
    totalHits: record.timestamps.length,
  };
}
