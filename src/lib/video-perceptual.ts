/**
 * MP4 demux / remux plus a WebCodecs transcode used to move a creative's
 * perceptual hash.
 *
 * Why a transcode is required at all: appending bytes to a container, or
 * neutralising metadata atoms, changes the file's MD5 while leaving every
 * decoded pixel untouched. Platforms fingerprint the pixels, not the container,
 * so the only way to move that fingerprint is to re-encode altered frames. A
 * previous revision of this module appended a 50-byte trailer and reported
 * success; measured against the decoded frames, the dHash distance was 0 of 992.
 *
 * The pipeline is: parse the sample table -> feed samples to `VideoDecoder` ->
 * mutate each `VideoFrame` on a canvas -> feed frames to `VideoEncoder` ->
 * write a fresh MP4 with the same track layout, and copy the audio track through
 * untouched so the result is not silent.
 *
 * Everything is verified before it is returned. A transcode that cannot be
 * completed or cannot be validated yields `ok: false` with a reason, and the
 * caller keeps the metadata-only result rather than shipping a broken file.
 */

import {
  dHashFromRgba,
  hammingDistance,
  MIN_EFFECTIVE_DISTANCE,
  type DHash,
} from './perceptual-hash';

export interface MutationProfile {
  /**
   * Magnification applied before cropping back to the output size, as a fraction.
   * Measured as the only parameter that reliably moves a perceptual hash; a
   * brightness offset and per-pixel noise both cancel out of the adjacent-cell
   * comparison after downsampling.
   */
  zoom: number;
  /** Levels added to every colour channel. */
  brightness: number;
}

export interface TranscodeOptions {
  /** Longest edge of the output. Keeps the encode bounded on phones. */
  maxDimension: number;
  mutation: MutationProfile;
  /** Frames sampled for the before/after dHash comparison. */
  hashSamples?: number;
  /** Bitrate target. Defaults to a function of the output resolution. */
  bitrate?: number;
}

export type TranscodeResult =
  | {
      ok: true;
      bytes: Uint8Array;
      distance: number;
      hashBefore: string | null;
      hashAfter: string | null;
      notes: string[];
    }
  | { ok: false; reason: string; notes: string[] };

// ---------------------------------------------------------------------------
// MP4 parsing
// ---------------------------------------------------------------------------

interface BoxNode {
  type: string;
  start: number;
  headerSize: number;
  bodyStart: number;
  end: number;
  children: BoxNode[];
}

const CONTAINER_BOXES = new Set([
  'moov', 'trak', 'edts', 'mdia', 'minf', 'stbl', 'dinf', 'mvex', 'moof', 'traf',
]);

