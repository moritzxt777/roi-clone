/**
 * Lead notification email.
 *
 * The cloner previously left every `<form>` pointing at the original site's
 * action, so a submission went to the original operator — or was blocked by CORS
 * before it left the browser. The submission is now captured by this platform's
 * own endpoint and this module is what makes the owner aware of it.
 *
 * Everything arriving in `fields` is attacker-controlled: it came from a public
 * form endpoint. So the rules here are strict:
 *
 *   - every value is HTML-escaped before it reaches the template
 *   - values are length-capped, so a megabyte of pasted text cannot break layout
 *     or smuggle a reply-to header
 *   - only `http:` and `https:` values are turned into links, so a lead cannot
 *     plant a `javascript:` or `data:` URL in the owner's inbox
 *   - the field the owner's mail client replies to is taken only from a value
 *     that passes full email validation, and only when the owner has enabled it
 */

import { sendEmail } from './mail';

export interface LeadField {
  name: string;
  label: string;
  value: string;
  kind: 'text' | 'email' | 'phone' | 'url' | 'long';
}

export interface LeadNotificationInput {
  to: string;
  ownerName?: string | null;
  pageName: string;
  pageUrl?: string | null;
  fields: Record<string, unknown>;
  submittedAt: Date;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  /** When false, the lead's own address is not used as Reply-To. */
  allowReplyTo?: boolean;
}

export interface LeadNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  replyTo?: string;
}

const MAX_LABEL_LENGTH = 60;
const MAX_VALUE_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

const FIELD_LABELS: Record<string, string> = {  name: 'Nome',
  nome: 'Nome',
  fullname: 'Nome completo',
  firstname: 'Primeiro nome',
  first_name: 'Primeiro nome',
  lastname: 'Sobrenome',
  last_name: 'Sobrenome',
  email: 'E-mail',
  e_mail: 'E-mail',
  mail: 'E-mail',
  phone: 'Telefone',
  telefone: 'Telefone',
  cellphone: 'Celular',
  celular: 'Celular',
  whatsapp: 'WhatsApp',
  document: 'Documento',
  cpf: 'CPF',
  cnpj: 'CNPJ',
  rg: 'RG',
  birthdate: 'Data de nascimento',
  data_nascimento: 'Data de nascimento',
  age: 'Idade',
  city: 'Cidade',
  cidade: 'Cidade',
  state: 'Estado',
  uf: 'Estado',
  country: 'País',
  zipcode: 'CEP',
  cep: 'CEP',
  address: 'Endereço',
  endereco: 'Endereço',
  message: 'Mensagem',
  mensagem: 'Mensagem',
  comment: 'Comentário',
  complemento: 'Complemento',
  utm_source: 'Origem (utm_source)',
  utm_medium: 'Médio (utm_medium)',
  utm_campaign: 'Campanha (utm_campaign)',
  utm_content: 'Conteúdo (utm_content)',
  utm_term: 'Termo (utm_term)',
};

/**
 * Normalises raw submitted values into a bounded, classified field list.
 *
 * Nested objects and arrays are flattened rather than dropped: a clone of a
 * multi-step funnel commonly posts `{ answers: { step1: "..." } }`, and losing
 * those to a type check is how a real lead disappears from the inbox.
 */
export function normalizeLeadFields(
  raw: Record<string, unknown>
): LeadField[] {
  const fields: LeadField[] = [];
  const seen = new Set<string>();

  const push = (name: string, value: unknown) => {
    const key = name.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);

    const text = stringifyValue(value);
    if (text === null) return;

    const label = FIELD_LABELS[normalizeLabelKey(key)] ?? prettifyLabel(key);
    fields.push({
      name: key.slice(0, MAX_LABEL_LENGTH),
      label: label.slice(0, MAX_LABEL_LENGTH),
      value: text,
      kind: classify(key, text),
    });
  };

  for (const [name, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        push(`${name}.${nestedKey}`, nestedValue);
      }
      continue;
    }

    if (Array.isArray(value)) {
      // A checkbox group posts one key per value; keep them on one line so the
      // owner reads "Interesses: emagrecimento, fitness" rather than five rows.
      const joined = value
        .map((entry) => stringifyValue(entry))
        .filter((entry): entry is string => entry !== null)
        .join(', ');
      push(name, joined);
      continue;
    }

    push(name, value);
  }

  return fields;
}

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';

  const text = typeof value === 'string' ? value : String(value);
  const trimmed = text.trim();
  if (!trimmed) return null;

  // Cap rather than reject: a truncated phone number is still a lead, a
  // rejected one is a lost sale.
  return trimmed.length > MAX_VALUE_LENGTH
    ? `${trimmed.slice(0, MAX_VALUE_LENGTH)}… (truncado)`
    : trimmed;
}

/**
 * Collapses the separator styles a real form uses onto one lookup key.
 *
 * `data-nascimento`, `data_nascimento` and `data.nascimento` are the same field
 * spelled three ways, and a miss here only costs a readable label, not a lead —
 * but the label is what the owner reads when triaging, so it is worth getting
 * right.
 */
function normalizeLabelKey(name: string): string {
  return name.toLowerCase().replace(/[\s\-.]+/g, '_');
}

