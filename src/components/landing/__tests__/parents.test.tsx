import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  LETTER,
  ROADMAP,
  WORLD1_QUESTS,
  WORLD1_STAGES,
} from '../sections/parents/parents';
import { ParentsSection } from '../sections/ParentsSection';
import { REST_AFTER_MS } from '@/lib/rest/restTimer';

// 랜딩 보호자 섹션 (P4-07): 로드맵이 실제 콘텐츠와 맞고, 아직 없는 기능은 "준비 중"으로만, 글은 서버 HTML에 보이는 상태

const WORLD1 = join(process.cwd(), 'content/worlds/python-island');
const stageDirs = readdirSync(WORLD1, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

describe('커리큘럼 로드맵 = 콘텐츠', () => {
  it('월드 1 스테이지 이름이 content stage.yaml title과 순서까지 같다', () => {
    const titles = stageDirs.map((dir) => {
      const yaml = readFileSync(join(WORLD1, dir, 'stage.yaml'), 'utf8');
      return /^title:\s*(.+)$/m.exec(yaml)?.[1].trim();
    });
    expect(titles).toEqual([...WORLD1_STAGES]);
  });

  it('월드 1 퀘스트 수가 퀘스트 YAML 수와 같다 (보너스 퀴즈는 빼고 셈)', () => {
    const quests = stageDirs.flatMap((dir) =>
      readdirSync(join(WORLD1, dir)).filter(
        (f) =>
          f.endsWith('.yaml') &&
          f !== 'stage.yaml' &&
          !/^quest_type: quiz$/m.test(
            readFileSync(join(WORLD1, dir, f), 'utf8'),
          ),
      ),
    );
    expect(quests).toHaveLength(WORLD1_QUESTS);
  });

  it('월드 1만 열려 있고 2·3은 준비 중 (§12-Q40 이름)', () => {
    expect(ROADMAP.map((s) => [s.world, s.name, s.status])).toEqual([
      [1, '파이썬 섬', 'open'],
      [2, '코드 바다', 'soon'],
      [3, '메이커 시티', 'soon'],
    ]);
  });
});

describe('보호자 문구', () => {
  const all = LETTER.flatMap((c) => c.items).join(' ');

  it('시안 문구 중 사실이 아닌 것은 쓰지 않는다 (스티커만·20분 알림·주간 카드·코인)', () => {
    expect(all).not.toMatch(/스티커|20분|성장 카드|주간|코인/);
  });

  it('휴식 알림(P8-12)은 실제 기준(40분)과 같다', () => {
    expect(REST_AFTER_MS).toBe(40 * 60_000);
    expect(all).toMatch(/40분 넘게 이어서 하면 파이뱀이 잠깐 쉬어 가자고/);
  });

  it('보호자께 하는 존댓말로 끝난다', () => {
    for (const item of LETTER.flatMap((c) => c.items))
      expect(item).toMatch(/요\.$/);
  });
});

describe('보호자 섹션 서버 HTML', () => {
  const html = renderToStaticMarkup(<ParentsSection />);

  it('앵커·제목 id·흰 면 띠', () => {
    expect(html).toMatch(/<section[^>]*id="parents"[^>]*data-tone="surface"/);
    expect(html).toContain('id="parents-title"');
  });

  it('편지 세 단·로드맵·준비 중 표시가 처음부터 보이는 상태다', () => {
    for (const col of LETTER) {
      expect(html).toContain(`>${col.title}</h3>`);
      for (const item of col.items) expect(html).toContain(item);
    }
    for (const name of WORLD1_STAGES) expect(html).toContain(name);
    expect(html.match(/>준비 중</g)?.length).toBe(2);
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
  });
});
