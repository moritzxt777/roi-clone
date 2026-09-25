/**
 * Experiment: which imperceptible mutation actually moves a 9x8 dHash?
 *
 * The mutation ladder in `creative-camouflager` produced distances of 0 and 1
 * bits. A 9x8 box-filtered grid averages roughly 28x32 source pixels per cell, so
 * a one-pixel crop plus a uniform brightness offset is invisible to the eye *and*
 * to the hash: dHash compares adjacent cells, and a uniform offset cancels out of
 * a pairwise comparison exactly. This harness measures candidates instead of
 * assuming.
 */

import puppeteer from 'puppeteer';
import { build } from 'esbuild';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const TMP = join(process.cwd(), 'scratch', 'tests', 'phash-lab');
if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });

const fixtures: Array<{ name: string; gen: string[] }> = [
  { name: 'testsrc-256.jpg', gen: ['-f', 'lavfi', '-i', 'testsrc=s=256x256:d=1', '-frames:v', '1'] },
  { name: 'gradient-256.jpg', gen: ['-f', 'lavfi', '-i', 'gradients=s=256x256:d=1:n=4', '-frames:v', '1'] },
  { name: 'smpte-256.jpg', gen: ['-f', 'lavfi', '-i', 'smptebars=s=256x256:d=1', '-frames:v', '1'] },
  { name: 'mandelbrot-256.jpg', gen: ['-f', 'lavfi', '-i', 'mandelbrot=s=256x256:end_pts=32', '-frames:v', '1'] },
  { name: 'photo-256.jpg', gen: ['-f', 'lavfi', '-i', 'life=s=256x256:mold=10:r=40:ratio=0.1:death_color=#C83232:life_color=#00ff00', '-frames:v', '1'] },
];

for (const fixture of fixtures) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...fixture.gen, join(TMP, fixture.name)], { stdio: 'ignore' });
}

