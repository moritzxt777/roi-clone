/**
 * Asset mirroring for cloned pages.
 *
 * A cloned page hotlinks every image, font and video straight to the origin it
 * was copied from. That works on the day of the clone and degrades from there:
 * the origin reorganises its CDN path, drops a weight, blocks the datacenter the
 * clone is served from, or simply goes away, and the clone breaks with nothing in
 * its record to explain why.
 *
 * This module downloads the bytes once and hands back a local URL, so the page
 * stops depending on the origin. Three design points that cost something to get
 * right:
 *
 *   - The stored key is content-addressed, so the served URL is immutable. A
 *     long `Cache-Control: public, max-age=31536000, immutable` is then correct
 *     and a re-mirror of changed bytes produces a different URL rather than
 *     serving a stale cached copy forever.
 *
 *   - Caps are enforced during the walk, not after. A page with four hundred
 *     assets or one 40MB video is a storage decision, and a silent truncation
 *     would be a lie in the health report.
 *
 *   - Failures are recorded with a status rather than thrown. A clone that
 *     mirrors 90 of its 100 images and says so is useful; a clone that aborts
 *     because one asset 403'd is not.
 */

import { createHash } from 'crypto';
import { collectAssetReferences, collectAssetUrls } from './clone-health';

export const DEFAULT_MAX_ASSETS = 35;
export const DEFAULT_MAX_ASSET_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 3_500;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/** Path the serving route is mounted at. Kept in one place. */
export const ASSET_ROUTE_PREFIX = '/api/pages/assets';

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'application/font-woff2': 'woff2',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
};

/** Only these are mirrored. Scripts and stylesheets are deliberately excluded. */
const MIRRORABLE_TYPE = /^(image|font|video|audio)\//i;

export type AssetKind = 'imagem' | 'fonte' | 'midia' | 'script' | 'stylesheet' | 'outro';

export type AssetStatus = 'READY' | 'SKIPPED_TOO_LARGE' | 'FAILED' | 'SKIPPED_TYPE';

export interface StoredAsset {
  sourceUrl: string;
  storageKey: string;
  contentType: string;
  size: number;
  checksum: string;
  status: AssetStatus;
  error?: string;
}

export interface MirrorOptions {
  pageId: string;
  /** Absolute origin the clone is served from, used to build the local URL. */
  appOrigin: string;
  html: string;
  css?: string;
  maxAssets?: number;
  maxBytes?: number;
  /** Set false to skip the network entirely and only report what would be mirrored. */
  download?: boolean;
}

export interface MirrorReport {
  attempted: number;
  stored: number;
  skippedTooLarge: number;
  skippedType: number;
  failed: number;
  bytesStored: number;
  /** Source URL to local URL. Only for assets that actually stored. */
  replacements: Map<string, string>;
  /** Human-readable notes for the dashboard. */
  notes: string[];
}

/**
 * Picks the assets worth mirroring out of a document.
 *
 * The candidate set comes from the same collector the health check uses, so the
 * two always agree on what a page references. Origin-internal URLs are excluded:
 * a clone does not serve the original's own pages, so mirroring them would be
 * copying something that is not an asset.
 */
export function selectMirrorCandidates(
  html: string,
  css: string,
  sourceOrigin: string | null
): string[] {
  const combined = `${html}\n<style>${css ?? ''}</style>`;
  const references = collectAssetReferences(combined);

  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const reference of references) {
    let parsed: URL;
    try {
      parsed = new URL(reference.url, 'https://placeholder.invalid/');
    } catch {
      continue;
    }
    // Relative URLs land on the placeholder because no base has been applied
    // yet; the rewrite pass resolves them against the real origin later.
    if (parsed.hostname === 'placeholder.invalid') continue;

    const absolute = parsed.href;

    // A recognised extension is decisive on its own.
    if (MIRRORABLE_PATH.test(absolute)) {
      if (!seen.has(absolute)) {
        seen.add(absolute);
        candidates.push(absolute);
      }
      continue;
    }

    // Without one, the attribute decides. Image proxies and CDN endpoints
    // routinely serve an image from a path with no file extension
    // (`/render?id=123`), and filtering on the extension alone misses every one
    // of them. An embedded reference — `src`, `poster`, `srcset`, or a CSS
    // `url()` — is always a file, on any origin. Probing costs one request that
    // the content-type check then classifies, which is cheaper than losing the
    // image.
    const isEmbedded = reference.embedded;

    if (!isEmbedded) continue;

    if (seen.has(absolute)) continue;
    seen.add(absolute);
    candidates.push(absolute);
  }

  return candidates;
}

