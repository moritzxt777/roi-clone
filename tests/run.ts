/**
 * Test runner for the cloaker and camouflager engines.
 *
 * No test framework is installed in this project, so this is a self-contained
 * runner: `npm test`. Every case here exists because something was previously
 * wrong and needed a regression guard, or because a claim in the UI needed to be
 * measurable. The container and perceptual checks need ffmpeg/ffprobe and a real
 * browser and run as part of the same command, skipping loudly when the tool is
 * absent rather than passing silently.
 */

import { createHash } from 'crypto';
import { execFileSync, execFileSync as run } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import { computeMD5 } from '../src/lib/creative-camouflager';
import { parseIp, compileCidrRanges, matchCidr, resolveClientIp } from '../src/lib/net-fingerprint';
import { AD_VERIFIER_NETWORKS, DATACENTER_NETWORKS } from '../src/lib/net-ranges';
import {
  evaluateCloaker,
  DEFAULT_CLOAKER_CONFIG,
  withCloakerDefaults,
  toCloakerJson,
  type CloakerConfig,
} from '../src/lib/cloaker-engine';
import { detectVideoFormat, stripVideoMetadata } from '../src/lib/container-metadata';
import {
  dHashFromLuminance,
  dHashFromRgba,
  hammingDistance,
  MIN_EFFECTIVE_DISTANCE,
} from '../src/lib/perceptual-hash';