async function main() {
  const bundle = await build({
    entryPoints: ['src/lib/perceptual-hash.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'P',
    platform: 'browser',
    target: 'es2020',
    write: false,
  });

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  // esbuild's keepNames emits `__name(fn, "label")` for named function
  // expressions; that helper does not exist in the page, and identity is enough.
  await page.addScriptTag({ content: 'window.__name = function (fn) { return fn; };' });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  console.log('\n\x1b[1mDistÃ¢ncia dHash por estratÃ©gia de mutaÃ§Ã£o (0 = nÃ£o mudou)\x1b[0m');
  console.log('  piso de ruÃ­do do encoder: re-encode sem mutaÃ§Ã£o, para comparaÃ§Ã£o\n');

  const results: Record<string, number[]> = {};
  const control: Record<string, number> = {};

  for (const fixture of fixtures) {
    const base64 = readFileSync(join(TMP, fixture.name)).toString('base64');
    const row = await page.evaluate(
      async (b64: string) => {
        const { dHashFromRgba, hammingDistance } = (window as never as { P: Record<string, never> }).P as unknown as {
          dHashFromRgba: (d: Uint8ClampedArray, w: number, h: number) => { hex: string };
          hammingDistance: (a: unknown, b: unknown) => number;
        };

        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
        const w = bitmap.width;
        const h = bitmap.height;

        const draw = (): ImageData => {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const x = c.getContext('2d', { willReadFrequently: true })!;
          x.imageSmoothingEnabled = true;
          x.imageSmoothingQuality = 'high';
          x.drawImage(bitmap, 0, 0, w, h);
          return x.getImageData(0, 0, w, h);
        };

        const baselineImage = draw();
        const baseline = dHashFromRgba(baselineImage.data, w, h);

        const measure = (mutate: (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => void): number => {
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const x = c.getContext('2d', { willReadFrequently: true })!;
          x.imageSmoothingEnabled = true;
          x.imageSmoothingQuality = 'high';
          x.drawImage(bitmap, 0, 0, w, h);
          mutate(x, c);
          return hammingDistance(baseline, dHashFromRgba(x.getImageData(0, 0, w, h).data, w, h));
        };

        // Control: re-encode with no mutation at all. Anything at or below this is
        // encoder noise, not a real change.
        const controlCanvas = document.createElement('canvas');
        controlCanvas.width = w;
        controlCanvas.height = h;
        controlCanvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
        const controlBlob: Blob = await new Promise((res) => controlCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.94));
        const controlBitmap = await createImageBitmap(controlBlob);
        const controlCanvas2 = document.createElement('canvas');
        controlCanvas2.width = w;
        controlCanvas2.height = h;
        controlCanvas2.getContext('2d')!.drawImage(controlBitmap, 0, 0);
        const controlDistance = hammingDistance(
          baseline,
          dHashFromRgba(controlCanvas2.getContext('2d')!.getImageData(0, 0, w, h).data, w, h)
        );

        const strategies: Record<string, number> = { 'controle (sem mutaÃ§Ã£o)': controlDistance };

        // A: brightness uniforme
        strategies['A brilho uniforme +2'] = measure((x) => {
          const img = x.getImageData(0, 0, w, h);
          for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] = Math.min(255, img.data[i] + 2);
            img.data[i + 1] = Math.min(255, img.data[i + 1] + 2);
            img.data[i + 2] = Math.min(255, img.data[i + 2] + 2);
          }
          x.putImageData(img, 0, 0);
        });

        // B: ruÃ­do por pixel
        strategies['B ruido por pixel Â±1'] = measure((x) => {
          const img = x.getImageData(0, 0, w, h);
          for (let i = 0; i < img.data.length; i += 4) {
            img.data[i] += (i % 2 === 0 ? 1 : -1);
            img.data[i + 1] += (i % 3 === 0 ? 1 : -1);
            img.data[i + 2] += (i % 5 === 0 ? 1 : -1);
          }
          x.putImageData(img, 0, 0);
        });

        // C: reamostragem com fase alterada (magnification change + 1px offset)
        strategies['C reamostra +1px e recorta'] = measure((x, c) => {
          x.clearRect(0, 0, w, h);
          x.drawImage(bitmap, 0, 0, w + 2, h + 2);
          const img = x.getImageData(1, 1, w, h);
          const out = document.createElement('canvas');
          out.width = w;
          out.height = h;
          out.getContext('2d')!.putImageData(img, 0, 0);
          x.clearRect(0, 0, w, h);
          x.drawImage(out, 0, 0);
        });

        // D: rotaÃ§Ã£o mÃ­nima
        strategies['D rotacao 0.4 graus'] = measure((x, c) => {
          x.save();
          x.clearRect(0, 0, w, h);
          x.fillStyle = '#000';
          x.fillRect(0, 0, w, h);
          x.translate(w / 2, h / 2);
          x.rotate((0.4 * Math.PI) / 180);
          x.imageSmoothingQuality = 'high';
          x.drawImage(bitmap, -w / 2, -h / 2, w, h);
          x.restore();
          void c;
        });

        // E: cisalhamento horizontal mÃ­nimo
        strategies['E cisalhamento 1px'] = measure((x) => {
          const img = x.getImageData(0, 0, w, h);
          const out = new Uint8ClampedArray(img.data);
          for (let y = 0; y < h; y++) {
            const shift = ((y * 1) / h) | 0;
            for (let px = 0; px < w; px++) {
              const src = (px + shift) % w;
              const si = (y * w + src) * 4;
              const di = (y * w + px) * 4;
              out[di] = img.data[si];
              out[di + 1] = img.data[si + 1];
              out[di + 2] = img.data[si + 2];
              out[di + 3] = img.data[si + 3];
            }
          }
          x.putImageData(new ImageData(out, w, h), 0, 0);
        });

        // F: rampa espacial suave (mexe luminancia relativa entre celulas)
        strategies['F rampa espacial Â±4'] = measure((x) => {
          const img = x.getImageData(0, 0, w, h);
          for (let y = 0; y < h; y++) {
            for (let px = 0; px < w; px++) {
              const ramp = Math.round(((px / w) * 8 - 4));
              const i = (y * w + px) * 4;
              img.data[i] = Math.max(0, Math.min(255, img.data[i] + ramp));
              img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + ramp));
              img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + ramp));
            }
          }
          x.putImageData(img, 0, 0);
        });

        // G: zoom de 1.2% e recorte do tamanho original
        strategies['G zoom 1.2% e recorte'] = measure((x) => {
          const k = 1.012;
          x.clearRect(0, 0, w, h);
          x.drawImage(bitmap, (w - w * k) / 2, (h - h * k) / 2, w * k, h * k);
        });

        // H: combinaÃ§Ã£o do que parece mais forte
        strategies['H zoom 1.2% + rampa Â±3'] = measure((x) => {
          const k = 1.012;
          x.clearRect(0, 0, w, h);
          x.drawImage(bitmap, (w - w * k) / 2, (h - h * k) / 2, w * k, h * k);
          const img = x.getImageData(0, 0, w, h);
          for (let y = 0; y < h; y++) {
            for (let px = 0; px < w; px++) {
              const ramp = ((px / w) * 6 - 3) | 0;
              const i = (y * w + px) * 4;
              img.data[i] = Math.max(0, Math.min(255, img.data[i] + ramp));
              img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + ramp));
              img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + ramp));
            }
          }
          x.putImageData(img, 0, 0);
        });

        return strategies;
      },
      base64
    );

    control[fixture.name] = row['controle (sem mutaÃ§Ã£o)'];
    console.log(`\x1b[1m${fixture.name}\x1b[0m  (controle = ${row['controle (sem mutaÃ§Ã£o)']})`);
    for (const [label, distance] of Object.entries(row)) {
      if (label === 'controle (sem mutaÃ§Ã£o)') continue;
      results[label] = results[label] ?? [];
      results[label].push(distance);
      const bar = 'â–ˆ'.repeat(Math.min(40, distance));
      console.log(`  ${label.padEnd(32)} ${String(distance).padStart(3)}  ${bar}`);
    }
  }

  console.log('\n\x1b[1mMÃ©dia por estratÃ©gia\x1b[0m');
  const ranked = Object.entries(results)
    .map(([label, values]) => [label, values.reduce((a, b) => a + b, 0) / values.length, Math.min(...values)] as const)
    .sort((a, b) => b[1] - a[1]);
  for (const [label, mean, min] of ranked) {
    console.log(`  ${label.padEnd(32)} media=${mean.toFixed(1).padStart(5)}  pior caso=${String(min).padStart(3)}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

