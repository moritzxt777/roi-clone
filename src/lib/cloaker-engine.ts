/**
 * Cloaker decision engine.
 *
 * `evaluateCloaker` is pure and synchronous: same inputs, same verdict, no I/O.
 * Network enrichment (reverse DNS) happens upstream in `cloaker-runtime` and
 * arrives as `NetworkSignals`, which keeps this function testable without DNS
 * and keeps a slow resolver off the request's critical path.
 *
 * Design rule that outranks everything else here: a false block costs a
 * conversion, a false pass costs one review. So ad-platform infrastructure is a
 * hard block (a lead never originates from 157.240.0.0/16), while "looks like
 * a datacenter" only blocks when a second signal agrees.
 */

import {
  compileCidrRanges,
  matchCidr,
  parseIp,
  type ReverseDnsKind,
  type IpSource,
} from './net-fingerprint';
import { AD_VERIFIER_NETWORKS, DATACENTER_NETWORKS } from './net-ranges';

const AD_VERIFIER_RANGES = compileCidrRanges(AD_VERIFIER_NETWORKS);
const DATACENTER_RANGES = compileCidrRanges(DATACENTER_NETWORKS);

export type CloakerAction = 'show_white' | 'redirect_white';
export type BlackAction = 'redirect' | 'iframe';
export type DeviceFilter = 'all' | 'mobile_only' | 'desktop_only';
export type BlockAction = CloakerAction | 'fallback_white';

export interface CloakerStats {
  totalHits: number;
  blackHits: number;
  whiteHits: number;
  lastHitAt?: string;
  lastBlockedReason?: string;
}

export interface CloakerConfig {
  enabled: boolean;
  isExternalOffer?: boolean;
  blackPageUrl?: string;
  blackAction?: BlackAction;
  whitePageUrl?: string;
  /** Inline white page. Preferred over proxying `whitePageUrl`: proxied HTML loses its assets. */
  whitePageHtml?: string;
  filterBots: boolean;
  filterDatacenters: boolean;
  /**
   * When true, a missing/unverifiable country header blocks instead of passing.
   * Defaults to true. The previous engine defaulted the country to "BR", which
   * silently disabled the geo filter on any deployment not behind Cloudflare.
   */
  geoFailClosed?: boolean;
  /** Consults reverse DNS. Adds ≤250ms on a cache miss, zero on a hit. */
  reverseDnsCheck?: boolean;
  /** Score at which accumulated soft signals tip into a block. Default 60. */
  suspicionThreshold?: number;
  allowedCountries: string[];
  deviceFilter: DeviceFilter;
  action: CloakerAction;
  stats?: CloakerStats;
}

export interface NetworkSignals {
  clientIp: string | null;
  ipSource: IpSource;
  ptr: string | null;
  ptrKind: ReverseDnsKind;
}

export type Verdict =
  | 'allow'
  | 'bot_user_agent'
  | 'suspicious_user_agent'
  | 'missing_user_agent'
  | 'ad_platform_network'
  | 'device_not_allowed'
  | 'country_not_allowed'
  | 'country_unverifiable'
  | 'suspicion_threshold';

export interface CloakerEvaluation {
  isBlocked: boolean;
  verdict: Verdict;
  reason?: string;
  clientIp: string | null;
  ipSource: IpSource;
  userAgent: string;
  country: string | null;
  isMobile: boolean;
  /** Populated only when the request is blocked, for the admin diagnostics panel. */
  signals: CloakerSignals;
}

export interface CloakerSignals {
  suspicionScore: number;
  datacenterNetwork: string | null;
  adPlatformNetwork: string | null;
  ptr: string | null;
  ptrKind: ReverseDnsKind;
  hasBrowserClientHints: boolean;
  isTopLevelNavigation: boolean;
  acceptsHtml: boolean;
  hasAcceptLanguage: boolean;
  matchedUserAgentPattern: string | null;
}

interface UserAgentRule {
  pattern: RegExp;
  label: string;
}

/**
 * Every entry is a name an ad platform or automation library puts in its own
 * User-Agent. Nothing here matches a shipping desktop or mobile browser, which
 * is the property that keeps the block list safe to run in front of real leads.
 */
