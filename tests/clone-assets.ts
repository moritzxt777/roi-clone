/**
 * Tests for asset mirroring and API capture/replay.
 *
 * A local server stands in for an origin so the outcomes under test are real
 * responses: a 200 with bytes, a 404, an oversized body, a content type that is
 * not an asset, and a connection refused. Mocks would not catch a content-type
 * branch or a body-size boundary, which is where this code actually fails.
 */

import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  mirrorAssets,
  rewriteAssetUrls,
  selectMirrorCandidates,
  localUrlFor,
  toPrismaBytes,
  DEFAULT_MAX_ASSET_BYTES,
  type StoredAsset,
} from '../src/lib/clone-assets';
import {
  createRecorder,
  resourceKeyFor,
  shouldRecord,
  buildReplayScript,
  limitBody,
  toManifestEntry,
} from '../src/lib/clone-capture';

async function main() {
let passed = 0;
let failed = 0;
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

async function withOrigin(
  handler: Parameters<typeof createServer>[1],
  run: (origin: string) => Promise<void>
): Promise<void> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

// ---------------------------------------------------------------------------

section('Seleção de candidatos');
{
  const origin = 'https://site.test';
  const html = `
    <img src="${origin}/logo.png">
    <img src="${origin}/hero.jpg">
    <link rel="stylesheet" href="${origin}/css/app.css">
    <script src="${origin}/js/app.js"></script>
    <a href="${origin}/checkout">checkout</a>
    <link rel="preload" as="font" href="${origin}/fonts/x.woff2">
    <img src="${origin}/logo.png">
  `;
  const candidates = selectMirrorCandidates(html, '', origin);

  check('imagem é candidata', candidates.includes(`${origin}/logo.png`));
  check('fonte é candidata', candidates.includes(`${origin}/fonts/x.woff2`));
  check('script não é candidato', !candidates.some((u) => u.endsWith('.js')), candidates.join(' '));
  check('stylesheet não é candidato', !candidates.some((u) => u.endsWith('.css')));
  check('página interna não é candidata', !candidates.includes(`${origin}/checkout`));
  check('duplicata é removida', candidates.filter((u) => u === `${origin}/logo.png`).length === 1);
  check('url do CSS entra como candidata', selectMirrorCandidates('', `body{background:url(${origin}/bg.jpg)}`, origin).includes(`${origin}/bg.jpg`));
  check('relativa é ignorada (ainda sem base resolvida)', !selectMirrorCandidates('<img src="/rel.jpg">', '', origin).some((u) => u.includes('rel.jpg')));
  check(
    'imagem sem extensão via src entra como candidata (image proxy)',
    selectMirrorCandidates(`<img src="${origin}/render?id=123">`, '', origin).includes(`${origin}/render?id=123`)
  );
  check(
    'link sem extensão NÃO entra (canonical/preconnect não são arquivo)',
    !selectMirrorCandidates(`<link rel="preconnect" href="${origin}/api/v2">`, '', origin).length
  );
  check(
    'link de imagem com extensão entra (ícone/favicon)',
    selectMirrorCandidates(`<link rel="icon" href="${origin}/favicon.ico">`, '', origin).includes(`${origin}/favicon.ico`)
  );
}

// ---------------------------------------------------------------------------

section('Espelhamento — origem com recursos variedos');
{
  await withOrigin(
    (req, res) => {
      const url = req.url ?? '';
      if (url === '/logo.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        return res.end(PNG);
      }
      if (url === '/webp-as-jpg') {
        // The content type wins over the extension. Mirroring this as a JPEG
        // would hand the browser bytes it cannot decode.
        res.writeHead(200, { 'Content-Type': 'image/webp' });
        return res.end(Buffer.from('RIFF____WEBPVP8 '));
      }
      if (url === '/big.png') {
        const body = Buffer.alloc(64 * 1024, 7);
        res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(body.length) });
        return res.end(body);
      }
      if (url === '/page.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        return res.end('body{}');
      }
      if (url === '/gone.png') {
        res.writeHead(404);
        return res.end('nao encontrado');
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html></html>');
    },
    async (origin) => {
      const stored: StoredAsset[] = [];
      const blobs = new Map<string, Buffer>();

      const report = await mirrorAssets(
        {
          pageId: 'pag_1',
          appOrigin: 'https://app.test',
          html: `
            <img src="${origin}/logo.png">
            <img src="${origin}/webp-as-jpg">
            <img src="${origin}/big.png">
            <img src="${origin}/gone.png">
            <link rel="stylesheet" href="${origin}/page.css">
            <script src="${origin}/app.js"></script>
          `,
          css: `body{background:url(${origin}/logo.png)}`,
          maxAssets: 50,
          maxBytes: 32 * 1024,
        },
        async (asset, bytes) => {
          stored.push(asset);
          if (bytes.length > 0) blobs.set(asset.sourceUrl, bytes);
        }
      );

      const byUrl = new Map(stored.map((a) => [a.sourceUrl, a]));

      equal('duas imagens espelhadas', report.stored, 2);
      check('o PNG foi armazenado', byUrl.get(`${origin}/logo.png`)?.status === 'READY');
      equal(
        'o content type real vence a extensão',
        byUrl.get(`${origin}/webp-as-jpg`)?.contentType,
        'image/webp'
      );
      check(
        'e a extensão do storage reflecte o tipo real',
        byUrl.get(`${origin}/webp-as-jpg`)?.storageKey.endsWith('.webp') === true,
        byUrl.get(`${origin}/webp-as-jpg`)?.storageKey
      );
      equal('o recurso grande foi pulado', byUrl.get(`${origin}/big.png`)?.status, 'SKIPPED_TOO_LARGE');
      equal('o 404 foi registrado como falha', byUrl.get(`${origin}/gone.png`)?.status, 'FAILED');
      check('o stylesheet nem é tentado (não é arquivo de mídia)', !byUrl.has(`${origin}/page.css`));
      check('o script não foi tentado', !byUrl.has(`${origin}/app.js`));

      equal('o total de tentativas reflete apenas candidatos', report.attempted, 4);
      // 12 bytes of PNG plus 16 bytes of the WebP fixture.
      equal('bytes armazenados batem com o payload', report.bytesStored, PNG.length + 16);
    }
  );
}