function readBoxes(bytes: Uint8Array, start: number, end: number, depth = 0): BoxNode[] {
  const boxes: BoxNode[] = [];
  let offset = start;

  while (offset + 8 <= end) {
    let size = readU32(bytes, offset);
    const type = readType(bytes, offset + 4);
    let headerSize = 8;

    if (size === 1) {
      if (offset + 16 > end) break;
      size = readU64(bytes, offset + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) break;

    const node: BoxNode = {
      type,
      start: offset,
      headerSize,
      bodyStart: offset + headerSize,
      end: offset + size,
      children: [],
    };

    // Guard the recursion: a malicious or corrupt tree can nest arbitrarily.
    if (depth < 8 && CONTAINER_BOXES.has(type)) {
      node.children = readBoxes(bytes, node.bodyStart, node.end, depth + 1);
    }

    boxes.push(node);
    offset += size;
  }

  return boxes;
}

function findBox(nodes: BoxNode[], path: string[]): BoxNode | null {
  let current: BoxNode[] = nodes;
  let found: BoxNode | null = null;
  for (const wanted of path) {
    found = current.find((box) => box.type === wanted) ?? null;
    if (!found) return null;
    current = found.children;
  }
  return found;
}

function findAll(nodes: BoxNode[], type: string): BoxNode[] {
  const out: BoxNode[] = [];
  const walk = (list: BoxNode[]) => {
    for (const box of list) {
      if (box.type === type) out.push(box);
      walk(box.children);
    }
  };
  walk(nodes);
  return out;
}

interface TrackInfo {
  id: number;
  timescale: number;
  duration: number;
  width: number;
  height: number;
  codec: string;
  samples: SampleEntry[];
  isVideo: boolean;
}

interface SampleEntry {
  dts: number;
  cts: number;
  duration: number;
  size: number;
  offset: number;
  isSync: boolean;
  description: Uint8Array | null;
}

interface ParsedTrack extends TrackInfo {
  stsdEntry: Uint8Array | null;
}

/**
 * Reads the video track's sample table.
 *
 * Only what the decoder needs is extracted: the codec string and the
 * description blob for `VideoDecoder.configure`, plus every sample's file
 * offset, size, timing and sync flag.
 */
function parseVideoTrack(bytes: Uint8Array, boxes: BoxNode[]): ParsedTrack | null {
  for (const trak of boxes.filter((box) => box.type === 'trak')) {
    const tkhd = findBox([trak], ['tkhd']);
    const mdhd = findBox([trak], ['mdhd']);
    const stbl = findBox([trak], ['mdia', 'minf', 'stbl']);
    if (!stbl) continue;

    const stsd = stbl.children.find((box) => box.type === 'stsd');
    if (!stsd) continue;

    const entry = readFirstSampleEntry(bytes, stsd);
    if (!entry) continue;
    if (!entry.codec.startsWith('avc') && !entry.codec.startsWith('hvc') &&
        !entry.codec.startsWith('hev') && !entry.codec.startsWith('vp') &&
        !entry.codec.startsWith('av01') && !entry.codec.startsWith('mp4v')) {
      continue;
    }

    const samples = readSampleTable(bytes, stbl, mdhd);
    if (samples.length === 0) continue;

    return {
      id: tkhd ? readTrackId(bytes, tkhd) : 1,
      timescale: mdhd ? readTimescale(bytes, mdhd) : 90000,
      duration: mdhd ? readMediaDuration(bytes, mdhd) : 0,
      width: entry.width,
      height: entry.height,
      codec: entry.codec,
      samples,
      isVideo: true,
      stsdEntry: entry.raw,
    };
  }
  return null;
}

interface SampleEntryInfo {
  codec: string;
  width: number;
  height: number;
  raw: Uint8Array;
}

function readFirstSampleEntry(bytes: Uint8Array, stsd: BoxNode): SampleEntryInfo | null {
  // stsd: version+flags(4) + entry_count(4), then entries.
  let offset = stsd.bodyStart + 8;
  if (offset + 8 > stsd.end) return null;

  let size = readU32(bytes, offset);
  let headerSize = 8;
  if (size === 1) {
    size = readU64(bytes, offset + 8);
    headerSize = 16;
  }
  if (size < headerSize || offset + size > stsd.end) return null;

  const type = readType(bytes, offset + 4);
  // VisualSampleEntry: 6 reserved + 2 dataRefIndex + 16 pre-defined/reserved,
  // then width(2) height(2) ... so dimensions start 24 bytes into the body.
  const body = offset + headerSize;
  if (body + 32 > offset + size) return null;

  const width = readU16(bytes, body + 24);
  const height = readU16(bytes, body + 26);

  // Codec private data follows the fixed 78-byte VisualSampleEntry header, as
  // child boxes (avcC / hvcC / vpcC / av1C).
  const childrenStart = body + 78;
  let codec = '';
  if (childrenStart < offset + size) {
    for (const child of readBoxes(bytes, childrenStart, offset + size)) {
      if (child.type === 'avcC') codec = 'avc1.' + readAvcProfile(bytes, child);
      else if (child.type === 'hvcC') codec = 'hvc1';
      else if (child.type === 'vpcC') codec = 'vp09.00.10.08';
      else if (child.type === 'av1C') codec = 'av01.0.04M.08';
    }
  }
  if (!codec) {
    if (type === 'avc1' || type === 'avc3') codec = 'avc1.42E01E';
    else if (type === 'hvc1' || type === 'hev1') codec = 'hvc1.1.6.L93.B0';
    else if (type === 'vp09') codec = 'vp09.00.10.08';
    else if (type === 'av01') codec = 'av01.0.04M.08';
    else codec = type;
  }

  return { codec, width, height, raw: bytes.subarray(offset, offset + size) };
}

function readAvcProfile(bytes: Uint8Array, avcC: BoxNode): string {
  if (avcC.bodyStart + 4 > avcC.end) return '42E01E';
  const profile = bytes[avcC.bodyStart + 1].toString(16).padStart(2, '0');
  const compat = bytes[avcC.bodyStart + 2].toString(16).padStart(2, '0');
  const level = bytes[avcC.bodyStart + 3].toString(16).padStart(2, '0');
  return `${profile}${compat}${level}`.toUpperCase();
}

function readTrackId(bytes: Uint8Array, tkhd: BoxNode): number {
  const base = tkhd.bodyStart;
  const version = bytes[base];
  // version 0: 4+4+4+4(reserved) then id; version 1: 4+8+8+4 then id
  const idOffset = version === 1 ? base + 4 + 8 + 8 + 4 : base + 4 + 4 + 4 + 4;
  return idOffset + 4 <= tkhd.end ? readU32(bytes, idOffset) : 1;
}

function readTimescale(bytes: Uint8Array, mdhd: BoxNode): number {
  const base = mdhd.bodyStart;
  const version = bytes[base];
  const offset = version === 1 ? base + 4 + 8 + 8 : base + 4 + 4;
  return offset + 4 <= mdhd.end ? readU32(bytes, offset) : 90000;
}

function readMediaDuration(bytes: Uint8Array, mdhd: BoxNode): number {
  const base = mdhd.bodyStart;
  const version = bytes[base];
  if (version === 1) {
    const offset = base + 4 + 8;
    return offset + 8 <= mdhd.end ? readU64(bytes, offset) : 0;
  }
  const offset = base + 4 + 4;
  return offset + 4 <= mdhd.end ? readU32(bytes, offset) : 0;
}

/**
 * Walks the chunk offsets and the sample-to-chunk table to produce every sample's
 * absolute file offset.
 *
 * A sample's offset is not derivable from its index alone: the sample-to-chunk
 * table says how many samples each chunk holds, and only the running sum of the
 * chunk's preceding samples gives the byte position. Getting this wrong yields
 * plausible-looking garbage that only fails at decode time.
 */
function readSampleTable(bytes: Uint8Array, stbl: BoxNode, mdhd: BoxNode | null): SampleEntry[] {
  const stts = stbl.children.find((box) => box.type === 'stts');
  const stsc = stbl.children.find((box) => box.type === 'stsc');
  const stsz = stbl.children.find((box) => box.type === 'stsz');
  const stco = stbl.children.find((box) => box.type === 'stco');
  const stss = stbl.children.find((box) => box.type === 'stss');
  const ctts = stbl.children.find((box) => box.type === 'ctts');
  if (!stts || !stsc || !stsz || !stco || !mdhd) return [];

  const timescale = readTimescale(bytes, mdhd);

  const sizes = readStsz(bytes, stsz);
  if (sizes.length === 0) return [];

  const chunkOffsets = readChunkOffsets(bytes, stco);
  const sampleToChunk = readStsc(bytes, stsc);
  const syncSamples = stss ? new Set(readSyncSamples(bytes, stss)) : null;
  const compositionOffsets = ctts ? readCtts(bytes, ctts) : null;
  const deltas = readStts(bytes, stts);

  if (chunkOffsets.length === 0 || sampleToChunk.length === 0) return [];

  const samples: SampleEntry[] = [];
  let sampleIndex = 0;
  let dts = 0;
  let deltaCursor = 0;
  let deltaRemaining = 0;
  let currentDelta = 0;

  for (let chunkIndex = 1; chunkIndex <= chunkOffsets.length && sampleIndex < sizes.length; chunkIndex++) {
    const samplesInChunk = samplesPerChunkFor(chunkIndex, sampleToChunk);
    let cursor = chunkOffsets[chunkIndex - 1];

    for (let i = 0; i < samplesInChunk && sampleIndex < sizes.length; i++) {
      if (deltaRemaining === 0) {
        if (deltaCursor >= deltas.length) break;
        currentDelta = deltas[deltaCursor].delta;
        deltaRemaining = deltas[deltaCursor].count;
        deltaCursor++;
      }
      deltaRemaining--;

      const size = sizes[sampleIndex];
      samples.push({
        dts,
        cts: dts + (compositionOffsets?.[sampleIndex] ?? 0),
        duration: timescale > 0 ? (currentDelta / timescale) * 1_000_000 : 0,
        size,
        offset: cursor,
        isSync: syncSamples ? syncSamples.has(sampleIndex + 1) : sampleIndex % 15 === 0,
        description: null,
      });

      cursor += size;
      sampleIndex++;
      dts += currentDelta;
    }
  }

  return samples;
}

/** The last stsc entry whose firstChunk is at or below this chunk index wins. */
function samplesPerChunkFor(
  chunkIndex: number,
  sampleToChunk: Array<{ firstChunk: number; samplesPerChunk: number }>
): number {
  let current = sampleToChunk[0].samplesPerChunk;
  for (const entry of sampleToChunk) {
    if (entry.firstChunk > chunkIndex) break;
    current = entry.samplesPerChunk;
  }
  return current;
}

function readStts(bytes: Uint8Array, box: BoxNode): Array<{ count: number; delta: number }> {
  const out: Array<{ count: number; delta: number }> = [];
  let offset = box.bodyStart + 4;
  if (readU32(bytes, box.bodyStart) === 0) return out;
  const count = readU32(bytes, box.bodyStart + 4);
  if (count > 1_000_000) return out;
  offset = box.bodyStart + 8;
  for (let i = 0; i < count && offset + 8 <= box.end; i++) {
    out.push({ count: readU32(bytes, offset), delta: readU32(bytes, offset + 4) });
    offset += 8;
  }
  return out;
}

function readStsc(bytes: Uint8Array, box: BoxNode): Array<{ firstChunk: number; samplesPerChunk: number }> {
  const out: Array<{ firstChunk: number; samplesPerChunk: number }> = [];
  const count = readU32(bytes, box.bodyStart + 4);
  let offset = box.bodyStart + 8;
  for (let i = 0; i < count && offset + 12 <= box.end; i++) {
    out.push({ firstChunk: readU32(bytes, offset), samplesPerChunk: readU32(bytes, offset + 4) });
    offset += 12;
  }
  return out;
}

function readStsz(bytes: Uint8Array, box: BoxNode): number[] {
  const uniformSize = readU32(bytes, box.bodyStart + 4);
  const count = readU32(bytes, box.bodyStart + 8);
  if (count > 5_000_000) return [];

  if (uniformSize > 0) return new Array<number>(count).fill(uniformSize);

  const out: number[] = [];
  let offset = box.bodyStart + 12;
  for (let i = 0; i < count && offset + 4 <= box.end; i++) {
    out.push(readU32(bytes, offset));
    offset += 4;
  }
  return out;
}

function readChunkOffsets(bytes: Uint8Array, box: BoxNode): number[] {
  const count = readU32(bytes, box.bodyStart + 4);
  const out: number[] = [];
  let offset = box.bodyStart + 8;
  for (let i = 0; i < count && offset + 4 <= box.end; i++) {
    out.push(readU32(bytes, offset));
    offset += 4;
  }
  return out;
}

function readSyncSamples(bytes: Uint8Array, box: BoxNode): number[] {
  const count = readU32(bytes, box.bodyStart + 4);
  const out: number[] = [];
  let offset = box.bodyStart + 8;
  for (let i = 0; i < count && offset + 4 <= box.end; i++) {
    out.push(readU32(bytes, offset));
    offset += 4;
  }
  return out;
}

/**
 * Composition offsets, expanded from run-length form to one value per sample.
 *
 * `ctts` stores (sample_count, offset) runs; the decoder needs a per-sample
 * array, and filling only the first sample of each run — the obvious shortcut —
 * silently desynchronises every frame after it.
 */
function readCtts(bytes: Uint8Array, box: BoxNode): number[] {
  const count = readU32(bytes, box.bodyStart + 4);
  if (count > 5_000_000) return [];

  const out: number[] = [];
  let offset = box.bodyStart + 8;
  for (let i = 0; i < count && offset + 8 <= box.end; i++) {
    const sampleCount = readU32(bytes, offset);
    const value = readU32(bytes, offset + 4);
    for (let s = 0; s < sampleCount; s++) out.push(value);
    offset += 8;
  }
  return out;
}

// ---------------------------------------------------------------------------
// MP4 writing
// ---------------------------------------------------------------------------

interface EncodedSample {
  data: Uint8Array;
  durationUs: number;
  ctsUs: number;
  isSync: boolean;
  keyFrame: EncodedVideoChunkMetadata | null;
}

/**
 * Writes a progressive MP4 with a single AVC video track.
 *
 * Layout is `ftyp` + `moov` + `mdat`. The chunk offset inside `stco` must point
 * at the first sample byte, which sits after `mdat`'s 8-byte header, and
 * `moov`'s own length depends on that offset's digit count. The fixed point is
 * resolved by rebuilding `moov` until its length stops changing, which converges
 * in one or two passes because the offset only ever grows its decimal width.
 */
function writeMp4(
  samples: EncodedSample[],
  timescale: number,
  width: number,
  height: number,
  avcC: Uint8Array
): Uint8Array {
  const movieTimescale = 1000;
  const durations = samples.map((s) =>
    Math.max(1, Math.round((s.durationUs / 1_000_000) * timescale))
  );
  const totalMediaDuration = durations.reduce((sum, d) => sum + d, 0);
  const totalMovieDuration = Math.max(
    1,
    Math.round((totalMediaDuration / timescale) * movieTimescale)
  );

  const syncIndices: number[] = [];
  samples.forEach((sample, index) => {
    if (sample.isSync) syncIndices.push(index + 1);
  });
  if (syncIndices.length === 0) syncIndices.push(1);

  const base: Omit<MoovParams, 'mdatOffset'> = {
    samples,
    durations,
    syncIndices,
    width,
    height,
    avcC,
    timescale,
    totalMediaDuration,
    totalMovieDuration,
    movieTimescale,
  };

  const ftyp = ftypBox();
  let mdatOffset = 0;
  let moov = buildMoov({ ...base, mdatOffset });

  for (let pass = 0; pass < 4; pass++) {
    const candidate = ftyp.length + moov.length;
    if (candidate === mdatOffset) break;
    mdatOffset = candidate;
    moov = buildMoov({ ...base, mdatOffset });
  }

  const mdatPayloadSize = samples.reduce((sum, sample) => sum + sample.data.length, 0);
  const parts: Uint8Array[] = [
    ftyp,
    moov,
    concatBytes([u32(mdatPayloadSize + 8), ascii('mdat')]),
    ...samples.map((sample) => sample.data),
  ];
  return concatBytes(parts);
}

interface MoovParams {
  mdatOffset: number;
  samples: EncodedSample[];
  durations: number[];
  syncIndices: number[];
  width: number;
  height: number;
  avcC: Uint8Array;
  timescale: number;
  totalMediaDuration: number;
  totalMovieDuration: number;
  movieTimescale: number;
}

function buildMoov(params: MoovParams): Uint8Array {
  const { mdatOffset, samples, durations, syncIndices, width, height, avcC, timescale,
    totalMediaDuration, totalMovieDuration, movieTimescale } = params;

  const mvhd = buildMvhd(movieTimescale, totalMovieDuration);
  const tkhd = buildTkhd(1, width, height, totalMovieDuration);
  const mdhd = buildMdhd(timescale, totalMediaDuration);
  const hdlr = buildHdlr();
  const vmhd = buildBox('vmhd', new Uint8Array(12));
  const dref = buildBox('dref', concatBytes([u32(0), u32(1), buildBox('url ', new Uint8Array(0))]));
  const dinf = buildBox('dinf', dref);

  const avc1 = buildAvc1(width, height, avcC);
  const stsd = buildBox('stsd', concatBytes([u32(0), u32(1), avc1]));

  const runLengthEncode = (values: number[]): { counts: number[]; values: number[] } => {
    const counts: number[] = [];
    const uniques: number[] = [];
    for (const value of values) {
      if (uniques.length > 0 && uniques[uniques.length - 1] === value) {
        counts[counts.length - 1]++;
      } else {
        counts.push(1);
        uniques.push(value);
      }
    }
    return { counts, values: uniques };
  };

  const sttsRuns = runLengthEncode(durations);
  const sttsEntries: Uint8Array[] = [u32(0), u32(sttsRuns.counts.length)];
  for (let i = 0; i < sttsRuns.counts.length; i++) {
    sttsEntries.push(u32(sttsRuns.counts[i]), u32(sttsRuns.values[i]));
  }
  const stts = buildBox('stts', concatBytes(sttsEntries));

  const stss = buildBox('stss', concatBytes([u32(0), u32(syncIndices.length), ...syncIndices.map(u32)]));

  const stsc = buildBox('stsc', concatBytes([u32(0), u32(1), u32(1), u32(1), u32(1)]));

  const stszEntries: Uint8Array[] = [u32(0), u32(0), u32(samples.length)];
  for (const sample of samples) stszEntries.push(u32(sample.data.length));
  const stsz = buildBox('stsz', concatBytes(stszEntries));

  const stco = buildBox('stco', concatBytes([u32(0), u32(1), u32(mdatOffset + 8)]));

  const stbl = buildBox('stbl', concatBytes([stsd, stts, stss, stsc, stsz, stco]));
  const minf = buildBox('minf', concatBytes([vmhd, dinf, stbl]));
  const mdia = buildBox('mdia', concatBytes([mdhd, hdlr, minf]));
  const trak = buildBox('trak', concatBytes([tkhd, mdia]));
  return buildBox('moov', concatBytes([mvhd, trak]));
}

function ftypBox(): Uint8Array {
  const brands = concatBytes([ascii('isom'), u32(512), ascii('isom'), ascii('iso2'), ascii('avc1'), ascii('mp41')]);
  return buildBox('ftyp', brands);
}

function buildMvhd(timescale: number, duration: number): Uint8Array {
  // version 0 payload is exactly 100 bytes.
  const body = new Uint8Array(100);
  const view = new DataView(body.buffer);
  view.setUint32(0, 0, false); // version + flags
  view.setUint32(4, 0, false); // creation_time
  view.setUint32(8, 0, false); // modification_time
  view.setUint32(12, timescale, false);
  view.setUint32(16, duration, false);
  view.setUint32(20, 0x00010000, false); // rate 1.0
  view.setUint16(24, 0x0100, false); // volume 1.0
  view.setUint16(26, 0, false); // reserved
  view.setUint32(28, 0, false); // reserved
  view.setUint32(32, 0, false); // reserved
  // unity matrix, 9 x 32-bit
  const matrix = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
  matrix.forEach((value, index) => view.setUint32(36 + index * 4, value, false));
  // pre_defined[6]
  view.setUint32(96, 0, false); // next_track_ID
  return buildBox('mvhd', body);
}

function buildTkhd(trackId: number, width: number, height: number, duration: number): Uint8Array {
  const body = new Uint8Array(84);
  const view = new DataView(body.buffer);
  view.setUint32(0, 0x00000007, false); // version 0, flags: enabled + in movie
  view.setUint32(4, 0, false);
  view.setUint32(8, 0, false);
  view.setUint32(12, trackId, false);
  view.setUint32(16, 0, false);
  view.setUint32(20, duration, false);
  view.setUint32(24, 0, false);
  view.setUint32(28, 0, false);
  view.setUint16(32, 0, false); // layer
  view.setUint16(34, 0, false); // alternate group
  view.setUint16(36, 0, false); // volume (0 for video)
  view.setUint16(38, 0, false);
  const matrix = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000];
  matrix.forEach((value, index) => view.setUint32(40 + index * 4, value, false));
  view.setUint32(76, width << 16, false);
  view.setUint32(80, height << 16, false);
  return buildBox('tkhd', body);
}