const BOT_RULES: ReadonlyArray<UserAgentRule> = Object.freeze([
  // Meta
  { pattern: /facebookexternalhit/i, label: 'facebookexternalhit' },
  { pattern: /facebot/i, label: 'facebot' },
  { pattern: /facebookcatalog/i, label: 'facebookcatalog' },
  { pattern: /meta-externalagent/i, label: 'meta-externalagent' },
  { pattern: /meta-externalfetcher/i, label: 'meta-externalfetcher' },
  { pattern: /meta-aiagent/i, label: 'meta-aiagent' },
  { pattern: /instagram/i, label: 'instagram' },

  // Google
  { pattern: /googlebot/i, label: 'googlebot' },
  { pattern: /adsbot-google/i, label: 'adsbot-google' },
  { pattern: /mediapartners-google/i, label: 'mediapartners-google' },
  { pattern: /google-read-aloud/i, label: 'google-read-aloud' },
  { pattern: /google-inspectiontool/i, label: 'google-inspectiontool' },
  { pattern: /apis-google/i, label: 'apis-google' },
  { pattern: /feedfetcher-google/i, label: 'feedfetcher-google' },
  { pattern: /google-inspection/i, label: 'google-inspection' },

  // ByteDance / TikTok
  { pattern: /tiktokbot/i, label: 'tiktokbot' },
  { pattern: /bytespider/i, label: 'bytespider' },
  { pattern: /bytedance/i, label: 'bytedance' },
  { pattern: /pinterestbot/i, label: 'pinterestbot' },
  { pattern: /applebot/i, label: 'applebot' },

  // Microsoft / Yahoo / Yandex / Baidu
  { pattern: /bingbot/i, label: 'bingbot' },
  { pattern: /adidxbot/i, label: 'adidxbot' },
  { pattern: /slurp/i, label: 'yahoo-slurp' },
  { pattern: /duckduckbot/i, label: 'duckduckbot' },
  { pattern: /baiduspider/i, label: 'baiduspider' },
  { pattern: /yandexbot/i, label: 'yandexbot' },
  { pattern: /yandex(?:images|video|mobile|ads)/i, label: 'yandex' },
  { pattern: /seznambot/i, label: 'seznambot' },
  { pattern: /naverbot/i, label: 'naverbot' },
  { pattern: /ahrefsbot/i, label: 'ahrefsbot' },
  { pattern: /semrushbot/i, label: 'semrushbot' },
  { pattern: /mj12bot/i, label: 'mj12bot' },
  { pattern: /dotbot/i, label: 'dotbot' },
  { pattern: /rogerbot/i, label: 'rogerbot' },
  { pattern: /exabot/i, label: 'exabot' },
  { pattern: /ia_archiver/i, label: 'ia_archiver' },
  { pattern: /archive\.org_bot/i, label: 'archive.org_bot' },
  { pattern: /gptbot/i, label: 'gptbot' },
  { pattern: /claudebot/i, label: 'claudebot' },
  { pattern: /perplexitybot/i, label: 'perplexitybot' },
  { pattern: /ccbot/i, label: 'ccbot' },
]);

/**
 * Automation tooling and QA scanners. Separate from BOT_RULES because the
 * report differs and because a human running PageSpeed legitimately trips some
 * of these — see `isTopLevelNavigation` weighting in the suspicion score.
 */
