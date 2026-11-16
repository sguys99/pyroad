import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  checkCreationTexts,
  creationMetaSchema,
  fromBytea,
  hasExtraPersonalInfo,
  isThumbnailPng,
  parseCommandsGz,
  toBytea,
} from '../server';
import {
  CREATION_TRANSCRIPT_MAX_CHARS,
  clampTranscript,
  defaultCreationTitle,
} from '../limits';

const gz = (v: unknown) => new Uint8Array(gzipSync(JSON.stringify(v)));
const SQUARE = [
  [
    'n',
    1,
    {
      x: 0,
      y: 0,
      h: 0,
      d: 1,
      pc: 'black',
      fc: 'black',
      w: 1,
      sp: 3,
      v: 1,
      sh: 'classic',
      sz: 1,
    },
  ],
  ['t', '네모 집'],
  ['m', 1, 100, 0],
  ['r', 1, 90, 90],
  ['w', 1, '안녕', 'left', 'Arial', 8, 'normal'],
];

describe('parseCommandsGz (P11-06)', () => {
  it('아는 명령만 받고 글씨·제목을 모아 다시 압축한다', () => {
    const r = parseCommandsGz(gz(SQUARE));
    expect(r).toMatchObject({ ok: true, count: 5, texts: ['네모 집', '안녕'] });
    if (r.ok) expect([r.gz[0], r.gz[1]]).toEqual([0x1f, 0x8b]);
  });

  it('gzip 이 아님 · 빈 배열 · 모르는 명령 · 5만 개 초과 · 풀면 너무 큼(zip 폭탄)은 거부', () => {
    expect(parseCommandsGz(new TextEncoder().encode('[["m",1,0,0]]')).ok).toBe(
      false,
    );
    expect(parseCommandsGz(gz([])).ok).toBe(false);
    expect(parseCommandsGz(gz([['eval', 'x']])).ok).toBe(false);
    expect(parseCommandsGz(gz([{ k: 'm' }])).ok).toBe(false);
    expect(
      parseCommandsGz(gz(Array.from({ length: 50_001 }, () => ['u']))).ok,
    ).toBe(false);
    const bomb = gzipSync(`[["t","${'a'.repeat(5 * 1024 * 1024)}"]]`);
    expect(bomb.byteLength).toBeLessThan(100_000);
    expect(parseCommandsGz(new Uint8Array(bomb)).ok).toBe(false);
  });

  it('100KB 넘는 압축본은 풀지 않고 거부', () => {
    expect(parseCommandsGz(new Uint8Array(102_401)).ok).toBe(false);
  });
});

describe('썸네일 · bytea', () => {
  it('PNG 머리 + 크기만 받는다', () => {
    const png = new Uint8Array(100);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(isThumbnailPng(png)).toBe(true);
    expect(isThumbnailPng(png.slice(0, 20))).toBe(false);
    expect(isThumbnailPng(new Uint8Array(100).fill(0xff))).toBe(false);
    const big = new Uint8Array(204_801);
    big.set(png.slice(0, 8));
    expect(isThumbnailPng(big)).toBe(false);
  });

  it('PostgREST bytea 글자 ↔ 바이트', () => {
    expect(toBytea(new Uint8Array([0x1f, 0x8b]))).toBe('\\x1f8b');
    expect([...fromBytea('\\x1f8b')]).toEqual([0x1f, 0x8b]);
  });
});

describe('개인정보 지킴이 (제안 J ③)', () => {
  it('숫자 9자리 이상 · 010 숫자열 · 이메일 모양', () => {
    expect(hasExtraPersonalInfo('내 번호는 123456789')).toBe(true);
    expect(hasExtraPersonalInfo('010 1234 를 눌러')).toBe(true);
    expect(hasExtraPersonalInfo('kid@school.kr')).toBe(true);
    expect(hasExtraPersonalInfo('１２３４５６７８９')).toBe(true);
    expect(hasExtraPersonalInfo('점수: 12345678점')).toBe(false);
    expect(hasExtraPersonalInfo('사과 3개, 배 10개')).toBe(false);
  });

  it('비공개 저장은 금칙어만 막고, 공개는 개인정보까지 막는다 (어느 칸인지 알려 줌)', () => {
    const email = { transcript: ['연락해 kid@naver.com'] };
    expect(checkCreationTexts(email, { publish: false }).ok).toBe(true);
    expect(checkCreationTexts(email, { publish: true })).toMatchObject({
      ok: false,
      field: 'transcript',
    });
    expect(
      checkCreationTexts({ drawing: ['123456789'] }, { publish: true }),
    ).toMatchObject({ ok: false, field: 'drawing' });
    expect(
      checkCreationTexts({ title: ['시발 그림'] }, { publish: false }),
    ).toMatchObject({ ok: false, field: 'title' });
    expect(
      checkCreationTexts(
        { title: ['무지개 거북이'], transcript: ['이름이 뭐야?', '콩이'] },
        { publish: true },
      ).ok,
    ).toBe(true);
  });
});

describe('meta 모양', () => {
  it('제목 공백 정리 · 20자 · 그림은 대화 없어도 됨 · 대화는 기록 필수', () => {
    const ok = creationMetaSchema.safeParse({
      kind: 'drawing',
      title: '  별   그림 ',
      code: 'x',
    });
    expect(ok.success && ok.data.title).toBe('별 그림');
    expect(
      creationMetaSchema.safeParse({
        kind: 'drawing',
        title: '가'.repeat(21),
        code: '',
      }).success,
    ).toBe(false);
    expect(
      creationMetaSchema.safeParse({ kind: 'drawing', title: '   ', code: '' })
        .success,
    ).toBe(false);
    expect(
      creationMetaSchema.safeParse({
        kind: 'conversation',
        title: '모험',
        code: '',
      }).success,
    ).toBe(false);
    expect(
      creationMetaSchema.safeParse({
        kind: 'conversation',
        title: '모험',
        code: '',
        transcript: [{ text: 'hi', answer: false }],
      }).success,
    ).toBe(false);
  });
});

describe('limits', () => {
  it('대화 기록은 앞부분만 상한까지', () => {
    const rows = Array.from({ length: 30 }, () => ({ text: '가'.repeat(400) }));
    const out = clampTranscript(rows);
    expect(out.reduce((n, r) => n + r.text.length, 0)).toBeLessThanOrEqual(
      CREATION_TRANSCRIPT_MAX_CHARS,
    );
    expect(out.length).toBe(20);
    expect(
      clampTranscript([{ text: 'x'.repeat(900), answer: true }])[0],
    ).toEqual({ text: 'x'.repeat(500), answer: true });
  });

  it('기본 제목: title() → 퀘스트 제목 → "나의 작품", 20자', () => {
    expect(defaultCreationTitle(null, ' 거북이  화가 ')).toBe('거북이 화가');
    expect(defaultCreationTitle('', '   ')).toBe('나의 작품');
    expect(defaultCreationTitle('가'.repeat(30))).toBe('가'.repeat(20));
  });
});
