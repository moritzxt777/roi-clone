/**
 * Network fingerprint primitives for the cloaker.
 *
 * Purpose: the previous engine could only regex User-Agent strings. It declared
 * a list of datacenter hostnames and never read it, so `filterDatacenters` was
 * a checkbox that did nothing. Ad-review crawlers and manual reviewers are not
 * distinguishable by UA alone — a Meta reviewer running a headful Chrome looks
 * exactly like a lead. The only reliable discriminator available at the edge is
 * the network: which ASN the request came from, and whether the reverse DNS
 * entry corroborates a claimed identity.
 *
 * Everything here is dependency-free and side-effect free except the resolver
 * helpers at the bottom, which are explicitly cached and time-bounded.
 */

const IPV4_BYTES = 4;
const IPV6_BYTES = 16;

export type IpFamily = 4 | 6;

/**
 * Parses an IPv4 or IPv6 literal.
 *
 * IPv4 yields 4 bytes and IPv6 yields 16, and the family is carried alongside,
 * because a single fixed-width representation does not work: an IPv4 address
 * mapped into `::ffff:a.b.c.d` puts its significant octets at bytes 12-15, so a
 * prefix comparison that starts at byte 0 reads only the zero prefix and every
 * address matches every IPv4 range. Keeping the native width and comparing the
 * family first removes that class of bug entirely.
 *
 * @param value - address literal, no brackets, no zone index, no port
 * @returns 4 or 16 bytes plus the family, or null when the input is not valid
 */
export function parseIp(value: string): { bytes: Uint8Array; family: IpFamily } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.includes(':') ? parseIpv6(trimmed) : parseIpv4(trimmed);
}

/** Convenience wrapper for callers that only need to know whether a literal parses. */
export function isValidIp(value: string): boolean {
  return parseIp(value) !== null;
}

function parseIpv4(value: string): { bytes: Uint8Array; family: IpFamily } | null {
  const parts = value.split('.');
  if (parts.length !== IPV4_BYTES) return null;

  const bytes = new Uint8Array(IPV4_BYTES);
  for (let i = 0; i < IPV4_BYTES; i++) {
    const part = parts[i];
    // Reject empty, non-numeric, leading-zero and out-of-range octets. Leading
    // zeros are how "010.0.0.1" sneaks past a naive parser and lands as octal.
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    bytes[i] = octet;
  }
  return { bytes, family: 4 };
}

function parseIpv6(value: string): { bytes: Uint8Array; family: IpFamily } | null {
  // Strip an optional zone index ("fe80::1%eth0") and any embedded IPv4 tail.
  const zoneFree = value.split('%')[0];

  const doubleColon = zoneFree.indexOf('::');
  if (doubleColon !== zoneFree.lastIndexOf('::')) return null;

  const headText = doubleColon === -1 ? zoneFree : zoneFree.slice(0, doubleColon);
  const tailText = doubleColon === -1 ? '' : zoneFree.slice(doubleColon + 2);

  const head = parseIpv6Groups(headText);
  const tail = doubleColon === -1 ? [] : parseIpv6Groups(tailText);
  if (head === null || tail === null) return null;

  const total = head.length + tail.length;
  if (doubleColon === -1) {
    if (total !== 8) return null;
    const bytes = new Uint8Array(IPV6_BYTES);
    head.forEach((group, index) => writeGroup(bytes, index, group));
    return { bytes, family: 6 };
  }
  if (total > 7) return null; // "::" must stand for at least one zero group

  const bytes = new Uint8Array(IPV6_BYTES);
  head.forEach((group, index) => writeGroup(bytes, index, group));
  tail.forEach((group, index) => writeGroup(bytes, head.length + index, group));
  return { bytes, family: 6 };
}

function parseIpv6Groups(text: string): number[] | null {
  if (!text) return [];

  const groups: number[] = [];
  for (const chunk of text.split(':')) {
    if (chunk.includes('.')) {
      // Embedded IPv4, only legal in the last position.
      if (chunk !== text.slice(text.lastIndexOf(':') + 1)) return null;
      const v4 = parseIpv4(chunk);
      if (!v4) return null;
      groups.push((v4.bytes[0] << 8) | v4.bytes[1], (v4.bytes[2] << 8) | v4.bytes[3]);
      continue;
    }
    if (!/^[0-9a-fA-F]{1,4}$/.test(chunk)) return null;
    groups.push(parseInt(chunk, 16));
  }
  return groups;
}