const AUTOMATION_RULES: ReadonlyArray<UserAgentRule> = Object.freeze([
  { pattern: /headless/i, label: 'headless' },
  { pattern: /phantomjs/i, label: 'phantomjs' },
  { pattern: /puppeteer/i, label: 'puppeteer' },
  { pattern: /playwright/i, label: 'playwright' },
  { pattern: /selenium/i, label: 'selenium' },
  { pattern: /cypress/i, label: 'cypress' },
  { pattern: /screaming frog/i, label: 'screaming-frog' },
  { pattern: /lighthouse/i, label: 'lighthouse' },
  { pattern: /pagespeed/i, label: 'pagespeed' },
  { pattern: /curl/i, label: 'curl' },
  { pattern: /wget/i, label: 'wget' },
  { pattern: /python-requests/i, label: 'python-requests' },
  { pattern: /python-urllib/i, label: 'python-urllib' },
  { pattern: /aiohttp/i, label: 'aiohttp' },
  { pattern: /httpx/i, label: 'httpx' },
  { pattern: /postmanruntime/i, label: 'postman' },
  { pattern: /insomnia/i, label: 'insomnia' },
  { pattern: /axios/i, label: 'axios' },
  { pattern: /node-fetch/i, label: 'node-fetch' },
  { pattern: /go-http-client/i, label: 'go-http-client' },
  { pattern: /okhttp/i, label: 'okhttp' },
  { pattern: /java\/1\.[0-8]\./i, label: 'java-http' },
  { pattern: /^libwww-perl/i, label: 'libwww-perl' },
  { pattern: /scrapy/i, label: 'scrapy' },
  { pattern: /httpclient/i, label: 'httpclient' },
  { pattern: /wordpress|wp-http/i, label: 'wordpress' },
  { pattern: /validator|validator\.nu|whatsapp/i, label: 'link-validator' },
  { pattern: /preview|renderbot|phantom/i, label: 'preview-bot' },
  { pattern: /monitor|uptime|pingdom|statuscake/i, label: 'uptime-monitor' },
  { pattern: /checker|sitecheck|audit/i, label: 'site-audit' },
]);

export const DEFAULT_SUSPICION_THRESHOLD = 60;

export function evaluateCloaker(
  headers: Headers,
  config: CloakerConfig,
  network?: Partial<NetworkSignals>
): CloakerEvaluation {
  const userAgent = headers.get('user-agent') ?? '';
  const countryHeader =
    headers.get('cf-ipcountry') ??
    headers.get('x-vercel-ip-country') ??
    headers.get('x-country-code');
  const country = countryHeader ? countryHeader.toUpperCase() : null;
  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);

  const clientIp = network?.clientIp ?? null;
  const ipSource = network?.ipSource ?? 'none';
  const ptr = network?.ptr ?? null;
  const ptrKind = network?.ptrKind ?? 'unknown';

  const address = clientIp ? parseIp(clientIp) : null;
  const adPlatformHit = address ? matchCidr(address, AD_VERIFIER_RANGES) : null;
  const datacenterHit = address ? matchCidr(address, DATACENTER_RANGES) : null;
  const botMatch = config.filterBots ? matchUserAgent(userAgent, BOT_RULES) : null;
  const automationMatch = config.filterBots
    ? matchUserAgent(userAgent, AUTOMATION_RULES)
    : null;

  const hasBrowserClientHints =
    headers.get('sec-ch-ua') !== null || headers.get('sec-fetch-dest') !== null;
  const isTopLevelNavigation = headers.get('sec-fetch-mode') === 'navigate';
  const accept = headers.get('accept') ?? '';
  const acceptsHtml = /text\/html/i.test(accept);
  const hasAcceptLanguage = headers.get('accept-language') !== null;

  const signals: CloakerSignals = {
    suspicionScore: 0,
    datacenterNetwork: datacenterHit?.label ?? null,
    adPlatformNetwork: adPlatformHit?.label ?? null,
    ptr,
    ptrKind,
    hasBrowserClientHints,
    isTopLevelNavigation,
    acceptsHtml,
    hasAcceptLanguage,
    matchedUserAgentPattern: botMatch?.label ?? automationMatch?.label ?? null,
  };

  const allow = (): CloakerEvaluation => ({
    isBlocked: false,
    verdict: 'allow',
    clientIp,
    ipSource,
    userAgent,
    country,
    isMobile,
    signals,
  });

  if (!config.enabled) return allow();

  const block = (verdict: Verdict, reason: string): CloakerEvaluation => ({
    isBlocked: true,
    verdict,
    reason,
    clientIp,
    ipSource,
    userAgent,
    country,
    isMobile,
    signals,
  });

  if (config.filterBots) {
    if (!userAgent || userAgent.length < 10) {
      return block('missing_user_agent', 'User-Agent ausente ou curto demais para um navegador real');
    }
    if (botMatch) {
      return block('bot_user_agent', `Crawler de plataforma de anúncio: ${botMatch.label}`);
    }
  }

  // Hard block: a converting lead never originates from ad-platform space.
  if (adPlatformHit) {
    return block(
      'ad_platform_network',
      `Origem em infraestrutura de ${adPlatformHit.label} (${adPlatformHit.cidr})`
    );
  }

  if (config.filterBots && automationMatch) {
    return block(
      'suspicious_user_agent',
      `Automação ou auditoria automatizada: ${automationMatch.label}`
    );
  }

  if (config.deviceFilter === 'mobile_only' && !isMobile) {
    return block('device_not_allowed', 'Somente celular permitido; esta requisição não é mobile');
  }
  if (config.deviceFilter === 'desktop_only' && isMobile) {
    return block('device_not_allowed', 'Somente desktop permitido; esta requisição é mobile');
  }

  const geoResult = evaluateGeo(country, config);
  if (geoResult) {
    return block(
      geoResult.verdict,
      geoResult.verdict === 'country_unverifiable'
        ? 'Origem geográfica não verificável (header de país ausente) e filtro geo opera em fail-closed'
        : `País não autorizado: ${country}`
    );
  }

  if (config.filterDatacenters) {
    signals.suspicionScore = scoreSuspicion({
      datacenterNetwork: signals.datacenterNetwork,
      ptrKind,
      isClaimedBrowser: !botMatch && !automationMatch,
      hasBrowserClientHints,
      isTopLevelNavigation,
      acceptsHtml,
      hasAcceptLanguage,
    });
    const threshold = config.suspicionThreshold ?? DEFAULT_SUSPICION_THRESHOLD;
    if (signals.suspicionScore >= threshold) {
      return block(
        'suspicion_threshold',
        `Sinais acumulados=${signals.suspicionScore} (limite ${threshold}): ${describeSignals(signals)}`
      );
    }
  }

  return allow();
}