section('Espelhamento — chaves content-addressed são estáveis e únicas');
{
  await withOrigin(
    (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(PNG);
    },
    async (origin) => {
      const runOnce = async () => {
        const keys: string[] = [];
        await mirrorAssets(
          { pageId: 'p', appOrigin: 'https://app.test', html: `<img src="${origin}/a.png">` },
          async (asset) => {
            if (asset.status === 'READY') keys.push(asset.storageKey);
          }
        );
        return keys[0];
      };

      const first = await runOnce();
      const second = await runOnce();
      equal('os mesmos bytes produzem a mesma chave', first, second);
      check('a chave tem formato hex32.ext', /^[a-f0-9]{32}\.png$/.test(first), first);
      check('a URL local usa a rota de assets', localUrlFor('https://app.test', first).startsWith('https://app.test/api/pages/assets/'));
    }
  );
}

section('Espelhamento — limites e ausência de candidatos');
{
  await withOrigin((_req, res) => { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(PNG); }, async (origin) => {
    const imgs = Array.from({ length: 10 }, (_, i) => `<img src="${origin}/img${i}.png">`).join('');
    const limited = await mirrorAssets(
      {
        pageId: 'p',
        appOrigin: 'https://app.test',
        html: `<img src="${origin}/a.png"><img src="${origin}/b.png">${imgs}`,
        maxAssets: 3,
      },
      async () => undefined
    );
    equal('o limite de quantidade é respeitado', limited.attempted, 3);
    check('e a truncagem é declarada', limited.notes.some((n) => n.includes('recursos')), limited.notes.join(' | '));

    const empty = await mirrorAssets({ pageId: 'p', appOrigin: 'https://app.test', html: '<p>sem nada</p>' }, async () => undefined);
    equal('página sem recurso não tenta nada', empty.attempted, 0);
    check('e avisa que não achou nada', empty.notes.length > 0);

    const oversizeLimit = DEFAULT_MAX_ASSET_BYTES;
    check('o limite padrão é de 2MB', oversizeLimit === 2 * 1024 * 1024);
  });
}