const MIRRORABLE_PATH = /\.(?:avif|webp|png|jpe?g|gif|svg|bmp|ico|woff2?|ttf|otf|eot|mp4|webm|mov|m4v|mp3|ogg|wav)(?:$|\?)/i;

function extensionFor(contentType: string, sourceUrl: string): string {
  const known = EXTENSION_BY_TYPE[contentType.toLowerCase().split(';')[0].trim()];
  if (known) return known;

  try {
    const path = new URL(sourceUrl).pathname;
    const match = /\.(avif|webp|png|jpe?g|gif|svg|bmp|ico|woff2?|ttf|otf|eot|mp4|webm|mov|m4v|mp3|ogg|wav)$/i.exec(path);
    if (match) return match[1].toLowerCase().replace('jpeg', 'jpg');
  } catch {
    // fall through
  }
  return 'bin';
}

/**
 * Content-addressed key.
 *
 * Hashing the bytes rather than the URL means re-running a mirror on an
 * unchanged page produces identical keys and does nothing, while a changed asset
 * lands on a new URL instead of being shadowed by a cached response.
 */
function storageKeyFor(checksum: string, extension: string): string {
  return `${checksum.slice(0, 32)}.${extension}`;
}

export function localUrlFor(appOrigin: string, storageKey: string): string {
  return `${appOrigin}${ASSET_ROUTE_PREFIX}/${storageKey}`;
}

/**
 * Copies a Buffer into a `Uint8Array` backed by a plain `ArrayBuffer`.
 *
 * Prisma's `Bytes` field is typed as `Uint8Array<ArrayBuffer>`, and a Node
 * `Buffer` is a `Uint8Array` view over a possibly shared pool, so the two are
 * not assignable. Copying once on the way in is cheaper than fighting the type
 * at three call sites, and it also detaches the bytes from the pool, which
 * matters because Prisma retains the view across the async write.
 */
export function toPrismaBytes(buffer: Buffer | Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(buffer.byteLength));
  out.set(buffer);
  return out;
}

/**
 * Downloads and stores every mirrorable asset, returning the URL map.
 *
 * Storage is injected so the caller owns the transaction and the module stays
 * testable without a database.
 */
export async function mirrorAssets(
  options: MirrorOptions,
  store: (asset: StoredAsset, bytes: Buffer) => Promise<void>
): Promise<MirrorReport> {
  const maxAssets = options.maxAssets ?? DEFAULT_MAX_ASSETS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_ASSET_BYTES;
  const download = options.download !== false;

  let sourceOrigin: string | null = null;
  try {
    // The first candidate's origin is the site being cloned; the caller passes
    // the real one, but a fallback keeps the selector working without it.
    const probe = collectAssetUrls(options.html)[0];
    if (probe && /^https?:/i.test(probe)) sourceOrigin = new URL(probe).origin;
  } catch {
    sourceOrigin = null;
  }

  const candidates = selectMirrorCandidates(options.html, options.css ?? '', sourceOrigin);

  const report: MirrorReport = {
    attempted: 0,
    stored: 0,
    skippedTooLarge: 0,
    skippedType: 0,
    failed: 0,
    bytesStored: 0,
    replacements: new Map(),
    notes: [],
  };

  if (candidates.length === 0) {
    report.notes.push('Nenhum recurso espelhável encontrado na página.');
    return report;
  }

  if (candidates.length > maxAssets) {
    report.notes.push(
      `${candidates.length} recursos encontrados; ${maxAssets} serão espelhados. Os demais continuam apontando para a origem.`
    );
  }

  const selected = candidates.slice(0, maxAssets);

  // Process assets in concurrent batches of 8:
  // drastically faster than sequential (from 50s down to 2-3s) while avoiding origin rate-limiting
  const CONCURRENCY = 8;
  for (let i = 0; i < selected.length; i += CONCURRENCY) {
    const chunk = selected.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (sourceUrl) => {
        report.attempted++;

        const result = await fetchAsset(sourceUrl, maxBytes);
        if (result.kind === 'skipped-type') {
          report.skippedType++;
          await store(
            {
              sourceUrl,
              storageKey: '',
              contentType: result.contentType,
              size: 0,
              checksum: '',
              status: 'SKIPPED_TYPE',
              error: `tipo não espelhável: ${result.contentType}`,
            },
            Buffer.alloc(0)
          ).catch(() => undefined);
          return;
        }
        if (result.kind === 'too-large') {
          report.skippedTooLarge++;
          await store(
            {
              sourceUrl,
              storageKey: '',
              contentType: result.contentType,
              size: result.size,
              checksum: '',
              status: 'SKIPPED_TOO_LARGE',
              error: `acima do limite de ${Math.round(maxBytes / 1024)}KB`,
            },
            Buffer.alloc(0)
          ).catch(() => undefined);
          return;
        }
        if (result.kind === 'failed') {
          report.failed++;
          await store(
            {
              sourceUrl,
              storageKey: '',
              contentType: result.contentType,
              size: 0,
              checksum: '',
              status: 'FAILED',
              error: result.error,
            },
            Buffer.alloc(0)
          ).catch(() => undefined);
          return;
        }

        if (!download) return;

        const bytes = result.bytes;
        const checksum = createHash('sha256').update(bytes).digest('hex');
        const extension = extensionFor(result.contentType, sourceUrl);
        const storageKey = storageKeyFor(checksum, extension);

        try {
          await store(
            {
              sourceUrl,
              storageKey,
              contentType: result.contentType,
              size: bytes.length,
              checksum,
              status: 'READY',
            },
            bytes
          );
        } catch (error) {
          report.failed++;
          return;
        }

        report.stored++;
        report.bytesStored += bytes.length;
        report.replacements.set(sourceUrl, localUrlFor(options.appOrigin, storageKey));
      })
    );
  }

  if (report.bytesStored > 0) {
    report.notes.push(
      `${report.stored} recurso(s) espelhado(s), ${(report.bytesStored / 1024 / 1024).toFixed(1)}MB no total.`
    );
  }
  if (report.failed > 0) report.notes.push(`${report.failed} recurso(s) falharam no download.`);
  if (report.skippedTooLarge > 0) report.notes.push(`${report.skippedTooLarge} acima do limite de tamanho.`);

  return report;
}