function evaluateGeo(
  country: string | null,
  config: CloakerConfig
): { verdict: Verdict } | null {
  const allowed = config.allowedCountries ?? [];
  if (allowed.length === 0) return null;

  // Cloudflare uses T1 for Tor and XX for "country unknown". Both are
  // deliberately not treated as the default country.
  if (!country || country === 'XX' || country === 'T1') {
    if (config.geoFailClosed === false) return null;
    return { verdict: 'country_unverifiable' };
  }
  return allowed.some((c) => c.toUpperCase() === country)
    ? null
    : { verdict: 'country_not_allowed' };
}

interface ScoreInput {
  datacenterNetwork: string | null;
  ptrKind: ReverseDnsKind;
  isClaimedBrowser: boolean;
  hasBrowserClientHints: boolean;
  isTopLevelNavigation: boolean;
  acceptsHtml: boolean;
  hasAcceptLanguage: boolean;
}

/**
 * Weighted soft signals. A single signal never reaches the threshold: a
 * datacenter IP alone scores 40, PTR alone 45, missing client hints alone 25.
 * Block requires at least two to agree, which is what keeps corporate VPNs and
 * CGNAT subscribers reachable.
 */
function scoreSuspicion(input: ScoreInput): number {
  let score = 0;
  if (input.datacenterNetwork) score += 40;
  if (input.ptrKind === 'datacenter') score += 45;

  // PTR claims a search crawler while the UA pretends to be a browser: a
  // reviewer with a spoofed header.
  if (input.ptrKind === 'verified-crawler' && input.isClaimedBrowser) score += 60;

  if (!input.hasBrowserClientHints) score += 25;
  if (!input.acceptsHtml) score += 15;
  if (!input.hasAcceptLanguage) score += 10;
  if (input.hasBrowserClientHints && !input.isTopLevelNavigation) score += 15;

  return score;
}