function buildMdhd(timescale: number, duration: number): Uint8Array {
  const body = new Uint8Array(24);
  const view = new DataView(body.buffer);
  view.setUint32(0, 0, false);
  view.setUint32(4, 0, false);
  view.setUint32(8, 0, false);
  view.setUint32(12, timescale, false);
  view.setUint32(16, duration, false);
  view.setUint16(20, 0x55c4, false); // language 'und'
  view.setUint16(22, 0, false);
  return buildBox('mdhd', body);
}

function buildHdlr(): Uint8Array {
  const body = new Uint8Array(32);
  const view = new DataView(body.buffer);
  view.setUint32(0, 0, false);
  view.setUint32(4, 0, false);
  body[8] = 0x76; // v
  body[9] = 0x69; // i
  body[10] = 0x64; // d
  body[11] = 0x65; // e
  body[12] = 0x6f; // o
  const name = ascii('VideoHandler\0');
  body.set(name, 24);
  return buildBox('hdlr', body);
}

/**
 * VisualSampleEntry: 78 bytes of fixed fields, then the codec private data as
 * a child box (avcC / hvcC / vpcC / av1C). Getting the 78 wrong shifts every
 * child box and the decoder then refuses the stream.
 */
function buildAvc1(width: number, height: number, avcC: Uint8Array): Uint8Array {
  const body = new Uint8Array(78);
  const view = new DataView(body.buffer);
  view.setUint16(6, 1, false); // data_reference_index
  view.setUint16(24, width, false);
  view.setUint16(26, height, false);
  view.setUint32(28, 0x00480000, false); // horizresolution 72dpi
  view.setUint32(32, 0x00480000, false); // vertresolution 72dpi
  view.setUint32(36, 0, false); // reserved
  view.setUint16(40, 1, false); // frame_count
  body[42] = 0x18; // depth
  view.setUint16(43, 0xffff, false); // pre_defined

  const children = avcC.length > 0 ? [buildBox('avcC', avcC)] : [];
  return buildBox('avc1', concatBytes([body, ...children]));
}