function classify(name: string, value: string): LeadField['kind'] {
  const key = name.toLowerCase();
  if (EMAIL_PATTERN.test(value)) return 'email';
  if (key.includes('email') || key.includes('e_mail') || key === 'mail') return 'email';
  if (key.includes('phone') || key.includes('telefone') || key.includes('cel') || key.includes('whatsapp')) {
    return 'phone';
  }
  if (/^https?:\/\//i.test(value)) return 'url';
  if (value.length > 400) return 'long';
  return 'text';
}

function prettifyLabel(name: string): string {
  const cleaned = name
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** The lead's own address, when the form collected a valid one. */
export function extractLeadEmail(fields: LeadField[]): string | null {
  const emailField = fields.find((field) => field.kind === 'email');
  if (!emailField) return null;
  const candidate = emailField.value.trim();
  return EMAIL_PATTERN.test(candidate) ? candidate : null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * A value is only linkified for `http`/`https`. Anything else renders as inert
 * text, which is what keeps a lead from planting a live link in the owner's
 * inbox.
 */
function renderValue(field: LeadField): string {
  const escaped = escapeHtml(field.value);
  if (field.kind === 'url' && /^https?:\/\//i.test(field.value)) {
    const href = escapeHtml(field.value);
    return `<a href="${href}" style="color:#3b82f6;text-decoration:none;word-break:break-all" target="_blank" rel="noopener noreferrer nofollow">${escaped}</a>`;
  }
  if (field.kind === 'long') {
    return `<span style="white-space:pre-wrap;word-break:break-word">${escaped}</span>`;
  }
  return escaped;
}

function formatBrazilianDateTime(date: Date): string {
  try {
    return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return date.toISOString();
  }
}

function buildSubject(pageName: string, fields: LeadField[], submittedAt: Date): string {
  const leadEmail = extractLeadEmail(fields);
  const who = leadEmail ?? fields.find((f) => f.kind !== 'email')?.value ?? 'lead sem identificação';
  const whoShort = who.length > 48 ? `${who.slice(0, 45)}...` : who;
  return `Novo lead em "${pageName.slice(0, 60)}" — ${whoShort} (${formatBrazilianDateTime(submittedAt)})`;
}

function buildHtml(input: LeadNotificationInput, fields: LeadField[]): string {
  const rows = fields
    .map(
      (field) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;width:34%;vertical-align:top">
            ${escapeHtml(field.label)}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;vertical-align:top">
            ${renderValue(field)}
          </td>
        </tr>`
    )
    .join('');

  const metaRow = (label: string, value: string | null | undefined) =>
    value
      ? `<tr>
          <td style="padding:7px 14px;font-size:12px;color:#9ca3af;width:34%">${escapeHtml(label)}</td>
          <td style="padding:7px 14px;font-size:12px;color:#6b7280;word-break:break-all">${escapeHtml(value)}</td>
        </tr>`
      : '';

  const pageLink = input.pageUrl
    ? `<a href="${escapeHtml(input.pageUrl)}" style="color:#3b82f6;text-decoration:none">${escapeHtml(input.pageUrl)}</a>`
    : `<span style="color:#6b7280">${escapeHtml(input.pageName)}</span>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Novo lead</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
          <tr>
            <td style="background:#0b0f19;padding:22px 24px">
              <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8b93a7">Novo lead recebido</p>
              <h1 style="margin:8px 0 0;font-size:19px;color:#ffffff;font-weight:700">${escapeHtml(input.pageName)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td colspan="2" style="padding:16px 14px 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af">Dados preenchidos</td></tr>
                ${rows || '<tr><td style="padding:12px 14px;font-size:14px;color:#9ca3af">Nenhum campo preenchido.</td></tr>'}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0 0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-top:1px solid #e5e7eb">
                <tr><td colspan="2" style="padding:14px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af">Contexto</td></tr>
                ${metaRow('Página', input.pageUrl ?? input.pageName)}
                ${metaRow('Recebido em', formatBrazilianDateTime(input.submittedAt))}
                ${metaRow('IP', input.ip)}
                ${metaRow('Origem', input.referrer)}
                ${metaRow('Navegador', input.userAgent)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px">
              <a href="${escapeHtml(input.pageUrl ?? '#')}" style="display:inline-block;background:#0b0f19;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:9px;font-size:13px;font-weight:600">Ver leads na plataforma</a>
              <p style="margin:18px 0 0;font-size:11px;color:#9ca3af;line-height:1.6">
                Você recebe este e-mail porque é o dono da página. Para desligar as notificações,
                ajuste as preferências de notificação da sua conta.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function buildText(input: LeadNotificationInput, fields: LeadField[]): string {
  const lines = [
    `NOVO LEAD — ${input.pageName}`,
    formatBrazilianDateTime(input.submittedAt),
    '',
    'DADOS PREENCHIDOS',
    ...fields.map((field) => `  ${field.label}: ${field.value}`),
    '',
    'CONTEXTO',
    `  Página: ${input.pageUrl ?? input.pageName}`,
    `  IP: ${input.ip ?? '—'}`,
    `  Origem: ${input.referrer ?? '—'}`,
    `  Navegador: ${input.userAgent ?? '—'}`,
  ];
  return lines.join('\n');
}

/**
 * Sends the owner their lead.
 *
 * A notification failure never propagates to the caller: the submission is
 * already stored, and losing the row because a mail provider had a bad minute
 * would be the worst possible trade. The result is returned for logging.
 */
export async function sendLeadNotificationEmail(
  input: LeadNotificationInput
): Promise<LeadNotificationResult> {
  const fields = normalizeLeadFields(input.fields);
  const leadEmail = input.allowReplyTo === false ? null : extractLeadEmail(fields);

  if (!input.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
    return { success: false, error: 'Destinatário inválido ou ausente.' };
  }

  const result = await sendEmail({
    to: input.to,
    subject: buildSubject(input.pageName, fields, input.submittedAt),
    html: buildHtml(input, fields),
    text: buildText(input, fields),
    replyTo: leadEmail ?? undefined,
  });

  return { ...result, replyTo: leadEmail ?? undefined };
}
