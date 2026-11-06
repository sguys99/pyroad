// WOFF2 파일에서 cmap(글자 → 글리프)과 name(글꼴 이름) 테이블만 읽는다 (P2-10). 의존성 없음(Node zlib의 Brotli).
// 폰트 검사(check.mjs)가 Python·fontTools 없이 CI에서 "서브셋에 이 글자가 있나", "이름을 바꿨나"를 확인하는 데 쓴다.
//
// WOFF2 구조 (W3C WOFF2 §4~5): 48바이트 헤더 → 테이블 디렉터리(가변 길이) → Brotli로 압축한 테이블 데이터 한 덩어리.
// 압축을 풀면 테이블이 디렉터리 순서대로 패딩 없이 이어져 있다. glyf·loca·hmtx만 변환(transform)될 수 있고
// cmap·name은 항상 원래 모양이라 그대로 해석할 수 있다.

import { brotliDecompressSync } from 'node:zlib';

const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
]; // prettier-ignore

function readBase128(buf, pos) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos.at++];
    if (i === 0 && b === 0x80) throw new Error('WOFF2: UIntBase128 앞자리 0');
    value = value * 128 + (b & 0x7f);
    if (!(b & 0x80)) return value;
  }
  throw new Error('WOFF2: UIntBase128이 5바이트를 넘음');
}

/** @returns {Map<string, Buffer>} 변환되지 않은 테이블의 원래 바이트 (태그 → 데이터) */
export function readWoff2Tables(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') {
    throw new Error('WOFF2 파일이 아님');
  }
  if (buf.toString('latin1', 4, 8) === 'ttcf') {
    throw new Error('WOFF2 컬렉션은 지원하지 않음');
  }
  const numTables = buf.readUInt16BE(12);
  const totalCompressedSize = buf.readUInt32BE(20);
  const pos = { at: 48 };
  const entries = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos.at++];
    const tagIndex = flags & 0x3f;
    let tag;
    if (tagIndex === 63) {
      tag = buf.toString('latin1', pos.at, pos.at + 4);
      pos.at += 4;
    } else {
      tag = KNOWN_TAGS[tagIndex];
    }
    const version = flags >> 6;
    const origLength = readBase128(buf, pos);
    const transformed =
      tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const length = transformed ? readBase128(buf, pos) : origLength;
    entries.push({ tag, transformed, length });
  }
  const data = brotliDecompressSync(
    buf.subarray(pos.at, pos.at + totalCompressedSize),
  );
  const tables = new Map();
  let offset = 0;
  for (const e of entries) {
    if (!e.transformed)
      tables.set(e.tag, data.subarray(offset, offset + e.length));
    offset += e.length;
  }
  if (offset !== data.length) {
    throw new Error(
      `WOFF2: 테이블 길이 합(${offset}) ≠ 풀린 크기(${data.length})`,
    );
  }
  return tables;
}

/** cmap에서 글리프가 있는(글리프 0이 아닌) 코드포인트 집합. 형식 4·12(유니코드 하위 테이블)만 읽는다 */
export function readCmapCodepoints(cmap) {
  const n = cmap.readUInt16BE(2);
  const subtables = [];
  for (let i = 0; i < n; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const encoding = cmap.readUInt16BE(6 + i * 8);
    const offset = cmap.readUInt32BE(8 + i * 8);
    const unicode =
      platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (unicode) subtables.push({ format: cmap.readUInt16BE(offset), offset });
  }
  const pick =
    subtables.find((s) => s.format === 12) ??
    subtables.find((s) => s.format === 4);
  if (!pick) throw new Error('cmap: 형식 4·12 유니코드 하위 테이블이 없음');
  const cps = new Set();
  const o = pick.offset;
  if (pick.format === 12) {
    const groups = cmap.readUInt32BE(o + 12);
    for (let g = 0; g < groups; g++) {
      const start = cmap.readUInt32BE(o + 16 + g * 12);
      const end = cmap.readUInt32BE(o + 20 + g * 12);
      const startGlyph = cmap.readUInt32BE(o + 24 + g * 12);
      for (let c = start; c <= end; c++) {
        if (startGlyph + (c - start) !== 0) cps.add(c);
      }
    }
    return cps;
  }
  const segX2 = cmap.readUInt16BE(o + 6);
  const ends = o + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const rangeOffsets = deltas + segX2;
  for (let s = 0; s < segX2; s += 2) {
    const end = cmap.readUInt16BE(ends + s);
    const start = cmap.readUInt16BE(starts + s);
    const delta = cmap.readInt16BE(deltas + s);
    const ro = cmap.readUInt16BE(rangeOffsets + s);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph;
      if (ro === 0) glyph = (c + delta) & 0xffff;
      else {
        const at = rangeOffsets + s + ro + (c - start) * 2;
        glyph = cmap.readUInt16BE(at);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) cps.add(c);
    }
  }
  return cps;
}

/** name 테이블의 Windows 영어(3/1/0x409) 레코드 → { nameID: 문자열 } */
export function readNames(name) {
  const count = name.readUInt16BE(2);
  const storage = name.readUInt16BE(4);
  /** @type {Record<number, string>} */
  const out = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    const platform = name.readUInt16BE(r);
    const encoding = name.readUInt16BE(r + 2);
    const lang = name.readUInt16BE(r + 4);
    const id = name.readUInt16BE(r + 6);
    const length = name.readUInt16BE(r + 8);
    const offset = name.readUInt16BE(r + 10);
    if (platform !== 3 || encoding !== 1 || lang !== 0x409) continue;
    const raw = name.subarray(storage + offset, storage + offset + length);
    out[id] = Buffer.from(raw).swap16().toString('utf16le');
  }
  return out;
}

/** WOFF2 파일 하나의 코드포인트 집합과 이름 */
export function inspectWoff2(buf) {
  const tables = readWoff2Tables(buf);
  return {
    codepoints: readCmapCodepoints(tables.get('cmap')),
    names: readNames(tables.get('name')),
  };
}