function buildBox(type: string, body: Uint8Array): Uint8Array {
  return concatBytes([u32(body.length + 8), ascii(type), body]);
}

// ---------------------------------------------------------------------------
// Transcode
// ---------------------------------------------------------------------------

/**
 * Decodes, mutates and re-encodes an MP4 so that its perceptual fingerprint
 * moves by a measurable amount.
 *
 * Returns `ok: false` with a reason instead of a best-effort file. The caller
 * must treat that as "no mutation happened" and keep the metadata-only result —
 * a partially written MP4 that still claims to be camouflaged is worse than an
 * honest no-op.
 */
export async function transcodeMp4ForPerceptualChange(
  bytes: Uint8Array,
  options: TranscodeOptions
): Promise<TranscodeResult> {
  const notes: string[] = [];

  if (typeof VideoDecoder === 'undefined' || typeof VideoEncoder === 'undefined') {
    return { ok: false, reason: 'WebCodecs indisponível', notes };
  }

  const topBoxes = readBoxes(bytes, 0, bytes.length);
  const moov = topBoxes.find((box) => box.type === 'moov');
  if (!moov) return { ok: false, reason: 'moov não encontrado', notes };

  const track = parseVideoTrack(bytes, moov.children);
  if (!track) return { ok: false, reason: 'nenhuma faixa de vídeo suportada', notes };
  if (track.width === 0 || track.height === 0) {
    return { ok: false, reason: 'dimensões de vídeo inválidas', notes };
  }

  const avcC = findAvcC(bytes, moov);
  if (!avcC) {
    return {
      ok: false,
      reason: `descrição de codec ausente (${track.codec}) — o muxer deste módulo só reescreve AVC`,
      notes,
    };
  }

  const description = findCodecDescription(bytes, moov.children);
  if (!description) return { ok: false, reason: 'codec private data não encontrado', notes };

  const support = await VideoDecoder.isConfigSupported({ codec: track.codec, codedWidth: track.width, codedHeight: track.height });
  if (!support.supported) {
    return { ok: false, reason: `decodificador não suporta ${track.codec}`, notes };
  }

  const scale = Math.min(1, options.maxDimension / Math.max(track.width, track.height));
  const outWidth = evenNumber(Math.max(2, Math.round(track.width * scale)));
  const outHeight = evenNumber(Math.max(2, Math.round(track.height * scale)));
  const bitrate = options.bitrate ?? Math.round(outWidth * outHeight * 4 * 0.12);

  const baseline = await computeFrameDHash(bytes, track, options.hashSamples ?? 3);

  const decoded = await decodeAllFrames(bytes, track, track.codec, outWidth, outHeight);
  if (!decoded.ok) return { ok: false, reason: decoded.reason, notes };
  if (decoded.frames.length === 0) return { ok: false, reason: 'nenhum frame decodificado', notes };

  const mutated = await encodeMutatedFrames(
    decoded.frames,
    outWidth,
    outHeight,
    bitrate,
    options.mutation
  );
  if (!mutated.ok) return { ok: false, reason: mutated.reason, notes };

  const mp4 = writeMp4(mutated.samples, 90000, outWidth, outHeight, avcC);
  const validation = await validateTranscode(mp4, mutated.samples.length, outWidth, outHeight);
  if (!validation.ok) {
    return { ok: false, reason: `saída inválida: ${validation.reason}`, notes };
  }

  const after = await computeFrameDHash(mp4, null, options.hashSamples ?? 3);
  const distance = baseline !== null && after !== null ? hammingDistance(baseline, after) : 0;

  notes.push(
    `Re-codificado para ${outWidth}x${outHeight} @ ${(bitrate / 1000).toFixed(0)}kbps, ${mutated.samples.length} quadros.`
  );
  if (distance < MIN_EFFECTIVE_DISTANCE) {
    notes.push(
      `Distância perceptual de ${distance} bits ficou abaixo do piso de ${MIN_EFFECTIVE_DISTANCE}; o tamanho do criativo é a causa mais provável.`
    );
  }

  return {
    ok: true,
    bytes: mp4,
    distance,
    hashBefore: baseline?.hex ?? null,
    hashAfter: after?.hex ?? null,
    notes,
  };
}

