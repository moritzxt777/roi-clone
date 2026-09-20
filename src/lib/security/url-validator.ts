import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

export class SSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFError';
  }
}

/**
 * Validates a URL to prevent Server-Side Request Forgery (SSRF).
 * Blocks internal IP ranges, localhost, and metadata endpoints.
 */
export async function validateUrl(targetUrl: string): Promise<string> {
  let raw = (targetUrl || '').trim();
  if (!raw) throw new SSRFError('URL vazia.');
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(raw);
  } catch (err) {
    throw new SSRFError('URL inválida.');
  }

  // Only allow HTTP and HTTPS
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new SSRFError('Apenas URLs com HTTP ou HTTPS são permitidas.');
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block obvious localhost/internal hostnames
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    throw new SSRFError('Endereços locais não são permitidos.');
  }

  try {
    const res = await lookup(hostname, { family: 4 }).catch(() => null);
    if (res && res.address && isPrivateIP(res.address)) {
      throw new SSRFError('URLs que resolvem para redes privadas são bloqueadas.');
    }
  } catch (error: any) {
    if (error instanceof SSRFError) throw error;
  }

  return parsedUrl.toString();
}

/**
 * Checks if an IP is within a private network range.
 */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4) return false;

  const [a, b] = parts;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // 127.0.0.0/8
  if (a === 127) return true;

  // 169.254.0.0/16 (Cloud Metadata IP)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8
  if (a === 0) return true;

  return false;
}
