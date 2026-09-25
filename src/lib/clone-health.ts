/**
 * Clone health check.
 *
 * A cloned page is HTML that was correct at the moment it was copied and degrades
 * from there: an image on the origin goes down, a font 404s, a script pulls an
 * API call the origin no longer answers, CORS refuses a cross-origin fetch.
 * None of that shows up in the clone record — the page stays `PUBLISHED`, the
 * editor shows a normal-looking DOM, and the failure only appears in a browser.
 *
 * This module fetches the published clone and reports what a visitor would hit.
 * It is a report, not a fix: it names the broken request so the owner can decide
 * whether to mirror the asset, drop the script, or accept it.
 */

export type IssueSeverity = 'erro' | 'aviso' | 'ok';

export interface BrokenReference {
  kind: 'imagem' | 'fonte' | 'script' | 'stylesheet' | 'midia' | 'iframe' | 'outro';
  url: string;
  status: number | null;
  severity: IssueSeverity;
  detail: string;
}

export interface HealthReport {
  ok: boolean;
  /** Requests checked, deduplicated by URL. */
  checked: number;
  broken: number;
  warnings: number;
  /** Pointers to the original site that the clone still depends on. */
  externalOrigins: string[];
  externalCount: number;
  issues: BrokenReference[];
  /** Findings worth surfacing even when nothing 404s. */
  notes: string[];
}

const MAX_REQUESTS = 60;
const REQUEST_TIMEOUT_MS = 8000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

const RESOURCE_KINDS: Array<[RegExp, BrokenReference['kind']]> = [  [/\.(?:avif|webp|png|jpe?g|gif|svg|bmp|ico)(?:$|\?)/i, 'imagem'],
  [/\.(?:woff2?|ttf|otf|eot)(?:$|\?)/i, 'fonte'],
  [/\.(?:js|mjs)(?:$|\?)/i, 'script'],
  [/\.css(?:$|\?)/i, 'stylesheet'],
  [/\.(?:mp4|webm|mov|ogg|mp3|wav|m4v|avif)(?:$|\?)/i, 'midia'],
];

export interface HealthCheckInput {
  /** Absolute URL the clone is served from. */
  cloneUrl: string;
  /** The rendered HTML of the clone. */
  html: string;
  /** Origin of the site that was cloned, used to count external dependencies. */
  sourceOrigin?: string | null;
}

/**
 * One referenced resource, with enough context to decide whether it could be a
 * file worth mirroring.
 *
 * `embedded` is the field that matters downstream. An extensionless
 * `<img src="/render?id=123">` is an image behind a proxy and must be mirrored;
 * an extensionless `<script src="/bundle">` is a script and must not be probed.
 * Both are a bare `src`, so the tag name has to be part of the answer — which is
 * why this walks the DOM instead of regexing the markup.
 */
export interface AssetReference {
  url: string;
  attribute: 'src' | 'href' | 'srcset' | 'poster' | 'css';
  /** True when the reference is an embedded media/file slot, not a link target. */
  embedded: boolean;
}

const EMBEDDING_TAGS = new Set(['img', 'image', 'source', 'video', 'audio', 'embed', 'input', 'track']);

/** Attributes on an embedding tag that point at the file it plays. */
const EMBEDDING_ATTRIBUTES = new Set(['src', 'srcset', 'poster', 'href', 'data-src', 'data-href']);

export function collectAssetReferences(html: string): AssetReference[] {
  const found = new Map<string, AssetReference>();
  const $ = cheerio.load(html);

  const add = (url: string, attribute: AssetReference['attribute'], embedded: boolean) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('#')) return;
    if (found.has(trimmed)) return;
    // A URL seen once as embedded and once as a link target stays embedded:
    // the file is worth mirroring and the link is incidental.
    const existing = found.get(trimmed);
    if (existing) {
      if (embedded) existing.embedded = true;
      return;
    }
    found.set(trimmed, { url: trimmed, attribute, embedded });
  };

  $('*').each((_, element) => {
    const node = $(element);
    const tag = (element as { tagName?: string }).tagName?.toLowerCase() ?? '';
    const isEmbeddingTag = EMBEDDING_TAGS.has(tag);

    for (const attribute of Object.keys((element as Element).attribs ?? {})) {
      const lower = attribute.toLowerCase();
      const value = node.attr(attribute);
      if (!value) continue;

      const isSrcset = lower === 'srcset';
      const isKnown = isSrcset || lower === 'src' || lower === 'poster' || lower === 'href' || lower === 'data-src' || lower === 'data-href';
      if (!isKnown) continue;

      if (isSrcset) {
        for (const candidate of value.split(',')) {
          add(candidate.trim().split(/\s+/)[0] ?? '', 'srcset', isEmbeddingTag);
        }
        continue;
      }

      const attributeKind: AssetReference['attribute'] =
        lower === 'poster' ? 'poster' : lower === 'href' ? 'href' : 'src';

      add(value, attributeKind, isEmbeddingTag && EMBEDDING_ATTRIBUTES.has(lower));
    }
  });

  // Fonts and images referenced from CSS are invisible to an attribute scan, and
  // a `url()` in CSS is always a file.
  const cssUrlPattern = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = cssUrlPattern.exec(html)) !== null) {
    add(match[1], 'css', true);
  }

  return Array.from(found.values());
}