const TMP = join(process.cwd(), 'scratch', 'tests');
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed++;
    return;
  }
  failed++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function equal(name: string, actual: unknown, expected: unknown): void {
  check(name, Object.is(actual, expected), `esperado ${String(expected)}, obtido ${String(actual)}`);
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

function hasBinary(name: string): boolean {
  try {
    run(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------

section('MD5 — vetores canônicos do RFC 1321');
{
  const enc = (text: string) => new Uint8Array(Buffer.from(text, 'utf8'));
  const vectors: Array<[string, string]> = [
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['a', '0cc175b9c0f1b6a831c399e269772661'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['message digest', 'f96b697d7cb7938d525a2f31aaf161d0'],
    ['abcdefghijklmnopqrstuvwxyz', 'c3fcd3d76192e4007dfb496cca67e13b'],
    [
      '12345678901234567890123456789012345678901234567890123456789012345678901234567890',
      '57edf4a22be3c955ac49da2e2107b67a',
    ],
  ];
  for (const [input, expected] of vectors) {
    equal(`md5("${input.slice(0, 12)}")`, computeMD5(enc(input)), expected);
  }
}

section('MD5 — fronteiras de padding e binário contra crypto do Node');
{
  // 55/56/57 and 63/64/65 are where the length field forces an extra block.
  for (const size of [0, 1, 2, 55, 56, 57, 63, 64, 65, 119, 120, 121, 1000, 65536, 100000]) {
    const buffer = new Uint8Array(size);
    for (let i = 0; i < size; i++) buffer[i] = (i * 37 + 11) & 0xff;
    const mine = computeMD5(buffer);
    const reference = createHash('md5').update(Buffer.from(buffer)).digest('hex');
    equal(`md5 binário ${size} bytes`, mine, reference);
  }
}

// ---------------------------------------------------------------------------

section('Parsing de IP');
{
  const cases: Array<[string, boolean]> = [
    ['8.8.8.8', true],
    ['0.0.0.0', true],
    ['255.255.255.255', true],
    ['1.2.3', false],
    ['1.2.3.4.5', false],
    ['256.1.1.1', false],
    ['01.2.3.4', false], // leading zero: octal smuggling
    ['1.2.3.-1', false],
    ['not-an-ip', false],
    ['', false],
    ['::1', true],
    ['2001:db8::1', true],
    ['2001:0db8:0000:0000:0000:0000:0000:0001', true],
    ['::ffff:8.8.8.8', true],
    ['2001:db8::1::2', false], // two :: is illegal
    ['2001:db8:::1', false],
    ['fe80::1%eth0', true], // zone index stripped
  ];
  for (const [input, valid] of cases) {
    equal(`parseIp(${JSON.stringify(input)})`, parseIp(input) !== null, valid);
  }
}

section('CIDR — compilação e casamento');
{
  const ranges = compileCidrRanges([
    { label: 'Meta', cidr: '157.240.0.0/16' },
    { label: 'Meta', cidr: '31.13.64.0/18' },
    { label: 'Cloud', cidr: '52.0.0.0/11' },
  ]);

  const inside = (ip: string) => matchCidr(parseIp(ip)!, ranges)?.label ?? null;
  equal('157.240.1.1 em 157.240.0.0/16', inside('157.240.1.1'), 'Meta');
  equal('157.241.1.1 fora do /16', inside('157.241.1.1'), null);
  equal('31.13.70.1 em 31.13.64.0/18', inside('31.13.70.1'), 'Meta');
  equal('31.13.63.255 fora do /18', inside('31.13.63.255'), null);
  // 52.0.0.0/11 spans 52.0-52.31; 52.95 falls in a different block.
  equal('52.10.1.1 em 52.0.0.0/11', inside('52.10.1.1'), 'Cloud');
  equal('52.95.1.1 fora de 52.0.0.0/11', inside('52.95.1.1'), null);
  equal('54.239.28.85 (AWS real) fora da lista local', inside('54.239.28.85'), null);
  equal('20.128.5.1 fora da lista local', inside('20.128.5.1'), null);
}

section('CIDR — IPv6 não casa com faixa IPv4');
{
  const ranges = compileCidrRanges([{ label: 'V4', cidr: '0.0.0.0/0' }]);
  const v6 = parseIp('::1')!;
  equal('endereço IPv6 é ignorado por faixa IPv4', matchCidr(v6, ranges), null);
  equal('endereço IPv4 casa', matchCidr(parseIp('8.8.8.8')!, ranges)?.label, 'V4');
}

section('CIDR — faixas de anúncio reais do catálogo');
{
  const adRanges = compileCidrRanges(AD_VERIFIER_NETWORKS);
  const dcRanges = compileCidrRanges(DATACENTER_NETWORKS);
  const ad = (ip: string) => matchCidr(parseIp(ip)!, adRanges)?.label ?? null;
  const dc = (ip: string) => matchCidr(parseIp(ip)!, dcRanges)?.label ?? null;

  equal('157.240.1.1 é Meta', ad('157.240.1.1'), 'Meta/Facebook');
  equal('31.13.24.5 é Meta', ad('31.13.24.5'), 'Meta/Facebook');
  equal('173.252.70.1 é Meta', ad('173.252.70.1'), 'Meta/Facebook');
  equal('66.249.72.1 é Google', ad('66.249.72.1'), 'Google');
  equal('157.55.0.1 é Microsoft/Bing', ad('157.55.0.1'), 'Microsoft/Bing');
  equal('189.45.20.10 (BR residencial) não é rede de anúncio', ad('189.45.20.10'), null);
  equal('200.160.2.3 (BR residencial) não é rede de anúncio', ad('200.160.2.3'), null);

  equal('54.239.28.85 é AWS', dc('54.239.28.85'), 'AWS');
  equal('52.95.1.1 é AWS', dc('52.95.1.1'), 'AWS');
  equal('20.190.128.5 é Azure', dc('20.190.128.5'), 'Azure');
  equal('104.131.1.1 é DigitalOcean', dc('104.131.1.1'), 'DigitalOcean');
  equal('5.9.1.1 é Hetzner', dc('5.9.1.1'), 'Hetzner');
  equal('189.45.20.10 não é datacenter', dc('189.45.20.10'), null);
}

section('Resolução de IP — header confiável e header forjável');
{
  const spoofed = new Headers({
    'x-forwarded-for': '189.45.20.10, 66.220.144.0',
    'user-agent': 'x',
  });
  equal(
    'x-forwarded-for é ignorado',
    resolveClientIp(spoofed).ip,
    null
  );

  const viaCloudflare = new Headers({ 'cf-connecting-ip': '189.45.20.10' });
  equal('cf-connecting-ip é aceito', resolveClientIp(viaCloudflare).ip, '189.45.20.10');
  equal('fonte declarada', resolveClientIp(viaCloudflare).source, 'cf-connecting-ip');

  const none = new Headers({ 'user-agent': 'x' });
  equal('sem header confiável devolve null, não 127.0.0.1', resolveClientIp(none).ip, null);
}

// ---------------------------------------------------------------------------

const CHROME_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CHROME_MOBILE =
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const BROWSER_HEADERS = {
  'sec-ch-ua': '"Chromium";v="124", "Not:A-Brand";v="99"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
  // The geo filter is fail-closed, so a realistic browser request has to carry
  // its country the way Cloudflare or Vercel would supply it.
  'cf-ipcountry': 'BR',
};

function headers(overrides: Record<string, string>): Headers {
  return new Headers({ ...BROWSER_HEADERS, ...overrides });
}

function signals(ip: string | null, ptr: string | null = null, ptrKind: 'verified-crawler' | 'datacenter' | 'residential' | 'unknown' = 'unknown') {
  return {
    clientIp: ip,
    ipSource: ip ? ('cf-connecting-ip' as const) : ('none' as const),
    ptr,
    ptrKind,
  };
}

section('Cloaker — crawlers de plataforma de anúncio');
{
  const config = withCloakerDefaults({});
  const cases: Array<[string, string]> = [
    ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['meta-externalagent', 'meta-externalagent/1.1'],
    ['adsbot-google', 'AdsBot-Google-Mobile'],
    ['googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['tiktokbot', 'bytespider'],
    ['bingbot', 'bingbot/2.0'],
  ];
  for (const [label, ua] of cases) {
    const result = evaluateCloaker(headers({ 'user-agent': ua }), config, signals('189.45.20.10'));
    check(`bloqueia ${label}`, result.isBlocked, `verdict=${result.verdict}`);
  }
}

section('Cloaker — leads reais não são bloqueados');
{
  const config = withCloakerDefaults({});
  const lead = evaluateCloaker(headers({ 'user-agent': CHROME_DESKTOP }), config, signals('189.45.20.10'));
  check('lead desktop liberado', !lead.isBlocked, `verdict=${lead.verdict} reason=${lead.reason}`);

  const mobile = evaluateCloaker(headers({ 'user-agent': CHROME_MOBILE }), config, signals('189.45.20.10'));
  check('lead mobile liberado', !mobile.isBlocked, `verdict=${mobile.verdict}`);
}

section('Cloaker — infraestrutura de anúncio é bloqueio duro');
{
  const config = withCloakerDefaults({});
  // Um revisor com UA de Chrome vindo do espaço da Meta.
  const reviewer = evaluateCloaker(
    headers({ 'user-agent': CHROME_DESKTOP }),
    config,
    signals('157.240.1.1', 'facebookexternalhit.com', 'verified-crawler')
  );
  check('revisor com IP da Meta e UA de Chrome é bloqueado', reviewer.isBlocked, `verdict=${reviewer.verdict}`);
  equal('verdict correto', reviewer.verdict, 'ad_platform_network');

  const google = evaluateCloaker(headers({ 'user-agent': CHROME_DESKTOP }), config, signals('66.249.72.1'));
  check('IP do Google é bloqueado', google.isBlocked);
}

section('Cloaker — datacenter só bloqueia com sinal corroborado');
{
  const config = withCloakerDefaults({});

  // IP de cloud, mas PTR residencial: passa. É o caso de VPN corporativa e CGNAT,
  // e é exatamente o falso positivo que a pontuação evita.
  const vpn = evaluateCloaker(
    headers({ 'user-agent': CHROME_DESKTOP }),
    config,
    signals('54.239.28.85', 'ec2-1-2-3-4.compute-1.amazonaws.com', 'residential')
  );
  check(
    'VPN corporativa dentro de faixa AWS com sinais de navegador passa',
    !vpn.isBlocked,
    `score=${vpn.signals.suspicionScore} verdict=${vpn.verdict}`
  );

  // IP de cloud + PTR de datacenter: dois sinais concordando, então bloqueia.
  const cloudVisitor = evaluateCloaker(
    headers({ 'user-agent': CHROME_DESKTOP }),
    config,
    signals('52.95.1.1', 'ec2-1-2-3-4.compute-1.amazonaws.com', 'datacenter')
  );
  check('IP e PTR de datacenter juntos bloqueiam', cloudVisitor.isBlocked, `score=${cloudVisitor.signals.suspicionScore}`);
  check(
    'a pontuação somou os dois sinais',
    cloudVisitor.signals.suspicionScore >= 60,
    `score=${cloudVisitor.signals.suspicionScore}`
  );

  // IP de cloud, PTR de datacenter, mas sem nenhum sinal de navegador: bloqueia.
  const scraper = evaluateCloaker(
    new Headers({ 'user-agent': 'python-requests/2.31.0' }),
    config,
    signals('52.95.1.1', 'ec2-1-2-3-4.compute-1.amazonaws.com', 'datacenter')
  );
  check('scraper em datacenter é bloqueado', scraper.isBlocked, `verdict=${scraper.verdict}`);

  // PTR de crawler com UA de navegador é a assinatura de revisor com header forjado.
  const spoofedCrawler = evaluateCloaker(
    headers({ 'user-agent': CHROME_DESKTOP }),
    config,
    signals('189.45.20.10', 'googlebot.googlebot.com', 'verified-crawler')
  );
  check('PTR de crawler com UA de navegador é bloqueado', spoofedCrawler.isBlocked, `verdict=${spoofedCrawler.verdict}`);
  equal('verdict de sinal acumulado', spoofedCrawler.verdict, 'suspicion_threshold');
}

section('Cloaker — bypass por header forjado deixou de existir');
{
  const config = withCloakerDefaults({});
  const spoofedGeo = evaluateCloaker(
    new Headers({ 'user-agent': 'facebookexternalhit/1.1', 'x-country-code': 'BR' }),
    config,
    signals(null)
  );
  check(
    'UA de robô com x-country-code forjado ainda é bloqueado',
    spoofedGeo.isBlocked,
    `verdict=${spoofedGeo.verdict}`
  );
}

section('Cloaker — filtro geográfico opera em fail-closed');
{
  const config = withCloakerDefaults({});
  const noCountry = evaluateCloaker(
    new Headers({ 'user-agent': CHROME_DESKTOP }),
    config,
    signals('189.45.20.10')
  );
  check(
    'sem header de país, o lead é bloqueado em vez de liberado',
    noCountry.isBlocked,
    `verdict=${noCountry.verdict}`
  );
  equal('verdict de país', noCountry.verdict, 'country_unverifiable');

  const torExit = evaluateCloaker(
    new Headers({ 'user-agent': CHROME_DESKTOP, 'cf-ipcountry': 'T1' }),
    config,
    signals('189.45.20.10')
  );
  check('saída Tor (T1) é bloqueada', torExit.isBlocked);

  const brazilian = evaluateCloaker(
    new Headers({ 'user-agent': CHROME_DESKTOP, 'cf-ipcountry': 'BR' }),
    config,
    signals('189.45.20.10')
  );
  check('lead brasileiro é liberado', !brazilian.isBlocked);

  const american = evaluateCloaker(
    new Headers({ 'user-agent': CHROME_DESKTOP, 'cf-ipcountry': 'US' }),
    config,
    signals('8.8.8.8')
  );
  check('lead americano é bloqueado', american.isBlocked);
  equal('verdict de país não autorizado', american.verdict, 'country_not_allowed');
}

section('Cloaker — dispositivo');
{
  const mobileOnly = withCloakerDefaults({ deviceFilter: 'mobile_only' });
  check(
    'desktop barrado em mobile_only',
    evaluateCloaker(
      new Headers({ 'user-agent': CHROME_DESKTOP, 'cf-ipcountry': 'BR' }),
      mobileOnly,
      signals('189.45.20.10')
    ).isBlocked
  );
  check(
    'mobile passa em mobile_only',
    !evaluateCloaker(
      new Headers({ 'user-agent': CHROME_MOBILE, 'cf-ipcountry': 'BR' }),
      mobileOnly,
      signals('189.45.20.10')
    ).isBlocked
  );
}

section('Cloaker — normalização de config salva há meses');
{
  const stored = { enabled: true, blackPageUrl: 'https://kiwify.app/x', filterBots: true, allowedCountries: ['br'] } as CloakerConfig;
  const merged = withCloakerDefaults(stored);
  equal('geoFailClosed herdado', merged.geoFailClosed, true);
  equal('reverseDnsCheck herdado', merged.reverseDnsCheck, true);
  equal('threshold herdado', merged.suspicionThreshold, DEFAULT_CLOAKER_CONFIG.suspicionThreshold);
  equal('deviceFilter herdado', merged.deviceFilter, 'all');
  equal('action herdado', merged.action, 'show_white');

  const json = toCloakerJson(merged);
  const countries = json.allowedCountries;
  check(
    'JSON projeta countries em caixa alta',
    Array.isArray(countries) && countries.every((code) => typeof code === 'string' && code === code.toUpperCase())
  );
  check('JSON de null vira string vazia, não undefined', typeof json.whitePageHtml === 'string');
}

// ---------------------------------------------------------------------------

section('dHash — propriedades');
{
  // The gate runs on a 33x32 grid: 32 bits per row, 32 rows, 1024 bits. A 9x8
  // grid was measured to be useless here — a plain re-encode with no mutation
  // moved it as much as an actual mutation, so "unchanged" carried no signal.
  const uniform = new Uint8Array(33 * 32).fill(128);
  const flat = dHashFromLuminance(uniform, 33, 32);
  equal('superfície uniforme gera hash trivial', flat.hex, '0'.repeat(256));
  equal('hash tem 1024 bits', flat.bits, 1024);
  equal('hex tem 256 caracteres', flat.hex.length, 256);
  equal('hash uniforme tem distância 0 de si mesmo', hammingDistance(flat, flat), 0);

  const ascending = new Uint8Array(33 * 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 33; x++) ascending[y * 33 + x] = x * 7;
  }
  const ramp = dHashFromLuminance(ascending, 33, 32);
  // A ramp that brightens left to right never satisfies "left > right", so every
  // bit is zero. The mirrored ramp sets all 1024.
  equal('rampa ascendente tem todos os bits zerados', ramp.hex, '0'.repeat(256));

  const descending = new Uint8Array(33 * 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 33; x++) descending[y * 33 + x] = 255 - x * 7;
  }
  equal('rampa descendente tem todos os bits setados', dHashFromLuminance(descending, 33, 32).hex, 'f'.repeat(256));

  // The property the camouflager depends on: magnifying then cropping back
  // changes the sampling phase and must move the hash.
  //
  // The fixture has to contain edges. A perfectly linear ramp shifted by one cell
  // is still a linear ramp, so every adjacent-cell comparison returns the same
  // bit and the distance is legitimately zero — which is exactly why the
  // camuflador's own fixtures are structured images, not gradients.
  const edged = new Uint8Array(33 * 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 33; x++) {
      // Vertical edges every four cells, plus a horizontal one.
      const vertical = Math.floor(x / 4) % 2 === 0 ? 210 : 40;
      const horizontal = Math.floor(y / 5) % 2 === 0 ? vertical : Math.min(255, vertical + 25);
      edged[y * 33 + x] = horizontal;
    }
  }
  const edgeHash = dHashFromLuminance(edged, 33, 32);
  const shifted = new Uint8Array(edged);
  for (let y = 0; y < 32; y++) {
    for (let x = 32; x > 0; x--) shifted[y * 33 + x] = edged[y * 33 + x - 1];
  }
  const shiftDistance = hammingDistance(edgeHash, dHashFromLuminance(shifted, 33, 32));
  check(
    'deslocar uma imagem com bordas de 1 célula move o hash',
    shiftDistance >= MIN_EFFECTIVE_DISTANCE,
    `distância=${shiftDistance}, piso=${MIN_EFFECTIVE_DISTANCE}`
  );

  // An offset uniform brightness is the case the old implementation relied on:
  // it cancels out of a pairwise comparison entirely.
  const brightened = new Uint8Array(ascending);
  for (let i = 0; i < brightened.length; i++) brightened[i] = Math.min(255, brightened[i] + 20);
  equal(
    'brilho uniforme não move o hash (por isso não funciona sozinho)',
    hammingDistance(ramp, dHashFromLuminance(brightened, 33, 32)),
    0
  );

  const rgba = new Uint8ClampedArray(256 * 256 * 4);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      rgba[i] = (x * 7) & 0xff;
      rgba[i + 1] = (y * 5) & 0xff;
      rgba[i + 2] = ((x ^ y) * 3) & 0xff;
      rgba[i + 3] = 255;
    }
  }
  const fromPixels = dHashFromRgba(rgba, 256, 256);
  equal('dHashFromRgba produz 1024 bits', fromPixels.bits, 1024);
  check('piso efetivo é pequeno em relação ao total', MIN_EFFECTIVE_DISTANCE < 1024 * 0.05,
    `piso=${MIN_EFFECTIVE_DISTANCE}`);
  check('piso efetivo é positivo', MIN_EFFECTIVE_DISTANCE > 0);
}

// ---------------------------------------------------------------------------

section('Container — invariantes de tamanho e remoção de metadados');
if (!hasBinary('ffprobe') || !hasBinary('ffmpeg')) {
  skipped++;
  console.log('  \x1b[33mffmpeg/ffprobe ausente — casos de container pulados\x1b[0m');
} else {
  const fixtures: Array<{ name: string; make: string[] }> = [
    {
      name: 'mp4',
      make: [
        '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15:duration=2',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        '-metadata', 'creation_time=2024-03-11T14:22:33Z',
        '-metadata', 'location=+47.3769+008.5417/',
        '-metadata', 'comment=GPS_TRACKER_TEST',
      ],
    },
    {
      name: 'mov',
      make: [
        '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15:duration=2',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
        '-metadata', 'creation_time=2021-07-04T09:12:00Z',
        '-metadata', 'location=-23.5505-046.6333/',
      ],
    },
    {
      name: 'webm',
      make: [
        '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=15:duration=2',
        '-c:v', 'libvpx-vp9', '-b:v', '200k',
        '-metadata', 'creation_time=2024-01-02T03:04:05Z',
        '-metadata', 'title=WebM Test',
      ],
    },
  ];

  for (const fixture of fixtures) {
    const ext = fixture.name === 'mov' ? '.mov' : `.${fixture.name}`;
    const source = join(TMP, `src${ext}`);
    const stripped = join(TMP, `out${ext}`);

    try {
      execFileSync('ffmpeg', ['-y', '-v', 'error', ...fixture.make, source], { stdio: 'ignore' });
    } catch {
      skipped++;
      console.log(`  \x1b[33mfixture ${fixture.name} não pôde ser gerado — pulado\x1b[0m`);
      continue;
    }

    const input = new Uint8Array(readFileSync(source));
    const result = stripVideoMetadata(input);
    writeFileSync(stripped, result.bytes);

    check(`${fixture.name}: container reconhecido`, result.parsed, `format=${result.format}`);
    check(`${fixture.name}: alguma remoção ocorreu`, result.removed.length > 0);

    if (result.format === 'mp4') {
      // A invariante que impede arquivos corrompidos: tamanho idêntico, para
      // que nenhum stco/co64 aponte para o byte errado.
      equal(`${fixture.name}: tamanho preservado byte a byte`, result.bytes.length, input.length);
    }

    const probe = (file: string) =>
      run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:format_tags', '-of', 'json', file], {
        encoding: 'utf8',
      });

    const before = JSON.parse(probe(source)) as { format: { duration?: string; tags?: Record<string, string> } };
    const after = JSON.parse(probe(stripped)) as { format: { duration?: string; tags?: Record<string, string> } };

    const beforeTags = JSON.stringify(before.format.tags ?? {});
    const afterTags = JSON.stringify(after.format.tags ?? {});
    check(`${fixture.name}: creation_time removido`, !afterTags.includes('creation_time'), afterTags);
    check(`${fixture.name}: GPS removido`, !afterTags.includes('47.3769') && !afterTags.includes('23.5505'), afterTags);
    check(`${fixture.name}: comentário de rastreio removido`, !afterTags.includes('GPS_TRACKER_TEST'), afterTags);
    check(`${fixture.name}: title removido`, !afterTags.includes('WebM Test') && !afterTags.includes('Oferta'), afterTags);
    check(`${fixture.name}: o original realmente tinha metadado`, beforeTags !== '{}', beforeTags);
    equal(`${fixture.name}: duração preservada`, after.format.duration, before.format.duration);

    // Decodificação completa: o arquivo tem de continuar reproduzindo.
    try {
      run('ffmpeg', ['-v', 'error', '-i', stripped, '-f', 'null', '-'], { stdio: 'pipe' });
      check(`${fixture.name}: decodifica sem erro`, true);
    } catch (error) {
      const message = String((error as { stderr?: Buffer }).stderr ?? '');
      check(`${fixture.name}: decodifica sem erro`, false, message.slice(0, 200));
    }

    // Pixels idênticos: a neutralização não pode tocar na carga útil.
    const frameHash = (file: string) => {
      const raw = join(TMP, `frame-${fixture.name}.gray`);
      run('ffmpeg', ['-v', 'error', '-ss', '1', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', '64x64', raw, '-y'], { stdio: 'ignore' });
      return createHash('sha256').update(readFileSync(raw)).digest('hex');
    };
    equal(`${fixture.name}: pixels bit a bit idênticos`, frameHash(stripped), frameHash(source));

    equal(`${fixture.name}: detecção de formato`, detectVideoFormat(input), result.format);
  }
}

// ---------------------------------------------------------------------------

section('Container — arquivo não suportado é devolvido intacto');
{
  const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const result = stripVideoMetadata(junk);
  equal('formato desconhecido', result.format, 'unknown');
  check('nada foi alterado', !result.changed);
  equal('bytes preservados', result.bytes.length, junk.length);
}

// ---------------------------------------------------------------------------

section('Resultado');
console.log(`  \x1b[32mpassou: ${passed}\x1b[0m   \x1b[31mfalhou: ${failed}\x1b[0m   \x1b[33mpulado: ${skipped}\x1b[0m`);
if (failures.length > 0) {
  console.log('\n\x1b[31mFalhas:\x1b[0m');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
process.exit(0);