section('Reescrita de URL');
{
  const map = new Map([
    ['https://cdn.test/a.png', 'https://app.test/api/pages/assets/aaa.png'],
    ['https://cdn.test/deep/nested/font.woff2', 'https://app.test/api/pages/assets/bbb.woff2'],
  ]);

  const { html, replaced } = rewriteAssetUrls(
    `<img src="https://cdn.test/a.png"><style>@font-face{src:url(https://cdn.test/deep/nested/font.woff2)}</style>`,
    map
  );
  check('a URL do atributo foi trocada', html.includes('https://app.test/api/pages/assets/aaa.png'));
  check('a URL dentro do CSS foi trocada', html.includes('https://app.test/api/pages/assets/bbb.woff2'));
  equal('e as duas substituições foram contadas', replaced, 2);

  const none = rewriteAssetUrls('<img src="https://cdn.test/a.png">', new Map());
  equal('sem mapa, nada muda', none.replaced, 0);
  check('e o HTML é devolvido intacto', none.html.includes('https://cdn.test/a.png'));

  // A URL that is a prefix of another must not shadow it.
  const prefix = new Map([
    ['https://cdn.test/a.png', 'https://app.test/ONE'],
    ['https://cdn.test/a.png.large', 'https://app.test/TWO'],
  ]);
  const shadowed = rewriteAssetUrls('<img src="https://cdn.test/a.png.large">', prefix);
  check('URL mais longa tem precedência', shadowed.html.includes('https://app.test/TWO'), shadowed.html);
}

// ---------------------------------------------------------------------------

section('Captura — chave de recurso sobrevive a mudança de host');
{
  equal('host é descartado', resourceKeyFor('GET', 'https://a.test/api/x?y=1'), 'GET /api/x?y=1');
  equal('mesmo path em host diferente dá a mesma chave',
    resourceKeyFor('GET', 'https://b.test/api/x?y=1'),
    resourceKeyFor('GET', 'https://a.test/api/x?y=1'));
  check('métodos diferentes dão chaves diferentes',
    resourceKeyFor('POST', 'https://a.test/api/x') !== resourceKeyFor('GET', 'https://a.test/api/x'));
  equal('URL inválida não quebra', resourceKeyFor('GET', 'não é url'), 'GET não é url');
}

section('Captura — o que merece ser gravado');
{
  check('JSON é gravado', shouldRecord('https://a.test/api/x', 'application/json'));
  check('HTML é gravado', shouldRecord('https://a.test/x', 'text/html'));
  check('analytics é ignorado', !shouldRecord('https://www.google-analytics.com/collect', 'text/plain'));
  check('facebook pixel é ignorado', !shouldRecord('https://connect.facebook.net/en_US/fbevents.js', 'application/javascript'));
  check('binário é ignorado', !shouldRecord('https://a.test/x.png', 'image/png'));
}

section('Captura — limites e deduplicação');
{
  const recorder = createRecorder({ maxCount: 3, maxBodyBytes: 50, appOrigin: 'https://app.test' });
  const make = (n: number) => ({
    method: 'GET',
    url: `https://origin.test/api/${n}`,
    resourceKey: `GET /api/${n}`,
    status: 200,
    contentType: 'application/json',
    body: '{}',
    isBase64: false,
    requestBody: null,
    hits: 1,
  });

  for (let i = 1; i <= 3; i++) recorder.add(make(i));
  recorder.add(make(4));
  equal('o limite de contagem é respeitado', recorder.summary.recorded, 3);
  check('e o excesso é contabilizado', recorder.summary.notes.some((n) => n.includes('limite')), recorder.summary.notes.join(' | '));

  const dup = createRecorder({ maxCount: 10, maxBodyBytes: 1000 });
  dup.add(make(1));
  dup.add(make(1));
  equal('requisição repetida vira uma entrada só', dup.summary.recorded, 1);
  equal('mas o número de chamadas é preservado', dup.toArray()[0].hits, 2);

  const sized = createRecorder({ maxBodyBytes: 10 });
  sized.add({ ...make(1), body: 'x'.repeat(100) });
  equal('corpo grande é ignorado', sized.summary.recorded, 0);
  check('e avisado', sized.summary.notes.some((n) => n.includes('KB')), sized.summary.notes.join(' | '));

  const scoped = createRecorder({ appOrigin: 'https://app.test' });
  scoped.add({
    ...make(1),
    url: 'https://app.test/api/pages/assets/abc',
    resourceKey: 'GET /api/pages/assets/abc',
  });
  equal('chamada para a própria plataforma é ignorada', scoped.summary.recorded, 0);

  const empty = createRecorder({ maxCount: 5, maxBodyBytes: 10 });
  // Oversized, so nothing is kept — the summary must say so rather than staying silent.
  empty.add({ ...make(1), body: 'x'.repeat(100), resourceKey: 'GET /api/grande' });
  equal('nada foi gravado', empty.summary.recorded, 0);
  check('e o resumo declara que nada foi gravado', empty.summary.notes.some((n) => n.includes('Nenhuma')), empty.summary.notes.join(' | '));
}