function describeSignals(signals: CloakerSignals): string {
  const parts: string[] = [];
  if (signals.datacenterNetwork) parts.push(`IP de datacenter (${signals.datacenterNetwork})`);
  if (signals.ptrKind === 'datacenter') parts.push(`PTR de datacenter (${signals.ptr})`);
  if (signals.ptrKind === 'verified-crawler' && signals.ptr) {
    parts.push(`PTR de crawler com UA de navegador (${signals.ptr})`);
  }
  if (!signals.hasBrowserClientHints) parts.push('sem client hints de navegador');
  if (!signals.acceptsHtml) parts.push('Accept sem text/html');
  if (!signals.hasAcceptLanguage) parts.push('sem Accept-Language');
  return parts.join(' + ') || 'nenhum detalhe';
}

function matchUserAgent(
  userAgent: string,
  rules: ReadonlyArray<UserAgentRule>
): UserAgentRule | null {
  for (const rule of rules) {
    if (rule.pattern.test(userAgent)) return rule;
  }
  return null;
}

export const DEFAULT_CLOAKER_CONFIG: CloakerConfig = {
  enabled: true,
  isExternalOffer: false,
  blackPageUrl: '',
  blackAction: 'redirect',
  whitePageUrl: '',
  whitePageHtml: '',
  filterBots: true,
  filterDatacenters: true,
  geoFailClosed: true,
  reverseDnsCheck: true,
  suspicionThreshold: DEFAULT_SUSPICION_THRESHOLD,
  allowedCountries: ['BR'],
  deviceFilter: 'all',
  action: 'show_white',
  stats: {
    totalHits: 0,
    blackHits: 0,
    whiteHits: 0,
  },
};

/**
 * Normalises a stored config onto the current shape. Persisted rows predate
 * several fields; without this merge a campaign saved last month evaluates with
 * `geoFailClosed` undefined, which falls to the fail-closed branch by design but
 * leaves the threshold and PTR switch unconfigured.
 */
export function withCloakerDefaults(stored: Partial<CloakerConfig> | null | undefined): CloakerConfig {
  return { ...DEFAULT_CLOAKER_CONFIG, ...(stored ?? {}) };
}

/**
 * Plain-JSON projection for the Prisma boundary.
 *
 * `CloakerConfig` is an interface, so it is not assignable to Prisma's
 * `InputJsonValue` — an interface has no index signature, and a type alias would
 * be one. Building the JSON shape field by field here makes the cast explicit
 * and total, instead of scattering `as any` at each call site and letting a new
 * field slip through unserialised.
 */
export type JsonPrimitive = string | number | boolean | null;
export type CloakerConfigJson = {
  [key: string]: JsonPrimitive | JsonPrimitive[] | CloakerConfigJson;
};

export function toCloakerJson(config: CloakerConfig): CloakerConfigJson {
  return {
    enabled: Boolean(config.enabled),
    isExternalOffer: Boolean(config.isExternalOffer),
    blackPageUrl: config.blackPageUrl ?? '',
    blackAction: config.blackAction === 'iframe' ? 'iframe' : 'redirect',
    whitePageUrl: config.whitePageUrl ?? '',
    whitePageHtml: config.whitePageHtml ?? '',
    filterBots: Boolean(config.filterBots),
    filterDatacenters: Boolean(config.filterDatacenters),
    geoFailClosed: config.geoFailClosed !== false,
    reverseDnsCheck: config.reverseDnsCheck !== false,
    suspicionThreshold: Number.isFinite(config.suspicionThreshold)
      ? Number(config.suspicionThreshold)
      : DEFAULT_SUSPICION_THRESHOLD,
    allowedCountries: Array.isArray(config.allowedCountries)
      ? config.allowedCountries.map((code) => String(code).toUpperCase())
      : [],
    deviceFilter: config.deviceFilter ?? 'all',
    action: config.action === 'redirect_white' ? 'redirect_white' : 'show_white',
  };
}

export function normalizeStats(stats: Partial<CloakerStats> | undefined): CloakerStats {
  return {
    totalHits: toCount(stats?.totalHits),
    blackHits: toCount(stats?.blackHits),
    whiteHits: toCount(stats?.whiteHits),
    ...(stats?.lastHitAt ? { lastHitAt: stats.lastHitAt } : {}),
    ...(stats?.lastBlockedReason ? { lastBlockedReason: stats.lastBlockedReason } : {}),
  };
}
function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
