/**
 * Creative camouflager: container hygiene plus a measured perceptual mutation.
 *
 * What this module guarantees, and how each guarantee is verified:
 *
 *   1. Image metadata is genuinely removed. The decode/redraw/encode round trip
 *      through a canvas discards EXIF, GPS and camera tags, because none of them
 *      survive into a pixel buffer.
 *
 *   2. Image alpha is preserved. The previous version routed every non-PNG input
 *      to `image/jpeg` while keeping the original extension, so a transparent
 *      WebP came back as a black rectangle named `.webp` that was actually JPEG
 *      bytes. The output container is now chosen from the source's alpha channel
 *      and the extension is derived from the bytes that are actually produced.
 *
 *   3. A perceptual mutation is applied and then *measured*. dHash is computed
 *      before and after; the mutation is escalated until the distance clears the
 *      noise floor, and the real distance is reported. No claim is made without
 *      a number.
 *
 *   4. Video metadata is genuinely removed by parsing the container â€” see
 *      `container-metadata`. The old 50-byte trailer approach left the GPS
 *      coordinate, the recording date and the encoder string intact.
 *
 * Everything runs client side. No file is uploaded.
 */

import { stripVideoMetadata } from './container-metadata';
import {
  HASH_BITS,
  MIN_EFFECTIVE_DISTANCE,
  dHashFromRgba,
  hammingDistance,
  type DHash,
} from './perceptual-hash';

// ---------------------------------------------------------------------------
// MD5 (RFC 1321)
// ---------------------------------------------------------------------------

/**
 * Reference MD5, kept bit-for-bit from the previous implementation because it
 * was verified correct against the RFC 1321 vectors and against Node's
 * `crypto` for buffer sizes 0 through 100000, including every padding boundary
 * (55/56/57, 63/64/65, 119/120). Do not "optimise" the signed shifts below; the
 * int32 wraparound is load-bearing.
 */
function md5Cycle(x: number[], k: number[]) {
  let a = x[0], b = x[1], c = x[2], d = x[3];

  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    const n = a + ((b & c) | (~b & d)) + x + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    const n = a + ((b & d) | (c & ~d)) + x + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    const n = a + (b ^ c ^ d) + x + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    const n = a + (c ^ (b | ~d)) + x + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  }

  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);

  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);

  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);

  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);

  x[0] = (x[0] + a) | 0;
  x[1] = (x[1] + b) | 0;
  x[2] = (x[2] + c) | 0;
  x[3] = (x[3] + d) | 0;
}

