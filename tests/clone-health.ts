/**
 * Health-check tests.
 *
 * The claim being tested is that a silent failure becomes visible. A clone whose
 * origin has dropped an image, whose font path 404s and whose stylesheet is gone
 * has to produce a report naming each one — otherwise the feature is decoration.
 *
 * A local HTTP server stands in for the origin so the failures are real responses
 * rather than mocks, including a connection refused, which is what a dead origin
 * actually produces.
 */

import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';
import { checkCloneHealth, collectAssetUrls } from '../src/lib/clone-health';

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

// ---------------------------------------------------------------------------

async function main() {
section('Coleta de URLs');
{
  const html = `
    <img src="/img/ok.png">
    <img srcset="/img/small.png 480w, /img/big.png 1024w">
    <picture><source srcset="/img/modern.webp" type="image/webp"></picture>
    <video poster="/img/poster.jpg"><source src="/media/clip.mp4"></video>
    <link rel="stylesheet" href="/css/main.css">
    <link rel="preload" as="font" href="/fonts/inter.woff2" crossorigin>
    <script src="/js/app.js"></script>
    <style>body{background:url("/img/bg.png")} .i{background-image:url(/img/icon.svg)}</style>
    <a href="/pagina-inicial">link não é recurso</a>
    <img src="data:image/gif;base64,R0lGOD">
    <span id="ancora"></span>
  `;

  const urls = collectAssetUrls(html);

  check('imagem simples coletada', urls.includes('/img/ok.png'));
  check('srcset gera uma entrada por tamanho', urls.includes('/img/small.png') && urls.includes('/img/big.png'));
  check('source srcset coletado', urls.includes('/img/modern.webp'));
  check('poster de vídeo coletado', urls.includes('/img/poster.jpg'));
  check('source de vídeo coletado', urls.includes('/media/clip.mp4'));
  check('stylesheet coletado', urls.includes('/css/main.css'));
  check('fonte coletada', urls.includes('/fonts/inter.woff2'));
  check('script coletado', urls.includes('/js/app.js'));
  check('url() com aspas no CSS coletado', urls.includes('/img/bg.png'));
  check('url() sem aspas no CSS coletado', urls.includes('/img/icon.svg'));
  check('data: URI é ignorada', !urls.some((u) => u.startsWith('data:')));
  check('âncora é ignorada', !urls.includes('#ancora'));
}

// ---------------------------------------------------------------------------

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

section('Health check — origem de pé');
{
  await withOrigin(
    (req, res) => {
      if (req.url === '/img/ok.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
        return;
      }
      if (req.url === '/img/missing.png') {
        res.writeHead(404);
        res.end('nao encontrado');
        return;
      }
      if (req.url === '/css/main.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' });
        res.end('body{margin:0}');
        return;
      }
      if (req.url === '/js/app.js') {
        res.writeHead(500);
        res.end('erro interno');
        return;
      }
      if (req.url === '/fonts/inter.woff2') {
        res.writeHead(403);
        res.end('proibido');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html></html>');
    },
    async (origin) => {
      const report = await checkCloneHealth({
        cloneUrl: `${origin}/p/minha-oferta`,
        html: `
          <img src="${origin}/img/ok.png">
          <img src="${origin}/img/missing.png">
          <link rel="stylesheet" href="${origin}/css/main.css">
          <script src="${origin}/js/app.js"></script>
          <link rel="preload" as="font" href="${origin}/fonts/inter.woff2">
        `,
      });

      equal('todas as URLs foram verificadas', report.checked, 5);
      equal('três recursos quebrados', report.broken, 3);
      equal('o relatório não está ok', report.ok, false);

      const byUrl = new Map(report.issues.map((i) => [i.url, i]));
      equal('o 404 foi identificado', byUrl.get(`${origin}/img/missing.png`)?.status, 404);
      equal('o 500 foi identificado', byUrl.get(`${origin}/js/app.js`)?.status, 500);
      equal('o 403 foi identificado', byUrl.get(`${origin}/fonts/inter.woff2`)?.status, 403);
      check('o recurso íntegro não aparece entre os problemas', !byUrl.has(`${origin}/img/ok.png`));
      equal('o tipo do recurso quebrado foi classificado', byUrl.get(`${origin}/fonts/inter.woff2`)?.kind, 'fonte');
      equal('o 404 é sempre erro, nunca aviso', byUrl.get(`${origin}/img/missing.png`)?.severity, 'erro');
    }
  );
}