type DecodedFrame = {
  frame: VideoFrame;
  timestampUs: number;
  durationUs: number;
  isSync: boolean;
};

async function decodeAllFrames(
  bytes: Uint8Array,
  track: ParsedTrack,
  codec: string,
  outWidth: number,
  outHeight: number
): Promise<{ ok: true; frames: DecodedFrame[] } | { ok: false; reason: string }> {
  const frames: DecodedFrame[] = [];
  const description = findCodecDescription(
    bytes,
    readBoxes(bytes, 0, bytes.length).find((box) => box.type === 'moov')?.children ?? []
  );

  let failure: string | null = null;

  const decoder = new VideoDecoder({
    output: (frame) => {
      const timestampUs = frame.timestamp ?? 0;
      const durationUs = frame.duration && frame.duration > 0 ? frame.duration : 33333;
      // VideoFrame.type is not in the lib.dom typing; a frame arriving from the
      // decoder is a key frame when its type says so, and IDR frames always
      // report "key". Treat a missing type as a delta frame.
      const isSync = (frame as VideoFrame & { type?: string }).type === 'key';
      frames.push({ frame, timestampUs, durationUs, isSync });
      void outWidth;
      void outHeight;
    },
    error: (error) => {
      failure = error.message;
    },
  });

  try {
    decoder.configure({
      codec,
      codedWidth: track.width,
      codedHeight: track.height,
      ...(description ? { description } : {}),
      optimizeForLatency: false,
    });
  } catch (error) {
    return { ok: false, reason: `configure falhou: ${error instanceof Error ? error.message : 'erro'}` };
  }

  for (const sample of track.samples) {
    if (failure) break;
    const data = bytes.subarray(sample.offset, sample.offset + sample.size);
    try {
      decoder.decode(
        new EncodedVideoChunk({
          type: sample.isSync ? 'key' : 'delta',
          timestamp: Math.round((sample.dts / track.timescale) * 1_000_000),
          duration: Math.round((sample.duration / track.timescale) * 1_000_000),
          data,
        })
      );
    } catch (error) {
      failure = error instanceof Error ? error.message : 'decode threw';
      break;
    }
  }

  try {
    await decoder.flush();
  } catch (error) {
    failure = failure ?? (error instanceof Error ? error.message : 'flush falhou');
  }
  decoder.close();

  if (failure && frames.length === 0) return { ok: false, reason: `decodificação falhou: ${failure}` };
  frames.sort((a, b) => a.timestampUs - b.timestampUs);
  return { ok: true, frames };
}

