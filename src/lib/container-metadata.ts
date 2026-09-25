/**
 * Container metadata neutralisation for video files.
 *
 * The previous implementation appended a 50-byte trailer to the end of the file
 * and reported `exifStripped: true`. Nothing was stripped: the GPS coordinate,
 * the creation timestamp and the encoder string all survived verbatim, which
 * `ffprobe` confirmed byte for byte. This module parses the container and
 * actually destroys the metadata that carries them.
 *
 * Two container families are handled:
 *   - ISO BMFF: MP4, M4V, MOV, 3GP  (box tree, 32/64-bit sizes)
 *   - Matroska: WebM, MKV          (EBML element tree, variable-length integers)
 *
 * Two invariants drive the design:
 *
 *  1. Media payload is never rewritten. Decoded pixels are bit-identical before
 *     and after; only metadata atoms change.
 *
 *  2. For ISO BMFF the output has the *same length* as the input. `stco`/`co64`
 *     store absolute byte offsets into `mdat`; deleting bytes ahead of `mdat`
 *     shifts the file under those offsets and every sample decodes as garbage.
 *     Metadata atoms are therefore overwritten in place rather than removed:
 *     a neutralised atom is replaced by an equal-length `free` box and its
 *     former payload is zeroed. The file keeps its geometry, the metadata is
 *     genuinely gone, and no offset needs patching.
 *
 *     An earlier revision of this module removed the atoms outright and produced
 *     files that reported the right duration and frame count while failing to
 *     decode a single NAL unit. Length preservation is what prevents that.
 */

const UINT32_SIZE = 4;
const LARGE_SIZE_FLAG = 1;
const TO_EOF_SIZE = 0;

export interface StripResult {
  bytes: Uint8Array;
  /** Human-readable list of what was neutralised, for honest reporting. */
  removed: string[];
  format: 'mp4' | 'matroska' | 'unknown';
  changed: boolean;
  /** False when the container was left untouched because it could not be parsed. */
  parsed: boolean;
}

export function detectVideoFormat(bytes: Uint8Array): StripResult['format'] {
  if (bytes.length < 8) return 'unknown';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'matroska';
  }
  const type = readType(bytes, 4);
  if (type === 'ftyp' || type === 'moov' || type === 'free' || type === 'skip' || type === 'styp') {
    return 'mp4';
  }
  return 'unknown';
}

export function stripVideoMetadata(bytes: Uint8Array): StripResult {
  const format = detectVideoFormat(bytes);
  if (format === 'mp4') return stripIsoBmff(bytes);
  if (format === 'matroska') return stripMatroska(bytes);
  return { bytes, removed: [], format: 'unknown', changed: false, parsed: false };
}

// ---------------------------------------------------------------------------
// ISO BMFF — in-place, length preserving
// ---------------------------------------------------------------------------

interface BoxRef {
  type: string;
  start: number;
  /** Total box length including its 8- or 16-byte header. */
  length: number;
  /** Bytes consumed by the header; the rest of the header area is box payload. */
  headerSize: number;
  /** Offset of the first payload byte. */
  bodyStart: number;
  end: number;
}

const BMFF_CONTAINERS = new Set([
  'moov', 'trak', 'edts', 'mdia', 'minf', 'dinf', 'stbl',
  'moof', 'traf', 'mvex', 'iprp', 'ipco', 'sinf', 'schi',
  'meco', 'mere', 'strk', 'strd', 'tref', 'hnti', 'hinf',
]);

/**
 * `meta` and `stsd` are FullBoxes: a fixed preamble sits between the box header
 * and the child boxes. `stsd` is walked for `uuid` boxes only — recursing into a
 * sample entry would misparse, because VisualSampleEntry carries 78 bytes of
 * fields before its own child boxes.
 */
const BMFF_FULLBOX_PREAMBLE: Record<string, number> = { meta: 4, stsd: 4 };

/**
 * Atoms whose payload is identifying data and is overwritten with `free` + zeros.
 * `udta` is the one that matters: it holds the iTunes/QuickTime tag list,
 * including the `©xyz` atom that stores GPS coordinates and `©day` for the
 * recording date. `uuid` holds vendor extensions and XMP packets.
 */
const BMFF_NEUTRALISE = new Set(['udta', 'meta', 'ilst', 'uuid', 'sinf', 'schi']);