type FetchOutcome =
  | { kind: 'ok'; bytes: Buffer; contentType: string; size: number }
  | { kind: 'skipped-type'; contentType: string }
  | { kind: 'too-large'; contentType: string; size: number }
  | { kind: 'failed'; contentType: string; error: string };

/**
 * Fetches one asset, classifying the outcome instead of throwing.
 *
 * The content type is trusted over the URL extension: a CDN that serves
 * `image/webp` from a `.jpg` path is common, and mirroring it as a JPEG would
 * hand the browser bytes it cannot read.
 */
async function fetchAsset(url: string, maxBytes: number): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'image/*,font/*,video/*,audio/*,*/*;q=0.8' },
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    if (!response.ok) {
      return { kind: 'failed', contentType, error: `HTTP ${response.status}` };
    }
    if (!MIRRORABLE_TYPE.test(contentType)) {
      return { kind: 'skipped-type', contentType };
    }

    // Read the declared length first so an oversized asset is rejected without
    // pulling it into memory.
    const declared = Number(response.headers.get('content-length') ?? '0');
    if (declared > maxBytes) {
      return { kind: 'too-large', contentType, size: declared };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) {
      return { kind: 'too-large', contentType, size: buffer.length };
    }

    return { kind: 'ok', bytes: buffer, contentType, size: buffer.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erro desconhecido';
    const timedOut = message.toLowerCase().includes('abort');
    return {
      kind: 'failed',
      contentType: 'application/octet-stream',
      error: timedOut ? `tempo esgotado após ${REQUEST_TIMEOUT_MS}ms` : message.slice(0, 200),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// URL rewriting
// ---------------------------------------------------------------------------

/**
 * Replaces every mirrored URL in a document with its local equivalent.
 *
 * Both attribute values and CSS `url()` are handled, because a mirrored font
 * referenced from a stylesheet is invisible to an attribute pass and silently
 * stays on the origin otherwise.
 */
export function rewriteAssetUrls(
  documentHtml: string,
  replacements: Map<string, string>
): { html: string; replaced: number } {
  if (replacements.size === 0) return { html: documentHtml, replaced: 0 };

  let replaced = 0;
  let output = documentHtml;

  // Longest first, so a URL that is a prefix of another cannot shadow it.
  const ordered = Array.from(replacements.entries()).sort((a, b) => b[0].length - a[0].length);

  for (const [sourceUrl, localUrl] of ordered) {
    const escaped = sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'g');
    const matches = output.match(pattern);
    if (matches) {
      replaced += matches.length;
      output = output.replace(pattern, localUrl);
    }
  }

  return { html: output, replaced };
}
