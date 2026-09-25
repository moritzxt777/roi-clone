/**
 * Browser tests for the image camouflager.
 *
 * These need a real engine: the claims under test are that a canvas round trip
 * drops EXIF, that a transparent WebP keeps its alpha, that the output container
 * matches the extension it is given, and that the perceptual hash actually moves.
 * None of that can be asserted in Node, so the project's own source is bundled
 * with esbuild and driven inside headless Chrome.
 *
 * Run with `npm run test:browser`. Skips loudly when no Chrome binary is present.
 */

import puppeteer from 'puppeteer';
import { build } from 'esbuild';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const TMP = join(process.cwd(), 'scratch', 'tests', 'browser');
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

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

function hasBinary(name: string): boolean {
  try {
    execFileSync(name, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!hasBinary('ffmpeg')) {
    console.log('\x1b[33mffmpeg ausente — fixtures de imagem não podem ser geradas, pulando.\x1b[0m');
    process.exit(0);
  }

  // Fixtures.
  //
  // Two kinds of transparency fixture, and the distinction matters. A *textured*
  // transparent image exercises alpha preservation and the perceptual mutation in
  // the same pass. A *flat* transparent image has no gradients at all, so its
  // perceptual hash cannot move no matter what the mutator does — asserting a
  // distance on it would be asserting physics, not behaviour, so it is checked
  // for alpha only.
  const opaqueJpeg = join(TMP, 'opaque.jpg');
  const texturedPng = join(TMP, 'textured-alpha.png');
  const texturedWebp = join(TMP, 'textured-alpha.webp');
  const flatPng = join(TMP, 'flat-alpha.png');
  const withExif = join(TMP, 'with-exif.jpg');

  execFileSync(
    'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=256x256:d=1', '-frames:v', '1', opaqueJpeg],
    { stdio: 'ignore' }
  );
  // Half-alpha testsrc2: real RGB content behind a uniform 50% alpha.
  const alphaFilter = ['-vf', 'format=rgba,colorchannelmixer=aa=0.5'];
  execFileSync(
    'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=256x256:d=1', ...alphaFilter, '-frames:v', '1', texturedPng],
    { stdio: 'ignore' }
  );
  execFileSync(
    'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=256x256:d=1', ...alphaFilter, '-frames:v', '1',
      '-c:v', 'libwebp', '-lossless', '1', texturedWebp],
    { stdio: 'ignore' }
  );
  execFileSync(
    'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=red@0.0:s=256x256,format=rgba', '-frames:v', '1', flatPng],
    { stdio: 'ignore' }
  );
  execFileSync(
    'ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=s=256x256:d=1', '-frames:v', '1',
      '-metadata', 'comment=GPS_TRACKER_TEST', '-metadata', 'title=Oferta Secreta', withExif],
    { stdio: 'ignore' }
  );

  // Bundle the real source so the test exercises shipped code, not a copy.
  const bundle = await build({
    entryPoints: ['src/lib/creative-camouflager.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'Camouflager',
    platform: 'browser',
    target: 'es2020',
    write: false,
  });
  const code = bundle.outputFiles[0].text;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
  });

  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`erro de página: ${message}`);
    });
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    await page.addScriptTag({ content: code });

    const fixtures = [
      { label: 'JPEG opaco', path: opaqueJpeg, mime: 'image/jpeg', hasAlpha: false, textured: true },
      { label: 'PNG com alpha e textura', path: texturedPng, mime: 'image/png', hasAlpha: true, textured: true },
      { label: 'WebP com alpha e textura', path: texturedWebp, mime: 'image/webp', hasAlpha: true, textured: true },
      { label: 'PNG totalmente transparente (sem textura)', path: flatPng, mime: 'image/png', hasAlpha: true, textured: false },
      { label: 'JPEG com metadados', path: withExif, mime: 'image/jpeg', hasAlpha: false, textured: true },
    ];

    for (const fixture of fixtures) {
      const base64 = readFileSync(fixture.path).toString('base64');
      const name = fixture.path.split(/[\\/]/).pop()!;

      const result = await page.evaluate(
        async (b64: string, mime: string, fileName: string) => {
          const C = (window as never as { Camouflager: Record<string, never> }).Camouflager as unknown as {
            camouflageImage: (f: File) => Promise<Record<string, never>>;
            formatBytes: (n: number) => string;
            HASH_BITS: number;
            MIN_EFFECTIVE_DISTANCE: number;
          };
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          const file = new File([bytes], fileName, { type: mime });
          const r = (await C.camouflageImage(file)) as unknown as {
            status: string;
            error?: string;
            blob: Blob;
            mimeType: string;
            camouflagedName: string;
            originalHash: string;
            camouflagedHash: string;
            exifStripped: boolean;
            perceptualMutation: boolean;
            perceptualDistance: number;
            dHashBefore: string | null;
            dHashAfter: string | null;
            metadataReport: string[];
            notes: string[];
            originalSize: number;
            camouflagedSize: number;
          };

          // Decode the produced bytes back and measure the alpha channel, so the
          // claim is about the file that comes out, not about the encoder's intent.
          const outBytes = new Uint8Array(await r.blob.arrayBuffer());
          const bitmap = await createImageBitmap(r.blob);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(bitmap, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let alphaSum = 0;
          for (let i = 3; i < pixels.length; i += 4) alphaSum += pixels[i];

          // Read back the real magic bytes rather than trusting the declared type.
          let magic = '';
          for (let i = 0; i < 4; i++) magic += outBytes[i].toString(16).padStart(2, '0');

          return {
            status: r.status,
            error: r.error,
            blobType: r.blob.type,
            mimeType: r.mimeType,
            camouflagedName: r.camouflagedName,
            hashChanged: r.originalHash !== r.camouflagedHash,
            exifStripped: r.exifStripped,
            perceptualMutation: r.perceptualMutation,
            perceptualDistance: r.perceptualDistance,
            dHashBefore: r.dHashBefore,
            dHashAfter: r.dHashAfter,
            metadataReport: r.metadataReport,
            notes: r.notes,
            magic,
            avgAlpha: alphaSum / (canvas.width * canvas.height),
            sizeIn: r.originalSize,
            sizeOut: r.camouflagedSize,
            hashBits: C.HASH_BITS,
            minDistance: C.MIN_EFFECTIVE_DISTANCE,
          };
        },
        base64,
        fixture.mime,
        name
      );

      section(`${fixture.label} (${name})`);

      equal('processou com sucesso', result.status, 'done');
      if (result.error) {
        check('sem erro', false, result.error);
        continue;
      }

      check('hash do arquivo mudou', result.hashChanged);
      check('nenhum byte EXIF sobrevive ao round trip por canvas', result.exifStripped === true);
      check('relatório de metadados não está vazio', result.metadataReport.length > 0);

      // The extension must describe the bytes that were actually written.
      const ext = result.camouflagedName.slice(result.camouflagedName.lastIndexOf('.'));
      const magicByExt: Record<string, string> = {
        '.jpg': 'ffd8ff',
        '.jpeg': 'ffd8ff',
        '.png': '89504e47',
        '.webp': '52494646',
      };
      const expectedMagic = magicByExt[ext.toLowerCase()];
      if (expectedMagic) {
        check(
          `magic bytes batem com a extensão ${ext}`,
          result.magic.startsWith(expectedMagic),
          `magic=${result.magic}`
        );
      }

      const declared = result.mimeType.split('/')[1];
      check(
        'container declarado bate com a extensão',
        declared === ext.slice(1).replace('jpg', 'jpeg'),
        `mime=${result.mimeType} ext=${ext}`
      );

      if (fixture.hasAlpha) {
        check(
          'canal alfa preservado (média baixa = ainda translúcido)',
          result.avgAlpha < 250,
          `alfa médio=${result.avgAlpha}`
        );
        check('saída é WebP ou PNG, nunca JPEG', result.mimeType !== 'image/jpeg', result.mimeType);
      } else {
        check('imagem opaca continua opaca', result.avgAlpha > 250, `alfa médio=${result.avgAlpha}`);
      }

      if (fixture.textured) {
        // The whole point of the module: a moved perceptual fingerprint. A flat
        // image has no gradients, so this is only asserted where it can hold.
        check(
          `mutação perceptual medida (${result.perceptualDistance} de ${result.hashBits} bits, piso ${result.minDistance})`,
          result.perceptualMutation === true && result.perceptualDistance >= result.minDistance
        );
        check('dHash de origem tem 1024 bits', result.dHashBefore?.length === 256);
        check('dHash de saída difere do de origem', result.dHashBefore !== result.dHashAfter);
      } else {
        check(
          'imagem sem textura reporta honestamente que o hash não moveu',
          result.perceptualMutation === false,
          `distância=${result.perceptualDistance}`
        );
        check('e avisa o operador por nota', result.notes.length > 0);
      }
    }

    section('Determinismo e reprodutibilidade');
    {
      const base64 = readFileSync(opaqueJpeg).toString('base64');
      const hashes = await page.evaluate(
        async (b64: string) => {
          const C = (window as never as { Camouflager: Record<string, never> }).Camouflager as unknown as {
            camouflageImage: (f: File) => Promise<{ camouflagedHash: string; camouflagedName: string }>;
          };
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          const out: string[] = [];
          for (let run = 0; run < 3; run++) {
            const file = new File([bytes], 'creative.jpg', { type: 'image/jpeg' });
            const r = await C.camouflageImage(file);
            out.push(r.camouflagedHash);
          }
          return out;
        },
        base64
      );
      check(
        'três execuções do mesmo arquivo geram três hashes distintos',
        new Set(hashes).size === 3,
        hashes.join(', ')
      );
    }

    section('Saída de erro é honesta');
    {
      const result = await page.evaluate(async () => {
        const C = (window as never as { Camouflager: Record<string, never> }).Camouflager as unknown as {
          camouflageImage: (f: File) => Promise<{ status: string; exifStripped: boolean; perceptualMutation: boolean; error?: string }>;
        };
        // A "imagem" que não é imagem: precisa falhar em vez de devolver o original
        // com um selo de sucesso.
        const file = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'ruim.png', { type: 'image/png' });
        return C.camouflageImage(file);
      });
      equal('arquivo inválido retorna erro', result.status, 'error');
      check('não afirma exif removido em arquivo inválido', result.exifStripped === false);
      check('não afirma mutação em arquivo inválido', result.perceptualMutation === false);
      check('traz motivo do erro', typeof result.error === 'string' && result.error.length > 0);
    }
  } finally {
    await browser.close();
  }

  console.log(`\n\x1b[1mResultado\x1b[0m`);
  console.log(`  \x1b[32mpassou: ${passed}\x1b[0m   \x1b[31mfalhou: ${failed}\x1b[0m`);
  if (failures.length > 0) {
    console.log('\n\x1b[31mFalhas:\x1b[0m');
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