function writeGroup(bytes: Uint8Array, index: number, group: number) {
  bytes[index * 2] = (group >> 8) & 0xff;
  bytes[index * 2 + 1] = group & 0xff;
}

export interface CidrRange {
  /** Human-readable label surfaced in the block reason, e.g. "Meta/Facebook". */
  label: string;
  /** Canonical "a.b.c.d/nn" or IPv6 form. */
  cidr: string;
  family: IpFamily;
  network: Uint8Array;
  prefixBits: number;
}

/**
 * Compiles a CIDR list once. Parsing per request showed up in profiles above
 * ~200 entries; hoisting it to a frozen array reduces the check to a single
 * prefix-compare pass.
 */
export function compileCidrRanges(
  entries: ReadonlyArray<{ label: string; cidr: string }>
): CidrRange[] {
  const compiled: CidrRange[] = [];
  for (const { label, cidr } of entries) {
    const slash = cidr.lastIndexOf('/');
    const address = parseIp(slash === -1 ? cidr : cidr.slice(0, slash));
    if (!address) continue;

    const maxBits = address.family === 4 ? IPV4_BYTES * 8 : IPV6_BYTES * 8;
    const prefixBits = slash === -1 ? maxBits : Number(cidr.slice(slash + 1));
    if (!Number.isInteger(prefixBits) || prefixBits < 0 || prefixBits > maxBits) continue;

    compiled.push({
      label,
      cidr,
      family: address.family,
      network: maskToPrefix(address.bytes, prefixBits),
      prefixBits,
    });
  }
  return compiled;
}

/** Returns the first range containing `address`, or null. Families never cross. */
export function matchCidr(
  address: { bytes: Uint8Array; family: IpFamily },
  ranges: readonly CidrRange[]
): CidrRange | null {
  for (const range of ranges) {
    if (range.family !== address.family) continue;
    if (matchesPrefix(address.bytes, range.network, range.prefixBits)) return range;
  }
  return null;
}

export function matchesPrefix(
  address: Uint8Array,
  network: Uint8Array,
  prefixBits: number
): boolean {
  const wholeBytes = prefixBits >> 3;
  const spareBits = prefixBits & 7;

  for (let i = 0; i < wholeBytes; i++) {
    if (address[i] !== network[i]) return false;
  }
  if (spareBits === 0) return true;

  const mask = (0xff << (8 - spareBits)) & 0xff;
  return (address[wholeBytes] & mask) === (network[wholeBytes] & mask);
}

function maskToPrefix(address: Uint8Array, prefixBits: number): Uint8Array {
  const masked = new Uint8Array(address.length);
  masked.set(address.subarray(0, prefixBits >> 3), 0);
  const spareBits = prefixBits & 7;
  if (spareBits !== 0) {
    const mask = (0xff << (8 - spareBits)) & 0xff;
    masked[prefixBits >> 3] = address[prefixBits >> 3] & mask;
  }
  return masked;
}

/**
 * Trust boundary for client IP resolution.
 *
 * `x-forwarded-for` is attacker-controlled on any deployment that is not behind
 * a proxy which rewrites it. The old engine accepted it, which handed every
 * visitor a one-header bypass of the geo and datacenter filters. Only the
 * platform-managed headers are honoured, and a deployment declares which
 * platform header is authoritative.
 */
export type IpSource = 'cf-connecting-ip' | 'x-vercel-forwarded-for' | 'x-real-ip' | 'none';

const IP_HEADERS: ReadonlyArray<{ source: IpSource; header: string }> = [
  { source: 'cf-connecting-ip', header: 'cf-connecting-ip' },
  { source: 'x-vercel-forwarded-for', header: 'x-vercel-forwarded-for' },
  { source: 'x-real-ip', header: 'x-real-ip' },
];