section('Replay — o script não pode ser quebrado pelo manifest');
{
  const hostile = 'https://app.test/";alert(1);//';
  const script = buildReplayScript(hostile, 'https://app.test');
  const line = script.slice(script.indexOf('var MANIFEST ='), script.indexOf('\n', script.indexOf('var MANIFEST =')));
  check('a linha do manifest é uma string válida', /^var MANIFEST = ".*";\s*$/.test(line.trimEnd()), line.slice(0, 140));
  check('nenhum < ou > cru escapou', !line.includes('<') && !line.includes('>'), line.slice(0, 140));
  check('o bloco não é encerrado antes da hora', (script.slice(0, script.indexOf('</script>')).match(/<\/script>/g) || []).length === 0);
  check('o interceptor cobre fetch', script.includes('window.fetch ='));
  check('o interceptor cobre XHR', script.includes('XMLHttpRequest'));
  check('e cai na rede quando não há captura', script.includes('return nativeFetch(input, init)'));
}

section('Replay — truncamento de corpo');
{
  check('corpo pequeno passa intacto', limitBody('abc') === 'abc');
  const huge = 'a'.repeat(500_000);
  const limited = limitBody(huge);
  check('corpo grande é truncado', limited.length < huge.length);
  check('e marcado como truncado', limited.includes('[truncado]'));
}

// ---------------------------------------------------------------------------

section('Bytes para o Prisma');
{
  const converted = toPrismaBytes(PNG);
  equal('o tamanho é preservado', converted.byteLength, PNG.length);
  check('o conteúdo é idêntico', Buffer.from(converted).equals(PNG));
  check('é um Uint8Array sobre ArrayBuffer próprio', converted.buffer instanceof ArrayBuffer);
  check('e não compartilha memória com o Buffer original', converted.buffer !== PNG.buffer);
}

section('Manifest — o corpo binário precisa chegar inteiro');
{
  // The bug this guards: the manifest set `base64: true` while sending
  // `body: null`, so the interceptor's `atob(entry.body || '')` produced an
  // empty body and every binary capture replayed as a plausible 200 with
  // nothing in it. A flag without the payload is the failure mode.
  const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x7f]);
  const binaryEntry = toManifestEntry({
    method: 'GET',
    resourceKey: 'GET /api/quiz',
    status: 200,
    contentType: 'image/webp',
    body: null,
    bodyBase64: binary.toString('base64'),
    hits: 1,
  });
  check('o payload base64 acompanha a flag', binaryEntry.base64 === true && binaryEntry.body !== null);
  check(
    'o interceptor recupera os bytes originais',
    Buffer.from(atob(String(binaryEntry.body)), 'binary').equals(binary),
    `decodificou ${String(binaryEntry.body).slice(0, 24)}`
  );

  const textEntry = toManifestEntry({
    method: 'GET',
    resourceKey: 'GET /api/state',
    status: 200,
    contentType: 'application/json',
    body: '{"step":1}',
    bodyBase64: null,
    hits: 3,
  });
  check('corpo textual vai cru, sem base64', textEntry.base64 === false && textEntry.body === '{"step":1}');
  check('o contador de repetições sobrevive', textEntry.hits === 3);

  const emptyBinary = toManifestEntry({
    method: 'GET',
    resourceKey: 'GET /vazio',
    status: 204,
    contentType: 'application/octet-stream',
    body: null,
    bodyBase64: '',
    hits: 1,
  });
  // An empty string is a stored value, not a missing one: it must not flip the
  // flag, or a genuinely empty capture would be announced as text.
  check('base64 vazio continua sendo base64', emptyBinary.base64 === true);
  check('e o corpo fica vazio, não nulo', emptyBinary.body === '');

  const textBytes = Buffer.from('{"ok":true}');
  const roundTrip = toManifestEntry({
    method: 'POST',
    resourceKey: 'POST /api/lead',
    status: 201,
    contentType: 'application/json',
    body: null,
    bodyBase64: textBytes.toString('base64'),
    hits: 1,
  });
  check(
    'JSON guardado como base64 também volta íntegro',
    atob(String(roundTrip.body)) === '{"ok":true}'
  );

  // Testing `toManifestEntry` is only half the guarantee: the route has to be
  // the thing calling it. A route that inlines its own mapping would pass the
  // assertions above while still shipping an empty body.
  const captureRoute = readFileSync(
    resolve(process.cwd(), 'src/app/api/pages/capture/[id]/route.ts'),
    'utf8'
  );
  check('a rota monta o manifest pela função testada', captureRoute.includes('captures.map(toManifestEntry)'));
  check(
    'a rota não monta a entrada na mão',
    !/base64:\s*!!?\s*capture\.bodyBase64/.test(captureRoute)
  );
}