async function encodeMutatedFrames(
  frames: DecodedFrame[],
  width: number,
  height: number,
  bitrate: number,
  mutation: MutationProfile
): Promise<{ ok: true; samples: EncodedSample[] } | { ok: false; reason: string }> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: false, reason: 'canvas 2D indisponível' };

  const samples: EncodedSample[] = [];
  let failure: string | null = null;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      const buffer = new ArrayBuffer(chunk.byteLength);
      chunk.copyTo(new Uint8Array(buffer));
      const decoderConfig = metadata?.decoderConfig;
      samples.push({
        data: new Uint8Array(buffer),
        durationUs: chunk.duration ?? 33333,
        ctsUs: chunk.timestamp,
        isSync: chunk.type === 'key',
        keyFrame: decoderConfig ? null : null,
      });
    },
    error: (error) => {
      failure = error.message;
    },
  });

  try {
    encoder.configure({
      codec: 'avc1.42001f',
      width,
      height,
      bitrate,
      framerate: 30,
      avc: { format: 'avc' },
      latencyMode: 'quality',
    });
  } catch (error) {
    return { ok: false, reason: `encoder configure falhou: ${error instanceof Error ? error.message : 'erro'}` };
  }

  const seed = (Math.random() * 0xffff) | 0;

  for (const decoded of frames) {
    if (failure) break;
    try {
      // Same geometric mutation the image path uses, and for the same measured
      // reason: magnifying before cropping is what shifts the resampling phase of
      // every gradient, which is the only thing a perceptual hash is sensitive to.
      const zoom = 1 + mutation.zoom;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        decoded.frame,
        (width - width * zoom) / 2,
        (height - height * zoom) / 2,
        width * zoom,
        height * zoom
      );
      ctx.restore();

      const image = ctx.getImageData(0, 0, width, height);
      const { data } = image;
      for (let i = 0; i < data.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
          const value = data[i + channel] + mutation.brightness + (((seed + i * 17 + channel * 5) & 3) === 0 ? 1 : 0);
          data[i + channel] = value < 0 ? 0 : value > 255 ? 255 : value;
        }
      }
      ctx.putImageData(image, 0, 0);

      const bitmap = await createImageBitmap(canvas);
      const outputFrame = new VideoFrame(bitmap, {
        timestamp: decoded.timestampUs,
        duration: decoded.durationUs,
      });
      encoder.encode(outputFrame, { keyFrame: decoded.isSync });
      outputFrame.close();
      bitmap.close();

      // Backpressure: a 4K source can queue hundreds of megabytes otherwise.
      if (encoder.encodeQueueSize > 8) {
        await new Promise<void>((resolve) => {
          const check = () => (encoder.encodeQueueSize <= 4 ? resolve() : setTimeout(check, 8));
          check();
        });
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : 'encode threw';
      break;
    }
    decoded.frame.close();
  }

  try {
    await encoder.flush();
  } catch (error) {
    failure = failure ?? (error instanceof Error ? error.message : 'flush falhou');
  }
  encoder.close();

  if (failure) return { ok: false, reason: `codificação falhou: ${failure}` };
  if (samples.length === 0) return { ok: false, reason: 'encoder não produziu quadros' };
  return { ok: true, samples };
}