/** Header atoms whose creation/modification timestamps are zeroed in place. */
const BMFF_TIMESTAMP_BOXES = new Set(['mvhd', 'tkhd', 'mdhd', 'mehd']);

function stripIsoBmff(bytes: Uint8Array): StripResult {
  const removed: string[] = [];
  const output = bytes.slice();
  walkIsoBmff(output, 0, bytes.length, removed, 0);

  return {
    bytes: output,
    removed,
    format: 'mp4',
    changed: removed.length > 0,
    parsed: true,
  };
}

function walkIsoBmff(
  target: Uint8Array,
  start: number,
  end: number,
  removed: string[],
  depth: number
): void {
  for (const box of readBoxes(target, start, end)) {
    if (BMFF_NEUTRALISE.has(box.type)) {
      if (box.length >= 8) {
        neutraliseBox(target, box);
        removed.push(`${indent(depth)}${BOX_LABELS[box.type] ?? box.type} (${box.type}, ${box.length} bytes zerados)`);
      }
      continue;
    }

    if (BMFF_TIMESTAMP_BOXES.has(box.type)) {
      if (zeroTimestamps(target, box)) {
        removed.push(`${indent(depth)}${box.type}: data de criação e modificação zerada`);
      }
      continue;
    }

    const preamble = BMFF_FULLBOX_PREAMBLE[box.type];
    if (preamble !== undefined || BMFF_CONTAINERS.has(box.type)) {
      const childStart = box.bodyStart + (preamble ?? 0);
      if (childStart <= box.end) {
        walkIsoBmff(target, childStart, box.end, removed, depth + 1);
      }
    }
  }
}

function readBoxes(bytes: Uint8Array, start: number, end: number): BoxRef[] {
  const boxes: BoxRef[] = [];
  let offset = start;

  while (offset + UINT32_SIZE * 2 <= end) {
    let size = readUint32(bytes, offset);
    const type = readType(bytes, offset + UINT32_SIZE);
    let headerSize = 8;

    if (size === LARGE_SIZE_FLAG) {
      if (offset + 16 > end) break;
      size = readUint64(bytes, offset + 8);
      headerSize = 16;
    } else if (size === TO_EOF_SIZE) {
      size = end - offset;
    }

    // A zero or out-of-range size means the writer's atom tree disagrees with the
    // byte count. Stop descending rather than corrupt the output.
    if (size < headerSize || offset + size > end) break;

    const bodyStart = type === 'uuid' ? offset + headerSize + 16 : offset + headerSize;
    if (bodyStart > offset + size) break;

    boxes.push({ type, start: offset, length: size, headerSize, bodyStart, end: offset + size });
    offset += size;
  }

  return boxes;
}

/**
 * Overwrites an atom with an equal-length `free` box and zeros its former body.
 *
 * `free` is the ISO BMFF padding box, legal at any nesting level, ignored by
 * every demuxer, and carries no payload — so the metadata stops existing while
 * the file's byte geometry, and therefore every chunk offset in it, is preserved.
 */
function neutraliseBox(target: Uint8Array, box: BoxRef) {
  // Header: size stays, type becomes 'free'.
  target[box.start + 4] = 0x66; // f
  target[box.start + 5] = 0x72; // r
  target[box.start + 6] = 0x65; // e
  target[box.start + 7] = 0x65; // e
  target.fill(0, box.start + 8, box.end);
}

/**
 * Zeros creation and modification times in mvhd/tkhd/mdhd/mehd.
 *
 * Version 0 stores 32-bit seconds, version 1 stores 64-bit. Zeroing rather than
 * deleting keeps track structure and duration valid, and the edit is the same
 * length as the original so no offset moves.
 */
function zeroTimestamps(target: Uint8Array, box: BoxRef): boolean {
  const base = box.start + box.headerSize;
  if (base + 4 > box.end) return false;

  const version = target[base];
  const timeSize = version === 1 ? 8 : 4;
  const span = timeSize * 2;
  if (base + 4 + span > box.end) return false;

  const creationAt = base + 4;
  let alreadyZero = true;
  for (let i = 0; i < span; i++) {
    if (target[creationAt + i] !== 0) {
      alreadyZero = false;
      break;
    }
  }
  if (alreadyZero) return false;

  target.fill(0, creationAt, creationAt + span);
  return true;
}

