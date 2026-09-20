import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

export const domainSchema = z.object({
  name: z.string().min(1, 'Domínio é obrigatório').regex(
    /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i,
    'Domínio inválido (ex: exemplo.com)'
  ),
});

export const pageSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  slug: z.string().min(1, 'Slug é obrigatório').regex(
    /^[a-z0-9-]+$/,
    'Slug deve conter apenas letras minúsculas, números e hífens'
  ),
  sourceUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  domainId: z.string().optional(),
});

export const cloneSchema = z.object({
  sourceUrl: z.string().url('URL inválida'),
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  newCheckoutUrl: z.string().url('URL de checkout inválida').optional().or(z.literal('')),
  pixKey: z.string().optional().or(z.literal('')),
  optimizeWithAi: z.boolean().optional(),
});

export const updatePageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  html: z.string().optional(),
  css: z.string().optional(),
  js: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export const elementSchema = z.object({
  selector: z.string().min(1),
  type: z.enum(['TEXT', 'IMAGE', 'BUTTON', 'LINK', 'FORM', 'CONTAINER', 'VIDEO', 'IFRAME', 'CUSTOM']),
  content: z.record(z.string(), z.unknown()),
  styles: z.record(z.string(), z.unknown()).optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().nonnegative().optional(),
  parentId: z.string().optional(),
});

export function validateDomain(domain: string): boolean {
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '');
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = 'rk_';
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const key = `${prefix}${randomPart}`;
  const hash = Buffer.from(key).toString('base64');
  return { key, prefix: prefix.slice(0, -1), hash };
}

export function verifyApiKey(key: string, hash: string): boolean {
  return Buffer.from(key).toString('base64') === hash;
}