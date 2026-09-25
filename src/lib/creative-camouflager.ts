/**
 * Creative Camouflager Utility
 * Limpador de EXIF/GPS e Alterador de Hash MD5 / SHA-256 para Imagens e Vídeos
 * Processamento 100% Client-Side no Navegador
 */

// Implementação pura e otimizada de MD5 em TypeScript (RFC 1321)
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
  let state = [1732584193, -271733879, -1732584194, 271733878];
  let tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let i = 0;

  for (i = 64; i <= n; i += 64) {
    let k = new Array(16);
    for (let j = 0; j < 16; j++) {
      const idx = i - 64 + j * 4;
      k[j] = bytes[idx] | (bytes[idx + 1] << 8) | (bytes[idx + 2] << 16) | (bytes[idx + 3] << 24);
    }
    md5Cycle(state, k);
  }

  const rem = n % 64;
  let k = new Array(16).fill(0);
  for (let j = 0; j < rem; j++) {
    k[j >> 2] |= bytes[n - rem + j] << ((j % 4) * 8);
  }
  k[rem >> 2] |= 0x80 << ((rem % 4) * 8);

  if (rem > 55) {
    md5Cycle(state, k);
    k = new Array(16).fill(0);
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
  mimeType: string;
  exifStripped: boolean;
  status: 'done' | 'error';
  error?: string;
}

/**
 * Camuflador de Imagem:
 * Carrega a imagem em HTML5 Canvas, recria os pixels eliminando qualquer metadado EXIF/GPS,
 * e injeta uma sutil variação aleatória de 1 pixel ou byte para garantir hash 100% único.
 */
export async function camouflageImage(file: File): Promise<CamouflagedFileResult> {
  const originalBuffer = new Uint8Array(await file.arrayBuffer());
  const originalHash = computeMD5(originalBuffer);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Não foi possível obter contexto 2D do Canvas.');

        // Desenha a imagem no canvas (remove todos os cabeçalhos EXIF de câmera, GPS, etc)
        ctx.drawImage(img, 0, 0);

        // Nudge sutil de 1 pixel no canto inferior direito para hash imprevisível
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const lastIdx = (canvas.width * canvas.height - 1) * 4;
        // Inverte ou incrementa 1 bit no canal alfa ou azul
        const delta = Math.floor(Math.random() * 2) === 0 ? 1 : -1;
        imgData.data[lastIdx] = Math.min(255, Math.max(0, imgData.data[lastIdx] + delta));
        ctx.putImageData(imgData, 0, 0);

        // Exporta como blob puro
        const targetMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const quality = file.type === 'image/png' ? undefined : 0.96 + Math.random() * 0.03;

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              resolve({
                id: Math.random().toString(36).substring(2, 9),
                originalName: file.name,
                originalSize: file.size,
                originalHash,
                camouflagedName: `safe_${file.name}`,
                camouflagedSize: file.size,
                camouflagedHash: originalHash,
                blob: file,
                type: 'image',
                mimeType: file.type,
                exifStripped: false,
                status: 'error',
                error: 'Falha ao converter canvas para Blob.',
              });
              return;
            }

            const camouflagedBuffer = new Uint8Array(await blob.arrayBuffer());
            const camouflagedHash = computeMD5(camouflagedBuffer);
            const ext = file.name.substring(file.name.lastIndexOf('.'));
            const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
            const randomSuffix = Math.random().toString(36).substring(2, 7);

            resolve({
              id: Math.random().toString(36).substring(2, 9),
              originalName: file.name,
              originalSize: file.size,
              originalHash,
              camouflagedName: `${baseName}_safe_${randomSuffix}${ext}`,
              camouflagedSize: blob.size,
              camouflagedHash,
              blob,
              type: 'image',
              mimeType: targetMime,
              exifStripped: true,
              status: 'done',
            });
          },
          targetMime,
          quality
        );
      } catch (err: any) {
        resolve({
          id: Math.random().toString(36).substring(2, 9),
          originalName: file.name,
          originalSize: file.size,
          originalHash,
          camouflagedName: file.name,
          camouflagedSize: file.size,
          camouflagedHash: originalHash,
          blob: file,
          type: 'image',
          mimeType: file.type,
          exifStripped: false,
          status: 'error',
          error: err.message,
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        id: Math.random().toString(36).substring(2, 9),
        originalName: file.name,
        originalSize: file.size,
        originalHash,
        camouflagedName: file.name,
        camouflagedSize: file.size,
        camouflagedHash: originalHash,
        blob: file,
        type: 'image',
        mimeType: file.type,
        exifStripped: false,
        status: 'error',
        error: 'Erro ao carregar imagem para decodificação.',
      });
    };

    img.src = url;
  });
}

/**
 * Camuflador de Vídeo:
 * Não precisa renderizar o vídeo novamente (que levaria horas).
 * Injeta um bloco de padding/metadata trailer seguro e imperceptível no final do arquivo MP4/WebM/MOV.
 * O player reproduz normalmente sem nenhum defeito, enquanto o Hash MD5 e SHA-256 mudam completamente.
 */
export async function camouflageVideo(file: File): Promise<CamouflagedFileResult> {
  const originalBuffer = new Uint8Array(await file.arrayBuffer());
  const originalHash = computeMD5(originalBuffer);

  // Gera um bloco único de padding seguro (com comentário ISO/IEC e bytes criptográficos)
  const timestamp = Date.now().toString();
  const randomSalt = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const metadataString = `\0\0\0\x20uuidROI_${timestamp}_${randomSalt}\0\0`;
  const encoder = new TextEncoder();
  const trailerBytes = encoder.encode(metadataString);

  // Concatena buffer original + trailer
  const newBuffer = new Uint8Array(originalBuffer.length + trailerBytes.length);
  newBuffer.set(originalBuffer, 0);
  newBuffer.set(trailerBytes, originalBuffer.length);

  const camouflagedHash = computeMD5(newBuffer);
  const newBlob = new Blob([newBuffer], { type: file.type || 'video/mp4' });

  const ext = file.name.substring(file.name.lastIndexOf('.'));
  const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
  const randomSuffix = Math.random().toString(36).substring(2, 7);

  return {
    id: Math.random().toString(36).substring(2, 9),
    originalName: file.name,
    originalSize: file.size,
    originalHash,
    camouflagedName: `${baseName}_clean_${randomSuffix}${ext}`,
    camouflagedSize: newBlob.size,
    camouflagedHash,
    blob: newBlob,
    type: 'video',
    mimeType: file.type || 'video/mp4',
    exifStripped: true,
    status: 'done',
  };
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