const BOX_LABELS: Record<string, string> = {
  udta: 'metadados do usuário (inclui coordenada GPS ©xyz e data ©day)',
  meta: 'metadados do container (iTunes / Android)',
  ilst: 'lista de tags',
  uuid: 'bloco de tipo estendido (XMP, dados de fabricante)',
  sinf: 'informação de proteção de DRM',
  schi: 'esquema de proteção de DRM',
};

function indent(depth: number): string {
  return depth > 0 ? '  '.repeat(depth) : '';
}

// ---------------------------------------------------------------------------
// Matroska / WebM
// ---------------------------------------------------------------------------

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_SEEK_HEAD = 0x114d9b74;
const ID_INFO = 0x1549a966;
const ID_CUES = 0x1c53bb6b;
const ID_TAGS = 0x1254c367;
const ID_CHAPTERS = 0x1043a770;
const ID_ATTACHMENTS = 0x1941a469;
const ID_VOID = 0xec;
const ID_CRC32 = 0xbf;

/**
 * Segment Info fields dropped.
 *
 * `Duration` is deliberately kept: Cues are removed below, and without an
 * explicit duration in Info the demuxer can no longer report a length, which
 * turns a scrubbable file into one that only plays linearly. Duration is
 * structural, not identifying.
 */
const INFO_DROP = new Map<number, string>([
  [0x4461, 'DateUTC (data e hora da gravação)'],
  [0x7ba9, 'Title'],
  [0x4d80, 'MuxingApp'],
  [0x5741, 'WritingApp'],
  [0x73a4, 'SegmentUID'],
]);

/**
 * Segment-level elements removed. SeekHead and Cues are pure indexes whose
 * entries hold absolute file positions; leaving them in place after a resize
 * would point a demuxer at the wrong byte, so they are dropped and the muxer
 * regenerates them on write.
 */
const MATROSKA_DROP = new Set<number>([
  ID_SEEK_HEAD,
  ID_CUES,
  ID_TAGS,
  ID_CHAPTERS,
  ID_ATTACHMENTS,
  ID_VOID,
  ID_CRC32,
]);

interface EbmlElement {
  id: number;
  idLength: number;
  size: number;
  sizeLength: number;
  /** Offset of the element's first ID byte. */
  start: number;
  dataStart: number;
  end: number;
}

function stripMatroska(bytes: Uint8Array): StripResult {
  const removed: string[] = [];

  const header = readEbmlElement(bytes, 0);
  if (!header || header.id !== ID_EBML) {
    return { bytes, removed, format: 'matroska', changed: false, parsed: false };
  }

  const segment = readEbmlElement(bytes, header.end);
  if (!segment || segment.id !== ID_SEGMENT) {
    return { bytes, removed, format: 'matroska', changed: false, parsed: false };
  }

  const children: Uint8Array[] = [];
  let offset = segment.dataStart;

  while (offset < segment.end) {
    const element = readEbmlElement(bytes, offset);
    if (!element) break;

    if (element.id === ID_INFO) {
      children.push(rewriteSegmentInfo(bytes, element, removed));
    } else if (MATROSKA_DROP.has(element.id)) {
      removed.push(`Matroska: ${describeEbmlId(element.id)}`);
    } else {
      // Cluster, Tracks and anything unrecognised pass through byte for byte,
      // so the media payload is never touched.
      children.push(bytes.subarray(offset, element.end));
    }

    offset = element.end;
  }

  const body = concat(...children);
  if (body.length === segment.end - segment.dataStart) {
    return { bytes, removed, format: 'matroska', changed: false, parsed: true };
  }

  // The Segment header's size no longer matches its payload, so the size field is
  // re-encoded. A container claiming more bytes than it holds makes strict
  // parsers fail outright.
  const idBytes = bytes.subarray(segment.start, segment.start + segment.idLength);
  return {
    bytes: concat(bytes.subarray(0, header.end), idBytes, encodeEbmlSize(body.length), body),
    removed,
    format: 'matroska',
    changed: true,
    parsed: true,
  };
}

