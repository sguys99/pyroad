import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadContent } from '@/lib/content/load';
import { pickRevealMode } from '../sections/worlds/revealMode';
import { countWorldContent } from '../sections/worlds/worldStats';
import {
  LOCKED_TIP,
  standRange,
  WORLD_PREVIEWS,
  worldNote,
} from '../sections/worlds/worldsData';

// 랜딩 세계관 (P4-04): 월드 이름(Q40)·해제 조건(Q2)·콘텐츠 수(빌드 때 계산)·펼침 방식(연출 단계)·서버 HTML

vi.mock('next/dynamic', () => ({ default: () => () => null }));
const { WorldsSection } = await import('../sections/WorldsSection');

const CONTENT = join(process.cwd(), 'content');

describe('월드 데이터 (Q40·Q2)', () => {
  it('월드 1 · 파이썬 섬 / 2 · 코드 바다 / 3 · 메이커 시티, 첫 월드만 열림', () => {
    expect(WORLD_PREVIEWS.map((w) => [w.no, w.name, w.state])).toEqual([
      [1, '파이썬 섬', 'open'],
      [2, '코드 바다', 'locked'],
      [3, '메이커 시티', 'locked'],
    ]);
  });

  it('잠긴 월드는 앞 월드의 마지막 프로젝트를 끝내면 열린다 (실력 확인 퀴즈는 아직 말하지 않음)', () => {
    const [w1, w2, w3] = WORLD_PREVIEWS;
    expect(worldNote(w2, w1, null)).toBe(
      '파이썬 섬의 마지막 프로젝트를 끝내면 열려요',
    );
    expect(worldNote(w3, w2, null)).toBe(
      '코드 바다의 마지막 프로젝트를 끝내면 열려요',
    );
    for (const w of WORLD_PREVIEWS) {
      expect(`${w.line} ${worldNote(w, undefined, null)}`).not.toMatch(/퀴즈/);
    }
    expect(LOCKED_TIP).toBe('앞 월드를 끝내면 열려요!');
  });

  it('열린 월드는 콘텐츠 수를, 수를 모르면 숫자 없이 안내한다', () => {
    const w1 = WORLD_PREVIEWS[0];
    expect(worldNote(w1, undefined, { stages: 7, quests: 44 })).toBe(
      '스테이지 7곳 · 퀘스트 44개',
    );
    expect(worldNote(w1, undefined, null)).not.toMatch(/\d/);
  });

  it('표지가 일어서는 구간은 차례대로, 0~1 안에 있다', () => {
    const ranges = [0, 1, 2].map((i) => standRange(i, 3));
    for (const [i, r] of ranges.entries()) {
      expect(r.s).toBeGreaterThanOrEqual(0);
      expect(r.e).toBeLessThanOrEqual(1);
      expect(r.e).toBeGreaterThan(r.s);
      if (i > 0) expect(r.s).toBeGreaterThan(ranges[i - 1].s);
    }
  });
});

describe('월드 콘텐츠 수 (빌드 때 content/에서 계산)', () => {
  it('콘텐츠 로더와 같은 스테이지·퀘스트 수', () => {
    const tree = loadContent(CONTENT);
    const w1 = tree.worlds.find((w) => w.world.order === 1);
    expect(w1).toBeDefined();
    expect(countWorldContent(1, CONTENT)).toEqual({
      stages: w1!.stages.length,
      quests: w1!.stages.reduce((n, s) => n + s.quests.length, 0),
    });
  });

  it('없는 월드·없는 디렉토리는 null', () => {
    expect(countWorldContent(99, CONTENT)).toBeNull();
    expect(
      countWorldContent(1, join(tmpdir(), 'pyroad-no-content')),
    ).toBeNull();
  });

  it('번호 형식이 아닌 디렉토리·파일과 stage.yaml이 없는 스테이지는 세지 않는다', () => {
    const root = mkdtempSync(join(tmpdir(), 'pyroad-worlds-'));
    const world = join(root, 'worlds', 'demo');
    mkdirSync(join(world, '01-a'), { recursive: true });
    mkdirSync(join(world, '02-b'), { recursive: true });
    mkdirSync(join(world, 'notes'), { recursive: true });
    writeFileSync(join(world, 'world.yaml'), 'slug: demo\norder: 1\n');
    writeFileSync(join(world, '01-a', 'stage.yaml'), 'order: 1\n');
    writeFileSync(join(world, '01-a', '01-x.yaml'), 'order: 1\n');
    writeFileSync(join(world, '01-a', '02-y.yaml'), 'order: 2\n');
    writeFileSync(join(world, '01-a', 'README.md'), '');
    writeFileSync(join(world, '02-b', '01-z.yaml'), 'order: 1\n');
    expect(countWorldContent(1, root)).toEqual({ stages: 1, quests: 2 });
  });
});

describe('펼침 방식 (연출 단계)', () => {
  it('full + 스크롤 연동 → scroll, 지원 안 함·lite → once, minimal·동작 줄이기 → static', () => {
    expect(pickRevealMode('full', false, true)).toBe('scroll');
    expect(pickRevealMode('full', false, false)).toBe('once');
    expect(pickRevealMode('lite', false, true)).toBe('once');
    expect(pickRevealMode('minimal', false, true)).toBe('static');
    expect(pickRevealMode('full', true, true)).toBe('static');
    expect(pickRevealMode('lite', true, false)).toBe('static');
  });
});

describe('세계관 섹션 서버 HTML', () => {
  const html = renderToStaticMarkup(<WorldsSection />);

  it('앵커·제목·월드 3개가 차례대로 있다', () => {
    expect(html).toMatch(
      /<section[^>]*id="worlds"[^>]*aria-labelledby="worlds-title"/,
    );
    const names = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, ''),
    );
    expect(names).toEqual([
      '월드 1 · 파이썬 섬',
      '월드 2 · 코드 바다',
      '월드 3 · 메이커 시티',
    ]);
  });

  it('월드 1의 스테이지·퀘스트 수는 콘텐츠에서 온다', () => {
    const stats = countWorldContent(1, CONTENT)!;
    expect(html).toContain(
      `스테이지 ${stats.stages}곳 · 퀘스트 ${stats.quests}개`,
    );
  });

  it('열린 월드는 30초 체험으로, 잠긴 월드는 안내 버튼 (자물쇠 + 준비 중)', () => {
    expect(html).toMatch(/<a href="#try"[^>]*class="ld-worlds-act"/);
    expect(html).toContain('aria-label="코드 바다: 잠겨 있어요"');
    expect(html).toContain('aria-label="메이커 시티: 잠겨 있어요"');
    expect(html.match(/준비 중/g)).toHaveLength(2);
    expect(html.match(/class="ld-worlds-lock"/g)).toHaveLength(2);
  });

  it('글자를 opacity 0으로 그리지 않고, 지도를 서버에서 접어 두지 않는다 (§2.10)', () => {
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
    expect(html).not.toContain('data-armed');
    expect(html).not.toContain('data-open');
  });
});