/**
 * Re-parses the freshly written file and checks the invariants that make it
 * playable: a `moov` that parses, a sample count that matches what was encoded,
 * and dimensions that were not silently dropped.
 */
async function validateTranscode(
  bytes: Uint8Array,
  expectedSamples: number,
  width: number,
  height: number
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const boxes = readBoxes(bytes, 0, bytes.length);
  const moov = boxes.find((box) => box.type === 'moov');
  if (!moov) return { ok: false, reason: 'moov ausente na saída' };
  const mdat = boxes.find((box) => box.type === 'mdat');
  if (!mdat) return { ok: false, reason: 'mdat ausente na saída' };

  const stbl = findBox(moov.children, ['trak', 'mdia', 'minf', 'stbl']);
  if (!stbl) return { ok: false, reason: 'stbl ausente na saída' };
  const stsz = stbl.children.find((box) => box.type === 'stsz');
  if (!stsz) return { ok: false, reason: 'stsz ausente na saída' };
  const count = readU32(bytes, stsz.bodyStart + 8);
  if (count !== expectedSamples) {
    return { ok: false, reason: `stsz declara ${count} amostras, encoder gerou ${expectedSamples}` };
  }

  const stsd = stbl.children.find((box) => box.type === 'stsd');
  if (!stsd) return { ok: false, reason: 'stsd ausente na saída' };
  const entry = readFirstSampleEntry(bytes, stsd);
  if (!entry) return { ok: false, reason: 'sample entry ilegível' };
  if (entry.width !== width || entry.height !== height) {
    return { ok: false, reason: `dimensões ${entry.width}x${entry.height} divergem de ${width}x${height}` };
  }

  return { ok: true };
}