section('Health check — origem fora do ar');
{
  // Nothing is listening on this port, which is what a dead origin looks like.
  await withOrigin((_req, res) => res.end('ok'), async (liveOrigin) => {
    const deadPort = 1;
    const report = await checkCloneHealth({
      cloneUrl: `${liveOrigin}/p/x`,
      html: `<img src="http://127.0.0.1:${deadPort}/img/fora.png">`,
    });

    equal('a falha de conexão é contada', report.broken, 1);
    check('e o motivo não é um código HTTP', report.issues[0].status === null, `status=${report.issues[0].status}`);
    check('a descrição cita falha de rede', report.issues[0].detail.includes('rede') || report.issues[0].detail.includes('fetch'), report.issues[0].detail);
  });
}

section('Health check — dependência da origem original');
{
  // `127.0.0.1` and `localhost` are distinct hostnames that resolve to the same
  // live server, so this exercises the external-dependency path without a
  // second process and without a request actually failing.
  await withOrigin((_req, res) => { res.writeHead(200); res.end('ok'); }, async (origin) => {
    const port = new URL(origin).port;
    const external = `http://localhost:${port}`;

    const report = await checkCloneHealth({
      cloneUrl: `${origin}/p/x`,
      html: `<img src="${external}/img/a.png"><script src="${external}/js/x.js"></script>`,
      sourceOrigin: 'https://site-original.com',
    });

    equal('nada quebrou', report.broken, 0);
    equal('o relatório está ok', report.ok, true);
    equal('a dependência externa é contabilizada', report.externalCount, 1);
    check('e o relatório avisa que a página depende de fora', report.notes.some((n) => n.includes('externa')), report.notes.join(' | '));
  });
}

section('Health check — recursos ainda apontando para o site clonado');
{
  await withOrigin((_req, res) => { res.writeHead(200); res.end('ok'); }, async (origin) => {
    const report = await checkCloneHealth({
      cloneUrl: `${origin}/p/x`,
      html: `<img src="${origin}/img/a.png">`,
      sourceOrigin: origin,
    });
    equal('sem dependência externa', report.externalCount, 0);
    check('e sem aviso de dependência', !report.notes.some((n) => n.includes('depende de')), report.notes.join(' | '));
  });
}

section('Health check — página limpa e entradas inválidas');
{
  await withOrigin((_req, res) => { res.writeHead(200); res.end('ok'); }, async (origin) => {
    const clean = await checkCloneHealth({
      cloneUrl: `${origin}/p/x`,
      html: `<img src="${origin}/a.png">`,
      sourceOrigin: 'https://outro.test',
    });
    equal('clone sem nada quebrado', clean.broken, 0);
    equal('e é marcado como saudável', clean.ok, true);

    const junk = await checkCloneHealth({
      cloneUrl: `${origin}/p/x`,
      html: `<img src="javascript:alert(1)"><img src="::::"><a href="mailto:x@y.z">x</a>`,
    });
    check('URLs não-http são ignoradas, não causam erro', junk.broken === 0, JSON.stringify(junk.issues));
    check('e aignoração é registrada', junk.notes.some((n) => n.includes('ignorado') || n.includes('inválida')), junk.notes.join(' | '));
  });
}

// ---------------------------------------------------------------------------

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
  // The HTTP servers are closed in a `finally`, but their handles are still
  // winding down. Exiting synchronously here trips a libuv assertion on Windows,
  // so the event loop is given a turn to settle.
  .then(() => new Promise((resolve) => setTimeout(resolve, 150)))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