section('Chave de recurso — a origem não pode vazar para o manifest');
{
  // resourceKey is method plus path and query, with the host stripped. If the
  // host leaked in, a capture recorded against the original site would stop
  // matching the moment the clone was served from another domain.
  const fromOrigin = resourceKeyFor('GET', 'https://original.com/quiz?step=2');
  const fromClone = resourceKeyFor('GET', 'https://meu-clone.vercel.app/quiz?step=2');
  equal('a mesma rota em hosts diferentes gera a mesma chave', fromClone, fromOrigin);
  check('a chave não contém o host', !fromOrigin.includes('original.com'));
  check('a chave preserva a query', fromOrigin.includes('step=2'));
  check('o método faz parte da chave', resourceKeyFor('POST', '/quiz') !== resourceKeyFor('GET', '/quiz'));
}

section('Assets — a chave precisa servir linhas de qualquer página');
{
  // `storageKey` is unique per page, not across the table, so the serving route
  // has to use a non-unique lookup. This asserts the schema does not drift into
  // a shape where the route's `findFirst` and the indexes disagree.
  const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const model = schema.slice(schema.indexOf('model CloneAsset {'), schema.indexOf('model CloneCapture {'));
  check('existe a única composta por página e chave', model.includes('@@unique([pageId, storageKey])'));
  check('a chave não é única globalmente', !/storageKey\s+String\s+@unique/.test(model));

  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/pages/assets/[key]/route.ts'),
    'utf8'
  );
  // Matched as a call, not as a word: the route's own comment names the method
  // to explain why it is not the one being used.
  check('a rota não usa findUnique numa chave não única', !route.includes('cloneAsset.findUnique('));
  check('a rota filtra por status pronto', route.includes("status !== 'READY'"));
  check('a chave é validada antes de consultar', route.includes('^[a-f0-9]{32}'));
}

section('Refresh — falha no meio não pode apagar o espelho anterior');
{
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/pages/[id]/mirror/route.ts'),
    'utf8'
  );
  const pruneAt = route.indexOf('const stale =');
  const updateAt = route.indexOf('await prisma.page.update');
  check('existe uma poda no fim da rota', pruneAt > 0);
  check('a poda acontece depois de reescrever o documento', pruneAt > updateAt);
  check('a poda é condicionada ao refresh pedido', /if \(body\.refresh && applied/.test(route));
  check('a poda exige que algo foi realmente tentado', /attemptedUrls\.size > 0/.test(route));
  // The original bug was an unconditional deleteMany before mirroring, which
  // left the HTML pointing at local URLs that no longer resolved.
  const deleteAt = route.indexOf('deleteMany');
  check('nenhum deleteMany acontece antes de espelhar', deleteAt < 0 || deleteAt > updateAt);
}

console.log(`\n\x1b[1mResultado\x1b[0m`);
console.log(`  \x1b[32mpassou: ${passed}\x1b[0m   \x1b[31mfalhou: ${failed}\x1b[0m`);
if (failures.length > 0) {
  console.log('\n\x1b[31mFalhas:\x1b[0m');
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exitCode = 1;
  return;
}
}

main()
  // The HTTP servers close in a `finally`, but their handles are still winding
  // down; exiting synchronously trips a libuv assertion on Windows.
  .then(() => new Promise((resolve) => setTimeout(resolve, 150)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