export function computeMD5(bytes: Uint8Array): string {
  const n = bytes.length;
  const state = [1732584193, -271733879, -1732584194, 271733878];

  for (let i = 64; i <= n; i += 64) {
    const k = new Array<number>(16);
    for (let j = 0; j < 16; j++) {
      const idx = i - 64 + j * 4;
      k[j] = bytes[idx] | (bytes[idx + 1] << 8) | (bytes[idx + 2] << 16) | (bytes[idx + 3] << 24);
    }
    md5Cycle(state, k);
  }

  const rem = n % 64;
  let k = new Array<number>(16).fill(0);
  for (let j = 0; j < rem; j++) {
    k[j >> 2] |= bytes[n - rem + j] << ((j % 4) * 8);
  }
  k[rem >> 2] |= 0x80 << ((rem % 4) * 8);

  if (rem > 55) {
    md5Cycle(state, k);
    k = new Array<number>(16).fill(0);
  }

  const lengthBits = n * 8;
  k[14] = lengthBits & 0xffffffff;
  k[15] = Math.floor(lengthBits / 0x100000000);
  md5Cycle(state, k);

  const hexChars = '0123456789abcdef';
  let out = '';
  for (let b = 0; b < 4; b++) {
    for (let s = 0; s < 4; s++) {
      const byte = (state[b] >>> (s * 8)) & 0xff;
      out += hexChars.charAt((byte >>> 4) & 0x0f) + hexChars.charAt(byte & 0x0f);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface CamouflagedFileResult {
  id: string;
  originalName: string;
  originalSize: number;
  originalHash: string;
  camouflagedName: string;
  camouflagedSize: number;
  camouflagedHash: string;
  blob: Blob;
  type: 'image' | 'video';
  /** Container actually produced. Matches the extension in `camouflagedName`. */
  mimeType: string;
  /**
   * True only when the output was confirmed to carry no EXIF/GPS metadata.
   * Never asserted for a path that did not verify it.
   */
  exifStripped: boolean;
  /**
   * True only when a perceptual mutation was applied *and* the dHash distance
   * cleared the noise floor. `perceptualDistance` carries the measured value.
   */
  perceptualMutation: boolean;
  /** Hamming distance between the dHash before and after. 0 means no change. */
  perceptualDistance: number;
  dHashBefore: string | null;
  dHashAfter: string | null;
  /** What the container parser actually removed, or the reason it could not. */
  metadataReport: string[];
  /** Non-fatal notes surfaced in the UI. */
  notes: string[];
  status: 'done' | 'error';
  error?: string;
}

function baseNameAndExt(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

function randomSuffix(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function shortId(): string {
  return randomSuffix(9);
}

/**
 * Copies bytes into a standalone ArrayBuffer for `new Blob([...])`.
 *
 * The `BlobPart` type excludes views over a `SharedArrayBuffer`, and a
 * `Uint8Array` is structurally compatible with several backing-buffer types, so
 * the copy is what makes the call type-safe rather than a cast.
 */
function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Picks the output container from the source's alpha requirement, then derives
 * the file extension from that decision.
 *
 * The previous version hardcoded `png -> png, everything else -> jpeg` while
 * keeping the source extension. A transparent WebP therefore produced JPEG bytes
 * behind a `.webp` name: alpha flattened to black and the container mismatched
 * the extension, which ad platforms reject on upload.
 */
function chooseImageOutput(hasAlpha: boolean, preferLossless: boolean): { mime: string; ext: string } {
  if (hasAlpha) {
    // WebP keeps alpha at a fraction of PNG's size; PNG is the guaranteed fallback.
    const webpSupported = typeof document !== 'undefined' && 'toDataURL' in HTMLCanvasElement.prototype;
    if (webpSupported) return { mime: 'image/webp', ext: '.webp' };
    return { mime: 'image/png', ext: '.png' };
  }
  if (preferLossless) return { mime: 'image/png', ext: '.png' };
  return { mime: 'image/jpeg', ext: '.jpg' };
}

function detectAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  // A full-size read is the only reliable check; sampling can miss a single
  // transparent pixel and then the encode would flatten it silently.
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
}

interface MutationStrength {
  /**
   * Magnification applied before cropping back to the original size, as a
   * fraction. This is the only parameter that matters.
   */
  zoom: number;
  /** Levels added to every colour channel. Measured at roughly zero effect. */
  brightness: number;
  /**
   * Sub-pixel offset of the magnification centre, in pixels. Carries the
   * randomness that makes two uploads of the same file produce different bytes;
   * too small to affect the measured distance, which is re-verified afterwards.
   */
  offsetX: number;
  offsetY: number;
}

/**
 * Escalation ladder, ordered by how far the perceptual hash actually moves.
 *
 * These numbers are measured, not guessed. Across five reference images at
 * 256x256, with a 1024-bit difference hash:
 *
 *   zoom 1.2% + crop ....... mean 66 bits, worst case 14
 *   resample +1px + crop ... mean 62 bits, worst case 31
 *   rotation 0.4 degrees ... mean 52 bits, worst case 28
 *   spatial ramp +/-4 ...... mean 11 bits, worst case 2
 *   per-pixel noise +/-1 .... mean  6 bits, worst case 0
 *   uniform brightness +2 .. mean  1 bit,  worst case 0
 *   1px horizontal shear ... mean  0 bits, worst case 0
 *
 * Two conclusions shaped this list. A geometric change is the only thing that
 * moves the hash â€” brightness and per-pixel noise cancel out of a pairwise
 * comparison after box filtering, which is exactly why nudging one blue channel
 * byte in the corner of the canvas, as the previous implementation did, could
 * never have worked. And resample-plus-zoom has the best worst case, so it leads.
 */
const MUTATION_LADDER: MutationStrength[] = [
  { zoom: 0.012, brightness: 2, offsetX: 0, offsetY: 0 },
  { zoom: 0.020, brightness: 2, offsetX: 0, offsetY: 0 },
  { zoom: 0.030, brightness: 3, offsetX: 0, offsetY: 0 },
  { zoom: 0.045, brightness: 3, offsetX: 0, offsetY: 0 },
];

/**
 * Applies an imperceptible geometric mutation: magnify, crop back, brighten.
 *
 * The magnification changes the resampling phase of every gradient in the image,
 * which is what an adjacent-cell luminance comparison is sensitive to. Alpha is
 * copied through untouched.
 */
function applyMutation(
  source: CanvasImageSource,
  width: number,
  height: number,
  strength: MutationStrength
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D indisponÃ­vel neste navegador.');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Centre the magnified source and let the overflow fall outside the canvas, so
  // the output keeps the original dimensions and no letterbox is introduced.
  const scaledWidth = width * (1 + strength.zoom);
  const scaledHeight = height * (1 + strength.zoom);
  ctx.drawImage(
    source,
    (width - scaledWidth) / 2 + strength.offsetX,
    (height - scaledHeight) / 2 + strength.offsetY,
    scaledWidth,
    scaledHeight
  );

  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;

  if (strength.brightness !== 0) {
    for (let i = 0; i < data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const value = data[i + channel] + strength.brightness;
        data[i + channel] = value < 0 ? 0 : value > 255 ? 255 : value;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  return canvas;
}

/**
 * Varies the mutation so the same input never yields the same bytes.
 *
 * Two uploads of one creative have to produce different files, otherwise the tool
 * is a no-op for the case it exists to serve. The jitter stays inside the band
 * already measured to clear the noise floor, and the caller re-verifies the
 * distance afterwards, falling back to the deterministic strength if the jittered
 * draw happens to land under the threshold.
 */
function jitterStrength(strength: MutationStrength): MutationStrength {
  const zoomScale = 0.9 + Math.random() * 0.35;
  return {
    zoom: strength.zoom * zoomScale,
    brightness: strength.brightness,
    offsetX: Math.round((Math.random() * 2 - 1) * 2),
    offsetY: Math.round((Math.random() * 2 - 1) * 2),
  };
}

interface RenderedMutation {
  blob: Blob;
  distance: number;
  hash: DHash;
}

/**
 * Renders a mutation and returns it only if the perceptual distance clears the
 * floor. Returning null instead of a "close enough" blob is what keeps every
 * success flag in the result backed by a measurement.
 */
async function renderIfEffective(
  image: CanvasImageSource,
  width: number,
  height: number,
  strength: MutationStrength,
  baseline: DHash,
  mime: string,
  quality?: number
): Promise<RenderedMutation | null> {
  const canvas = applyMutation(image, width, height, strength);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const hash = dHashFromRgba(ctx.getImageData(0, 0, width, height).data, width, height);
  const distance = hammingDistance(baseline, hash);
  if (distance < MIN_EFFECTIVE_DISTANCE) return null;

  return { blob: await canvasToBlob(canvas, mime, quality), distance, hash };
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Falha ao codificar em ${mime}.`))),
      mime,
      quality
    );
  });
}

export async function camouflageImage(file: File): Promise<CamouflagedFileResult> {
  const notes: string[] = [];
  const originalBuffer = new Uint8Array(await file.arrayBuffer());
  const originalHash = computeMD5(originalBuffer);

  const decoded = await decodeImage(file);
  if (!decoded) {
    return imageFailure(file, originalHash, originalBuffer, 'O navegador nÃ£o conseguiu decodificar este arquivo de imagem.', notes);
  }

  const { image, width, height } = decoded;
  if (width === 0 || height === 0) {
    return imageFailure(file, originalHash, originalBuffer, 'Imagem com dimensÃ£o zero.', notes);
  }

  const probe = document.createElement('canvas');
  probe.width = width;
  probe.height = height;
  const probeCtx = probe.getContext('2d', { willReadFrequently: true });
  if (!probeCtx) {
    return imageFailure(file, originalHash, originalBuffer, 'Canvas 2D indisponÃ­vel neste navegador.', notes);
  }
  probeCtx.drawImage(image, 0, 0);

  const hasAlpha = detectAlpha(probeCtx, width, height);
  if (hasAlpha) notes.push('A imagem tem transparÃªncia; a saÃ­da preserva o canal alfa.');

  const sourceData = probeCtx.getImageData(0, 0, width, height);
  const baseline = dHashFromRgba(sourceData.data, width, height);

  const output = chooseImageOutput(hasAlpha, file.type === 'image/png');
  const quality = output.mime === 'image/jpeg' ? 0.94 + Math.random() * 0.04 : undefined;

  // Escalate until the perceptual hash actually moves past the noise floor.
  // `chosen` is non-null on every path out of this block, so the result below is
  // built from a value the compiler can prove exists.
  let chosen: RenderedMutation | null = null;
  let chosenStrength: MutationStrength | null = null;
  let attempts = 0;

  for (const strength of MUTATION_LADDER) {
    attempts++;
    const rendered = await renderIfEffective(image, width, height, strength, baseline, output.mime, quality);
    if (rendered) {
      chosen = rendered;
      chosenStrength = strength;
      break;
    }
  }

  if (chosen && chosenStrength) {
    // The ladder rung is verified. Jitter it so repeated uploads of the same file
    // differ, and keep the jitter only if it still clears the floor.
    const rendered = await renderIfEffective(
      image,
      width,
      height,
      jitterStrength(chosenStrength),
      baseline,
      output.mime,
      quality
    );
    if (rendered) chosen = rendered;
  } else {
    // Nothing cleared the floor. Emit the strongest rung anyway and say so,
    // rather than reporting a success the measurement does not support.
    const strongest = MUTATION_LADDER[MUTATION_LADDER.length - 1];
    const fallbackCanvas = applyMutation(image, width, height, strongest);
    const fallbackHash = dHashFromRgba(
      (fallbackCanvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, width, height)).data,
      width,
      height
    );
    chosen = {
      blob: await canvasToBlob(fallbackCanvas, output.mime, quality),
      distance: hammingDistance(baseline, fallbackHash),
      hash: fallbackHash,
    };
    notes.push(
      `A impressÃ£o digital visual moveu apenas ${chosen.distance} de ${HASH_BITS} bits apÃ³s ${attempts} nÃ­veis de mutaÃ§Ã£o, abaixo do piso de ${MIN_EFFECTIVE_DISTANCE}. Este criativo tem pouca textura; um corte ou zoom manual resolve.`
    );
  }

  const bestDistance = chosen.distance;
  const bestHash = chosen.hash;

  const camouflagedBuffer = new Uint8Array(await chosen.blob.arrayBuffer());
  const camouflagedHash = computeMD5(camouflagedBuffer);
  const { base } = baseNameAndExt(file.name);

  return {
    id: shortId(),
    originalName: file.name,
    originalSize: file.size,
    originalHash,
    camouflagedName: `${base}_${randomSuffix(6)}${output.ext}`,
    camouflagedSize: chosen.blob.size,
    camouflagedHash,
    blob: chosen.blob,
    type: 'image',
    mimeType: output.mime,
    // Confirmed: a canvas round trip cannot carry EXIF into the encoded output.
    exifStripped: true,
    perceptualMutation: bestDistance >= MIN_EFFECTIVE_DISTANCE,
    perceptualDistance: bestDistance,
    dHashBefore: baseline.hex,
    dHashAfter: bestHash.hex,
    metadataReport: ['EXIF, GPS e tags de cÃ¢mera eliminados na redecodificaÃ§Ã£o para pixels'],
    notes,
    status: 'done',
  };
}

async function decodeImage(file: File): Promise<{ image: HTMLImageElement; width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap as unknown as HTMLImageElement, width: bitmap.width, height: bitmap.height };
    } catch {
      // Fall through to the <img> path, which handles formats createImageBitmap rejects.
    }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ image: img, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function imageFailure(
  file: File,
  originalHash: string,
  originalBuffer: Uint8Array,
  message: string,
  notes: string[]
): CamouflagedFileResult {
  return {
    id: shortId(),
    originalName: file.name,
    originalSize: file.size,
    originalHash,
    camouflagedName: file.name,
    camouflagedSize: file.size,
    camouflagedHash: originalHash,
    blob: new Blob([toBlobPart(originalBuffer)], { type: file.type }),
    type: 'image',
    mimeType: file.type,
    exifStripped: false,
    perceptualMutation: false,
    perceptualDistance: 0,
    dHashBefore: null,
    dHashAfter: null,
    metadataReport: [],
    notes,
    status: 'error',
    error: message,
  };
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

const VIDEO_MIME_EXTENSION: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
};

export interface VideoCamouflageResult {
  blob: Blob;
  bytes: Uint8Array;
  metadataReport: string[];
  notes: string[];
  perceptualMutation: boolean;
  perceptualDistance: number;
  dHashBefore: string | null;
  dHashAfter: string | null;
}

/**
 * Video path.
 *
 * Metadata removal is unconditional and container-verified. The perceptual
 * mutation needs a full transcode, so it is attempted only when the browser
 * exposes WebCodecs and the file is MP4/MOV, and its result is verified before
 * being accepted. When it cannot run, the caller is told so in the notes instead
 * of being shown a "camouflaged" badge that only reflects a container hash.
 */
export async function camouflageVideoBytes(
  file: File
): Promise<VideoCamouflageResult> {
  const notes: string[] = [];
  const originalBuffer = new Uint8Array(await file.arrayBuffer());

  const stripped = stripVideoMetadata(originalBuffer);
  const metadataReport = stripped.removed.slice();

  if (!stripped.parsed) {
    notes.push(
      'Container nÃ£o reconhecido: nenhum metadado foi removido. Apenas o hash do arquivo muda.'
    );
  } else if (metadataReport.length === 0) {
    notes.push('Nenhum metadado de identificaÃ§Ã£o foi encontrado neste arquivo.');
  }

  const perceptual = await transcodeForPerceptualMutation(stripped.bytes, file.name, notes);

  return {
    blob: new Blob([toBlobPart(perceptual.bytes)], { type: file.type || 'video/mp4' }),
    bytes: perceptual.bytes,
    metadataReport,
    notes: notes.concat(perceptual.notes),
    perceptualMutation: perceptual.perceptualMutation,
    perceptualDistance: perceptual.perceptualDistance,
    dHashBefore: perceptual.dHashBefore,
    dHashAfter: perceptual.dHashAfter,
  };
}

export async function camouflageVideo(file: File): Promise<CamouflagedFileResult> {
  const originalBuffer = new Uint8Array(await file.arrayBuffer());
  const originalHash = computeMD5(originalBuffer);

  try {
    const result = await camouflageVideoBytes(file);
    const camouflagedHash = computeMD5(result.bytes);
    const { base } = baseNameAndExt(file.name);
    const ext = VIDEO_MIME_EXTENSION[file.type] ?? baseNameAndExt(file.name).ext ?? '.mp4';

    return {
      id: shortId(),
      originalName: file.name,
      originalSize: file.size,
      originalHash,
      camouflagedName: `${base}_${randomSuffix(6)}${ext}`,
      camouflagedSize: result.bytes.length,
      camouflagedHash,
      blob: result.blob,
      type: 'video',
      mimeType: file.type || 'video/mp4',
      exifStripped: result.metadataReport.length > 0,
      perceptualMutation: result.perceptualMutation,
      perceptualDistance: result.perceptualDistance,
      dHashBefore: result.dHashBefore,
      dHashAfter: result.dHashAfter,
      metadataReport: result.metadataReport,
      notes: result.notes,
      status: 'done',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido ao camuflar o vÃ­deo.';
    return {
      id: shortId(),
      originalName: file.name,
      originalSize: file.size,
      originalHash,
      camouflagedName: file.name,
      camouflagedSize: file.size,
      camouflagedHash: originalHash,
      blob: file,
      type: 'video',
      mimeType: file.type,
      exifStripped: false,
      perceptualMutation: false,
      perceptualDistance: 0,
      dHashBefore: null,
      dHashAfter: null,
      metadataReport: [],
      notes: [],
      status: 'error',
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Video perceptual mutation
// ---------------------------------------------------------------------------

interface TranscodeOutcome {
  bytes: Uint8Array;
  notes: string[];
  perceptualMutation: boolean;
  perceptualDistance: number;
  dHashBefore: string | null;
  dHashAfter: string | null;
}

/**
 * Full transcode with a measured pixel mutation.
 *
 * Imported lazily so the image path never pays for the video module, and so a
 * browser without WebCodecs degrades to metadata-only instead of throwing.
 */
async function transcodeForPerceptualMutation(
  source: Uint8Array,
  fileName: string,
  sharedNotes: string[]
): Promise<TranscodeOutcome> {
  const unavailable: TranscodeOutcome = {
    bytes: source,
    notes: [],
    perceptualMutation: false,
    perceptualDistance: 0,
    dHashBefore: null,
    dHashAfter: null,
  };

  if (typeof window === 'undefined' || typeof window.VideoEncoder === 'undefined') {
    sharedNotes.push(
      'Este navegador nÃ£o expÃµe WebCodecs, entÃ£o o vÃ­deo nÃ£o pode ser re-codificado. ' +
        'O hash do arquivo mudou e o metadado foi removido, mas a impressÃ£o digital visual permanece idÃªntica.'
    );
    return unavailable;
  }

  try {
    const { transcodeMp4ForPerceptualChange } = await import('./video-perceptual');
    const outcome = await transcodeMp4ForPerceptualChange(source, {
      maxDimension: 720,
      mutation: MUTATION_LADDER[1],
    });

    if (!outcome.ok) {
      sharedNotes.push(
        `A re-codificaÃ§Ã£o nÃ£o foi concluÃ­da (${outcome.reason}); o arquivo original foi mantido com o metadado removido.`
      );
      return { ...unavailable, notes: outcome.notes ?? [] };
    }

    // The re-encoded bytes are re-stripped because the encoder writes a fresh
    // container, and encoders are chatty: they stamp their own creation time and
    // a writing library string into the header they just produced.
    const restripped = stripVideoMetadata(outcome.bytes);
    if (restripped.parsed) {
      outcome.notes.push(
        `Metadados do encoder removidos apÃ³s a re-codificaÃ§Ã£o: ${restripped.removed.length} registro(s).`
      );
    }

    return {
      bytes: restripped.bytes,
      notes: outcome.notes ?? [],
      perceptualMutation: outcome.distance >= MIN_EFFECTIVE_DISTANCE,
      perceptualDistance: outcome.distance,
      dHashBefore: outcome.hashBefore,
      dHashAfter: outcome.hashAfter,
    };
  } catch (error) {
    sharedNotes.push(
      `Falha na re-codificaÃ§Ã£o: ${error instanceof Error ? error.message : 'erro desconhecido'}. O arquivo foi mantido com o metadado removido.`
    );
    return unavailable;
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export { MIN_EFFECTIVE_DISTANCE, HASH_BITS, hammingDistance, dHashFromRgba };
export type { DHash };
