import { describe, expect, it } from 'vitest';
import {
  LEARNING_SOURCES,
  SHOP,
  SHOP_DRAFT_TOTAL,
  STUDENTS,
  daysToPrice,
  loadAchievements,
  loadMissions,
  retroCoins,
  simulateEconomy,
  total,
  world1Stages,
} from '../economy';

// docs/balance.md 3~4절 숫자가 규칙·콘텐츠가 바뀌어도 지켜지는지 (P8-14). 바뀌면 시트 표도 `npm run balance:economy`로 다시
describe('획득 속도 시뮬레이션', () => {
  const stages = world1Stages();
  const [light, normal, eager, weekend] = STUDENTS.map((s) =>
    simulateEconomy(s, { days: 180, stages }),
  );
  const at = (r: typeof normal, d: number) => r.rows[d];

  it('마이그레이션 표를 읽음: 업적 42종 · 미션 7종', () => {
    expect(loadAchievements()).toHaveLength(42);
    expect(loadMissions().map((m) => m.id)).toEqual([
      'quest_1',
      'quest_2',
      'quest_3',
      'no_hint_1',
      'review_1',
      'daily_quiz',
      'quiz_correct_2',
    ]);
  });

  it('1월드 끝 레벨: 미션 XP 포함 Lv 11~13, 빼면 Lv 10 (F1 목표)', () => {
    for (const r of [light, normal, eager, weekend]) {
      expect(r.world1Day).not.toBeNull();
      expect(at(r, r.world1Day!).level).toBeGreaterThanOrEqual(11);
      expect(at(r, r.world1Day!).level).toBeLessThanOrEqual(13);
    }
    const noMission = simulateEconomy(STUDENTS[1], {
      days: 40,
      missionXp: 0,
      stages,
    });
    expect(at(noMission, normal.world1Day!).level).toBe(10);
  });

  it('보통 학생은 약 한 달에 1월드, 별은 퀴즈·코드 모두 35일 안에 다 채움', () => {
    expect(normal.world1Day! + 1).toBeGreaterThanOrEqual(25);
    expect(normal.world1Day! + 1).toBeLessThanOrEqual(35);
    const full = normal.rows.find(
      (x) =>
        x.quizStars === normal.maxQuizStars &&
        x.codeStars === normal.maxCodeStars,
    );
    expect(full!.day + 1).toBeLessThanOrEqual(35);
  });

  it('1월드 동안 코인의 85% 이상이 학습 행동에서 (§2.6), 출석은 15% 이하', () => {
    for (const r of [light, normal, eager, weekend]) {
      const c = at(r, Math.min(r.world1Day!, 179)).coins;
      const learning = LEARNING_SOURCES.reduce((n, s) => n + c[s], 0);
      expect(learning / total(c)).toBeGreaterThanOrEqual(0.85);
      expect(c.attendance / total(c)).toBeLessThanOrEqual(0.15);
    }
  });

  it('코인 상한: 퀘스트·별은 콘텐츠만큼만 (같은 별 번호 두 번 없음)', () => {
    const quests = stages.flatMap((s) => s.quests);
    const code = quests.filter((q) => q.type !== 'quiz').length;
    for (const r of [light, normal, eager, weekend]) {
      // 프로젝트 첫 완료는 40 (§12-Q65 (a))
      expect(at(r, 179).coins.quest).toBe(code * 10 + 30);
      expect(at(r, 179).coins.star).toBe(quests.length * 3 * 5);
    }
  });

  it('Phase 9 확정가(§12-Q65, 초기안 ×3): 첫 구매는 첫 주 안, 물건 한 개씩 모두는 보통 학생 1월드 끝 무렵', () => {
    expect(daysToPrice(normal, SHOP[0].price)).toBeLessThanOrEqual(6);
    const all = SHOP.reduce((n, s) => n + s.price, 0);
    expect(all).toBe(SHOP_DRAFT_TOTAL * 3);
    const d = daysToPrice(normal, all)!;
    expect(Math.abs(d - normal.world1Day!)).toBeLessThanOrEqual(7);
  });

  it('§12-Q65 (e): 하루에 3개를 깬 적 없는 학생에겐 quest_3 을 배정하지 않음, 배정되면 깰 수 있음', () => {
    expect(light.missions.assigned.quest_3 ?? 0).toBe(0);
    expect(normal.missions.assigned.quest_3 ?? 0).toBe(0);
    expect(eager.missions.done.quest_3).toBe(eager.missions.assigned.quest_3);
  });

  it('§12-Q65 (c): 마지막 스테이지 상자는 프로젝트를 끝낸 뒤 (퀴즈 별만으로는 안 열림)', () => {
    for (const r of [light, normal, eager, weekend])
      expect(r.chestDays[7]).toBeGreaterThanOrEqual(r.world1Day!);
  });

  it('소급 보상: 1월드를 다 끝낸 기존 사용자는 바로 1,465코인 + 받기 가능 업적', () => {
    expect(retroCoins(7, stages).auto).toBe(1465);
    expect(retroCoins(7, stages).level).toBe(10);
  });
});