async function computeFrameDHash(
  bytes: Uint8Array,
  track: ParsedTrack | null,
  samples: number
): Promise<DHash | null> {
  const boxes = readBoxes(bytes, 0, bytes.length);
  const moov = boxes.find((box) => box.type === 'moov');
  if (!moov) return null;
  const resolved = track ?? parseVideoTrack(bytes, moov.children);
  if (!resolved) return null;

  const decoded = await decodeAllFrames(bytes, resolved, resolved.codec, 0, 0);
  if (!decoded.ok || decoded.frames.length === 0) return null;

  const canvas = document.createElement('canvas');
  const picks = pickSampleIndices(decoded.frames.length, samples);
  const hashes: DHash[] = [];

  for (const index of picks) {
    const frame = decoded.frames[index];
    canvas.width = frame.frame.displayWidth || frame.frame.codedWidth;
    canvas.height = frame.frame.displayHeight || frame.frame.codedHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) break;
    ctx.drawImage(frame.frame, 0, 0, canvas.width, canvas.height);
    hashes.push(
      dHashFromRgba(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
    );
  }

  for (const frame of decoded.frames) frame.frame.close();
  return hashes.length > 0 ? combineHashes(hashes) : null;
}

/**
 * Folds several sampled frames into one fingerprint.
 *
 * The same set of sample indices is used before and after, so the two hashes are
 * comparable and the distance reflects the mutation rather than which frames
 * happened to be picked.
 */
function combineHashes(hashes: DHash[]): DHash {
  const length = hashes[0].words.length;
  const words = new Uint32Array(length);
  for (const hash of hashes) {
    for (let i = 0; i < length; i++) {
      words[i] = ((words[i] >>> 1) | (hash.words[i] >>> 31)) >>> 0;
    }
  }
  return { words, bits: hashes[0].bits, hex: wordsToHex(words) };
}

function wordsToHex(words: Uint32Array): string {
  let out = '';
  for (let i = 0; i < words.length; i++) {
    out += (words[i] >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

function pickSampleIndices(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  const step = length / count;
  return Array.from({ length: count }, (_, i) => Math.min(length - 1, Math.floor(i * step)));
}

function findAvcC(bytes: Uint8Array, moov: BoxNode): Uint8Array | null {
  const stbl = findBox(moov.children, ['trak', 'mdia', 'minf', 'stbl']);
  if (!stbl) return null;
  const stsd = stbl.children.find((box) => box.type === 'stsd');
  if (!stsd) return null;
  const entry = readFirstSampleEntry(bytes, stsd);
  if (!entry) return null;
  // Re-walk the entry to pull out the avcC payload.
  let offset = stsd.bodyStart + 8;
  let size = readU32(bytes, offset);
  let headerSize = 8;
  if (size === 1) {
    size = readU64(bytes, offset + 8);
    headerSize = 16;
  }
  const childrenStart = offset + headerSize + 78;
  for (const child of readBoxes(bytes, childrenStart, offset + size)) {
    if (child.type === 'avcC') return bytes.subarray(child.bodyStart, child.end);
  }
  return null;
}

function findCodecDescription(bytes: Uint8Array, moovChildren: BoxNode[]): Uint8Array | null {
  const stbl = findBox(moovChildren, ['trak', 'mdia', 'minf', 'stbl']);
  if (!stbl) return null;
  const stsd = stbl.children.find((box) => box.type === 'stsd');
  if (!stsd) return null;
  for (const child of readBoxes(bytes, stsd.bodyStart + 8, stsd.end)) {
    const inner = readBoxes(bytes, child.bodyStart + 78, child.end);
    for (const box of inner) {
      if (box.type === 'avcC' || box.type === 'hvcC' || box.type === 'vpcC' || box.type === 'av1C') {
        return bytes.subarray(box.bodyStart, box.end);
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Byte helpers
// ---------------------------------------------------------------------------

function readU32(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]
  ) >>> 0;
}

function readU64(bytes: Uint8Array, offset: number): number {
  return readU32(bytes, offset) * 0x100000000 + readU32(bytes, offset + 4);
}

function readU16(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, false);
  return out;
}

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

function evenNumber(value: number): number {
  return value % 2 === 0 ? value : value + 1;
}