export function collectAssetUrls(html: string): string[] {
  return collectAssetReferences(html).map((reference) => reference.url);
}

function classify(url: string): BrokenReference['kind'] {
  for (const [pattern, kind] of RESOURCE_KINDS) {
    if (pattern.test(url)) return kind;
  }
  if (url.startsWith('//')) return 'outro';
  return 'outro';
}

function absolutise(url: string, base: string): string | null {
  try {
    return new URL(url, base).href;
  } catch {
    return null;
  }
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Probes every asset the clone references and reports what a visitor would hit.
 *
 * Only real HTTP requests are made, with a bounded count and a per-request
 * timeout, so this stays cheap enough to run from the dashboard on demand.
 * Nothing is stored and nothing is changed.
 */
export async function checkCloneHealth(input: HealthCheckInput): Promise<HealthReport> {
  const notes: string[] = [];
  const rawUrls = collectAssetUrls(input.html).slice(0, MAX_REQUESTS);

  const targets: Array<{ url: string; absolute: string }> = [];
  for (const url of rawUrls) {
    const absolute = absolutise(url, input.cloneUrl);
    if (!absolute) {
      notes.push(`URL inválida ignorada: ${url.slice(0, 120)}`);
      continue;
    }
    if (!/^https?:/i.test(absolute)) {
      notes.push(`Esquema não suportado, ignorado: ${absolute.slice(0, 120)}`);
      continue;
    }
    targets.push({ url, absolute });
  }

  const externalOrigins = new Set<string>();
  const cloneHost = hostnameOf(input.cloneUrl);
  const sourceHost = input.sourceOrigin ? hostnameOf(input.sourceOrigin) : null;

  for (const target of targets) {
    const host = hostnameOf(target.absolute);
    if (!host || host === cloneHost) continue;
    externalOrigins.add(host);
    if (sourceHost && host === sourceHost) continue;
  }

  const results = await Promise.all(
    targets.map(async (target) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(target.absolute, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        });
        return { target, status: response.status, ok: response.ok, error: null as string | null };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        return { target, status: null, ok: false, error: message };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const issues: BrokenReference[] = [];

  for (const result of results) {
    if (result.ok) continue;

    const isTimeout = result.error?.toLowerCase().includes('abort');
    issues.push({
      kind: classify(result.target.url),
      url: result.target.url,
      status: result.status,
      severity: 'erro',
      detail: isTimeout
        ? `tempo esgotado após ${REQUEST_TIMEOUT_MS}ms`
        : result.error
          ? `falha de rede: ${result.error.slice(0, 160)}`
          : `HTTP ${result.status}`,
    });
  }

  if (targets.length >= MAX_REQUESTS) {
    notes.push(`Verificação truncada em ${MAX_REQUESTS} recursos.`);
  }

  // A cross-origin dependency is not broken, but it is the single most common
  // reason a clone dies weeks later, so it is called out even on a clean run.
  const stillOnOrigin = sourceHost
    ? externalOrigins.size > 0 &&
      Array.from(externalOrigins).filter((host) => host === sourceHost).length > 0
    : false;

  if (stillOnOrigin) {
    notes.push(
      `A página ainda depende de ${sourceHost} para ${Array.from(externalOrigins).filter((h) => h === sourceHost).length} recurso(s). Se o site original sair do ar, esses recursos caem junto.`
    );
  }

  const externalCount = externalOrigins.size;
  if (externalCount > 0) {
    notes.push(`${externalCount} origem(ns) externa(s) referenciada(s): ${Array.from(externalOrigins).slice(0, 6).join(', ')}${externalCount > 6 ? '…' : ''}`);
  }

  if (issues.length === 0 && notes.length === 0) {
    notes.push('Nenhum problema encontrado: todos os recursos respondem.');
  }

  return {
    ok: issues.length === 0,
    checked: targets.length,
    broken: issues.length,
    warnings: notes.length,
    externalOrigins: Array.from(externalOrigins),
    externalCount,
    issues: issues.sort((a, b) => (a.status ?? 0) - (b.status ?? 0)).slice(0, 40),
    notes,
  };
}