function rewriteSegmentInfo(
  bytes: Uint8Array,
  element: EbmlElement,
  removed: string[]
): Uint8Array {
  const children: Uint8Array[] = [];
  let offset = element.dataStart;
  let dropped = 0;

  while (offset < element.end) {
    const child = readEbmlElement(bytes, offset);
    if (!child) break;
    const label = INFO_DROP.get(child.id);
    if (label) {
      removed.push(`Segment Info: ${label}`);
      dropped++;
    } else {
      children.push(bytes.subarray(offset, child.end));
    }
    offset = child.end;
  }

  if (dropped === 0) return bytes.subarray(element.start, element.end);

  // The size vint shrinks with the payload, so the header is re-encoded. The ID
  // bytes are copied verbatim because they are the element identity, not a length.
  const idBytes = bytes.subarray(element.start, element.start + element.idLength);
  const payload = concat(...children);
  return concat(idBytes, encodeEbmlSize(payload.length), payload);
}

function readEbmlElement(bytes: Uint8Array, offset: number): EbmlElement | null {
  if (offset >= bytes.length) return null;

  const id = readEbmlId(bytes, offset);
  if (!id) return null;

  const sizeStart = offset + id.length;
  const size = readEbmlSize(bytes, sizeStart);
  if (!size) return null;

  const dataStart = sizeStart + size.length;
  const end = size.unknown ? bytes.length : dataStart + size.value;
  if (end > bytes.length) return null;

  return {
    id: id.value,
    idLength: id.length,
    size: size.value,
    sizeLength: size.length,
    start: offset,
    dataStart,
    end,
  };
}

/**
 * Reads an EBML element ID and its encoded length.
 *
 * The length must come from the leading marker bits, never from the numeric
 * value. Single-byte IDs like Void (0xEC) and CRC-32 (0xBF) are small numbers
 * that a value-derived guess misreads as two bytes, which desynchronises every
 * element after them and truncates the file to a few dozen bytes.
 */
function readEbmlId(bytes: Uint8Array, offset: number): { value: number; length: number } | null {
  const first = bytes[offset];
  if (first === undefined || first === 0) return null;
  let length = 0;
  for (let bit = 0; bit < 4; bit++) {
    if (first & (0x80 >> bit)) {
      length = bit + 1;
      break;
    }
  }
  if (length === 0) return null;
  let value = 0;
  for (let i = 0; i < length; i++) {
    value = value * 256 + bytes[offset + i];
  }
  return { value, length };
}

function readEbmlSize(
  bytes: Uint8Array,
  offset: number
): { value: number; length: number; unknown: boolean } | null {
  const first = bytes[offset];
  if (first === undefined) return null;

  let length = 0;
  for (let bit = 0; bit < 8; bit++) {
    if (first & (0x80 >> bit)) {
      length = bit + 1;
      break;
    }
  }
  if (length === 0 || offset + length > bytes.length) return null;

  let value = first & (0xff >> length);
  let allOnes = value === (0xff >> length);
  for (let i = 1; i < length; i++) {
    const byte = bytes[offset + i];
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }

  return { value, length, unknown: length === 8 && allOnes };
}

function encodeEbmlSize(value: number): Uint8Array {
  for (let length = 1; length <= 8; length++) {
    const max = Math.pow(2, 7 * length) - 1;
    if (value > max) continue;
    const out = new Uint8Array(length);
    let remaining = value;
    for (let i = length - 1; i >= 0; i--) {
      out[i] = remaining % 256;
      remaining = Math.floor(remaining / 256);
    }
    out[0] = out[0] | (0x80 >> (length - 1));
    return out;
  }
  return new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
}

const EBML_LABELS: Record<number, string> = {
  [ID_SEEK_HEAD]: 'índice SeekHead',
  [ID_CUES]: 'índice de busca Cues',
  [ID_TAGS]: 'Tags (tag de gravação: comentário, BPM, geo)',
  [ID_CHAPTERS]: 'Chapters',
  [ID_ATTACHMENTS]: 'Attachments (capa)',
  [ID_VOID]: 'Void (espaço reservado)',
  [ID_CRC32]: 'CRC-32',
};

function describeEbmlId(id: number): string {
  return EBML_LABELS[id] ?? `elemento 0x${id.toString(16)}`;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint64(bytes: Uint8Array, offset: number): number {
  return readUint32(bytes, offset) * 0x100000000 + readUint32(bytes, offset + 4);
}

function readType(bytes: Uint8Array, offset: number): string {
  if (offset + 4 > bytes.length) return '';
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function concat(...parts: Array<Uint8Array | null | undefined>): Uint8Array {
  const usable = parts.filter((p): p is Uint8Array => p instanceof Uint8Array);
  let total = 0;
  for (const part of usable) total += part.length;

  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of usable) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}
