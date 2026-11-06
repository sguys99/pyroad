// 의존성 없는 팔레트 PNG 인코더·디코더 (P2-16). 종이 결 타일처럼 "한 가지 색 + 투명도 몇 단계"인 그림만 다룬다.
// - 인코딩: 색 인덱스 + PLTE(색) + tRNS(인덱스별 투명도), 단계 수에 맞춰 비트 깊이를 1·2·4·8로 줄이고 필터 없이 deflate 9
// - 디코딩: 이 인코더가 만든 파일만 읽는다(필터 0). `--check`가 압축 바이트가 아니라 픽셀을 비교하게 하려고 씀
//   (Node·zlib 버전이 달라 deflate 결과가 달라져도 그림이 같으면 같은 파일로 본다)

import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** 팔레트 크기에 맞는 가장 작은 비트 깊이 */
export function bitDepthFor(colors) {
  if (colors <= 2) return 1;
  if (colors <= 4) return 2;
  if (colors <= 16) return 4;
  if (colors <= 256) return 8;
  throw new Error(`팔레트는 256색까지예요 (${colors})`);
}

/**
 * @param {{ width: number, height: number, indices: Uint8Array, palette: number[][], alpha: number[] }} img
 *   palette: [[r,g,b], …], alpha: 인덱스별 투명도 0~255 (palette와 같은 길이)
 * @returns {Buffer}
 */
export function encodePalettePng({ width, height, indices, palette, alpha }) {
  if (indices.length !== width * height) {
    throw new Error('indices 길이가 width×height와 달라요');
  }
  if (alpha.length !== palette.length) {
    throw new Error('alpha와 palette 길이가 달라요');
  }
  const depth = bitDepthFor(palette.length);
  const perByte = 8 / depth;
  const rowBytes = Math.ceil(width / perByte);
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const off = y * (rowBytes + 1); // 첫 바이트 = 필터 0(없음)
    for (let x = 0; x < width; x++) {
      const v = indices[y * width + x];
      if (v >= palette.length) throw new Error(`인덱스 ${v}가 팔레트 밖이에요`);
      const shift = 8 - depth * ((x % perByte) + 1);
      raw[off + 1 + Math.floor(x / perByte)] |= v << shift;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = 3; // 색 형식: 팔레트
  // 10~12: 압축·필터·인터레이스 모두 0
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.from(palette.flat())),
    chunk('tRNS', Buffer.from(alpha)),
    chunk('IDAT', deflateSync(raw, { level: 9, memLevel: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * encodePalettePng가 만든 파일을 읽는다. 다른 도구가 만든 PNG(필터·인터레이스 사용)는 오류.
 * @param {Buffer} buf
 */
export function decodePalettePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('PNG가 아니에요');
  let pos = 8;
  let ihdr;
  let palette = [];
  let alpha = [];
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    const crc = buf.readUInt32BE(pos + 8 + len);
    if (crc32(buf.subarray(pos + 4, pos + 8 + len)) !== crc) {
      throw new Error(`${type} 청크 CRC가 맞지 않아요`);
    }
    if (type === 'IHDR') ihdr = data;
    else if (type === 'PLTE') {
      palette = [];
      for (let i = 0; i < data.length; i += 3) {
        palette.push([data[i], data[i + 1], data[i + 2]]);
      }
    } else if (type === 'tRNS') alpha = [...data];
    else if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
    if (type === 'IEND') break;
  }
  if (!ihdr) throw new Error('IHDR가 없어요');
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  if (ihdr[9] !== 3 || ihdr[12] !== 0) {
    throw new Error('팔레트·비인터레이스 PNG만 읽어요');
  }
  const raw = inflateSync(Buffer.concat(idat));
  const perByte = 8 / depth;
  const rowBytes = Math.ceil(width / perByte);
  const mask = (1 << depth) - 1;
  const indices = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const off = y * (rowBytes + 1);
    if (raw[off] !== 0) throw new Error('필터를 쓴 PNG는 읽지 않아요');
    for (let x = 0; x < width; x++) {
      const shift = 8 - depth * ((x % perByte) + 1);
      indices[y * width + x] =
        (raw[off + 1 + Math.floor(x / perByte)] >> shift) & mask;
    }
  }
  while (alpha.length < palette.length) alpha.push(255);
  return { width, height, indices, palette, alpha };
}