/**
 * Resolves the client IP from trusted headers only.
 *
 * `x-forwarded-for` is intentionally absent from the list. When no trusted
 * header is present the result is `null`, which callers must treat as
 * "unverifiable" rather than "localhost" — the previous implementation fell
 * back to the literal string 127.0.0.1, which made every geo check pass.
 */
export function resolveClientIp(headers: Headers): { ip: string | null; source: IpSource } {
  for (const { source, header } of IP_HEADERS) {
    const raw = headers.get(header);
    if (!raw) continue;
    // Multi-value variants are a comma list; the platform appends the socket
    // peer last, so the leftmost entry is the closest thing to the origin.
    const candidate = raw.split(',')[0].trim();
    if (parseIp(candidate)) return { ip: candidate, source };
  }
  return { ip: null, source: 'none' };
}

export type ReverseDnsKind = 'verified-crawler' | 'datacenter' | 'residential' | 'unknown';

export interface ReverseDnsResult {
  ptr: string | null;
  kind: ReverseDnsKind;
}

/**
 * PTR names that a legitimate crawler must present. Google documents the
 * forward-confirmed reverse: a host claiming googlebot must resolve to a PTR
 * inside googlebot.com or google.com, and the forward lookup must resolve back.
 * Meta does not publish an equivalent list, so the match stays advisory.
 */
const VERIFIED_CRAWLER_PTR = [
  /\.googlebot\.com$/i,
  /\.google\.com$/i,
  /\.googleusercontent\.com$/i,
  /\.search\.google\.com$/i,
  /\.bing\.com$/i,
  /\.bytedance\.com$/i,
  /\.facebook\.com$/i,
  /\.meta\.com$/i,
];

const DATACENTER_PTR = [
  /\.compute\.amazonaws\.com$/i,
  /\.amazonaws\.com$/i,
  /\.googleusercontent\.com$/i,
  /\.cloudfront\.net$/i,
  /\.azure\.com$/i,
  /\.cloudapp\.net$/i,
  /\.digitalocean\.com$/i,
  /\.linode\.com$/i,
  /\.vultr\.com$/i,
  /\.hetzner\.com$/i,
  /\.ovh\.net$/i,
  /\.oracle\.com$/i,
  /\.leaseweb\.com$/i,
  /\.contabo\.net$/i,
];

export function classifyReverseDns(ptr: string | null): ReverseDnsKind {
  if (!ptr) return 'unknown';
  if (VERIFIED_CRAWLER_PTR.some((p) => p.test(ptr))) return 'verified-crawler';
  if (DATACENTER_PTR.some((p) => p.test(ptr))) return 'datacenter';
  return 'residential';
}

const ptrCache = new Map<string, { value: ReverseDnsResult; expiresAt: number }>();
const PTR_CACHE_TTL_MS = 15 * 60 * 1000;
const PTR_LOOKUP_BUDGET_MS = 250;

/**
 * Reverse-DNS lookup with a TTL cache and a hard wall-clock budget.
 *
 * `dns.promises.reverse` on a hostile resolver can hang past the request
 * lifetime; the race against a timer guarantees the cloaker never blocks on
 * DNS. A miss is cached as `unknown` for a shorter window so a transient
 * failure does not pin a stale verdict for fifteen minutes.
 */
export async function lookupReverseDns(
  ip: string
): Promise<ReverseDnsResult> {
  const cached = ptrCache.get(ip);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const missTtl = PTR_CACHE_TTL_MS / 5;
  let result: ReverseDnsResult = { ptr: null, kind: 'unknown' };

  try {
    const dns = await import('dns');
    const lookup = dns.promises.reverse(ip);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('ptr-timeout')), PTR_LOOKUP_BUDGET_MS)
    );
    const names = await Promise.race([lookup, timeout]);
    const ptr = names[0] ?? null;
    result = { ptr, kind: classifyReverseDns(ptr) };
  } catch {
    result = { ptr: null, kind: 'unknown' };
  }

  ptrCache.set(ip, {
    value: result,
    expiresAt: Date.now() + (result.kind === 'unknown' ? missTtl : PTR_CACHE_TTL_MS),
  });
  return result;
}

/** Test seam: drops cached PTR verdicts so suites never leak state between cases. */
export function __resetPtrCache() {
  ptrCache.clear();
}
