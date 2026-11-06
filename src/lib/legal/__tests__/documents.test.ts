import { describe, expect, it } from 'vitest';
import { LEGAL_LINKS, LEGAL_OPERATOR, formatLegalDate } from '../meta';
import { PRIVACY } from '../privacy';
import { TERMS } from '../terms';
import { LAST_LOGIN_STORAGE_KEY } from '@/lib/auth/lastLogin';
import type { LegalBlock, LegalDocument, LegalInline } from '../types';

// 약관·개인정보처리방침 문서 (P3-14): 구조, 쉬운 말 요약, 안쪽 링크, 코드와 맞아야 하는 사실

function inlineText(c: LegalInline | LegalInline[]): string {
  return (Array.isArray(c) ? c : [c])
    .map((p) => (typeof p === 'string' ? p : p.text))
    .join('');
}

function blockText(b: LegalBlock): string {
  switch (b.type) {
    case 'p':
    case 'note':
      return inlineText(b.content);
    case 'ul':
    case 'ol':
      return b.items.map(inlineText).join('\n');
    case 'table':
      return [
        b.head.join(' '),
        ...b.rows.map((r) => r.map(inlineText).join(' ')),
      ].join('\n');
  }
}

function fullText(doc: LegalDocument): string {
  return [
    ...doc.preamble.map(blockText),
    ...doc.sections.flatMap((s) => [s.title, ...s.blocks.map(blockText)]),
  ].join('\n');
}

function links(doc: LegalDocument): string[] {
  const out: string[] = [];
  const visit = (c: LegalInline | LegalInline[]) => {
    for (const p of Array.isArray(c) ? c : [c])
      if (typeof p !== 'string') out.push(p.href);
  };
  for (const s of doc.sections) {
    for (const b of s.blocks) {
      if (b.type === 'p' || b.type === 'note') visit(b.content);
      else if (b.type === 'ul' || b.type === 'ol') b.items.forEach(visit);
      else if (b.type === 'table') b.rows.flat().forEach(visit);
    }
  }
  return out;
}

describe.each([TERMS, PRIVACY])('$title 문서 구조', (doc) => {
  it('쉬운 말 요약은 5~7줄', () => {
    expect(doc.summary.length).toBeGreaterThanOrEqual(5);
    expect(doc.summary.length).toBeLessThanOrEqual(7);
  });

  it('절 id는 겹치지 않는 anchor 형식이고 개정 이력이 있다', () => {
    const ids = doc.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(ids).not.toContain('history'); // 화면이 개정 이력 anchor로 씀
    expect(doc.history[0].date).toBe(doc.version);
  });

  it('표의 칸 수가 머리와 같다', () => {
    for (const s of doc.sections) {
      for (const b of s.blocks) {
        if (b.type !== 'table') continue;
        for (const row of b.rows) expect(row).toHaveLength(b.head.length);
      }
    }
  });

  it('안쪽 링크는 있는 페이지·절을 가리킨다', () => {
    const docs: Record<string, LegalDocument> = {
      '/terms': TERMS,
      '/privacy': PRIVACY,
    };
    for (const href of links(doc)) {
      if (!href.startsWith('/')) {
        expect(href).toMatch(/^(https:\/\/|mailto:)/);
        continue;
      }
      const [path, hash] = href.split('#');
      expect(LEGAL_LINKS.map((l) => l.href as string)).toContain(path);
      if (hash) expect(docs[path].sections.map((s) => s.id)).toContain(hash);
    }
  });

  it('운영자 연락처가 있다', () => {
    expect(fullText(doc)).toContain(LEGAL_OPERATOR.email);
  });
});

describe('개인정보처리방침이 코드와 맞는 사실을 담는다', () => {
  const text = fullText(PRIVACY);

  it.each([
    ['만 14세 미만 절 (P3-15·약관 링크 대상)', '법정대리인'],
    ['미동의 계정 30일 파기 (§12-Q36)', '30일'],
    ['파기 7일 전 안내', '7일 전부터'],
    ['분석 보존 180일 (P1-17)', '180일'],
    ['DNT·GPC 존중', 'Global Privacy Control'],
    ['API 키 암호화 (B13)', 'AES-256-GCM'],
    ['AI 튜터 국외 전송', 'Gemini'],
    [
      '튜터에 계정 정보를 보내지 않음',
      '닉네임·이메일·계정 식별자는 보내지 않음',
    ],
    ['본인 키 provider', 'Anthropic'],
    [
      '오류 기록 최소 수집 (P1-16)',
      '작성한 코드·입력 내용·쿠키·IP 주소는 보내지 않음',
    ],
    [
      '카카오 자체 보호자 동의와 별개 (P0-04)',
      '카카오가 자체 보호자 동의 화면',
    ],
    ['탈퇴 버튼 위치', '탈퇴하기'],
    ['신고 기관', '118'],
    ['제3자 제공 없음', '제3자에게 제공하지 않습니다'],
  ])('%s', (_, phrase) => {
    expect(text).toContain(phrase);
  });

  it('카카오·네이버는 식별자만 받는다고 적는다 (이메일 미수집, §2.8)', () => {
    const items = PRIVACY.sections.find((s) => s.id === 'items')!;
    const table = items.blocks.find((b) => b.type === 'table');
    if (table?.type !== 'table') throw new Error('항목 표가 없음');
    const row = (label: string) =>
      table.rows
        .find((r) => inlineText(r[0]).includes(label))!
        .map(inlineText)
        .join(' ');
    expect(row('카카오')).not.toContain('이메일');
    expect(row('네이버')).not.toContain('이메일');
    expect(row('Google')).toContain('이메일');
  });
});

describe('개인정보처리방침 10절 = 코드의 브라우저 저장 (P3-08)', () => {
  it('최근 로그인 수단은 쿠키가 아니라 웹 저장소(pyroad.lastLogin.v1)에, 쿠키는 인증 쿠키만', () => {
    const cookies = PRIVACY.sections.find((s) => s.id === 'cookies')!;
    const text = cookies.blocks.map(blockText).join('\n');
    expect(LAST_LOGIN_STORAGE_KEY).toBe('pyroad.lastLogin.v1');
    expect(text).toMatch(/웹 저장소:[^\n]*최근에 사용한 로그인 수단/);
    expect(text).toContain('인증 쿠키만 사용합니다');
  });
});

describe('날짜 표기', () => {
  it('YYYY-MM-DD → 한국어 날짜 (시간대와 무관)', () => {
    expect(formatLegalDate('2026-11-06')).toBe('2026년 11월 6일');
    expect(formatLegalDate('2027-01-15')).toBe('2027년 1월 15일');
    expect(formatLegalDate('nope')).toBe('nope');
  });
});
