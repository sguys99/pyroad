// XP·레벨 규칙. 실제 지급은 DB 함수 complete_quest·submit_quiz_answer(quest_xp·level_for_xp)가 하고,
// 이 파일과 SQL 은 supabase/tests/fixtures/reward-rules.json 한 표로 대조합니다 (P1-03).
// 규칙을 바꾸면 SQL(새 마이그레이션)·이 파일·표를 함께 고칩니다.

/**
 * 레벨 곡선 (P8-01, §3 F1, docs/balance.md "레벨 곡선"): Lv N 문턱 = 200 × (N − 1)^1.3, 10 단위 반올림, Lv 1~50.
 * 1월드 완료 ≈ Lv 10, 2월드 ≈ Lv 20, 3월드 ≈ Lv 30 (시뮬레이션 `npm run balance:levels`).
 * SQL level_for_xp(00028)는 이 표를 배열 그대로 들고 있음 (부동소수 계산 차이를 피하려고)
 */
export const MAX_LEVEL = 50;

export const LEVEL_THRESHOLDS: readonly number[] = Array.from(
  { length: MAX_LEVEL },
  (_, i) => Math.round((200 * Math.pow(i, 1.3)) / 10) * 10,
);

/** 레벨 칭호 50종 (§12-Q62). 5레벨마다 큰 칭호. 1~5는 예전 칭호 그대로 */
export const LEVEL_TITLES: readonly string[] = [
  '코딩 새싹',
  '코딩 탐험가',
  '코딩 모험가',
  '코딩 용사',
  '코딩 마법사', // 5
  '글자 수집가',
  '변수 상자지기',
  '숫자 요리사',
  '갈림길 안내자',
  '섬마을 영웅', // 10
  '반복 달리기 선수',
  '리스트 정리왕',
  '함수 발명가',
  '버그 사냥꾼',
  '코드 기사', // 15
  '꼬마 항해사',
  '문자열 낚시꾼',
  '사전 박사',
  '주사위 마술사',
  '바다의 선장', // 20
  '파도 타는 코더',
  '등대지기 코더',
  '보물지도 해독가',
  '산호섬 탐험가',
  '바다의 대마법사', // 25
  '도시 설계사',
  '거북이 화가',
  '게임 제작자',
  '로봇 조종사',
  '꿈의 도시 건축가', // 30
  '별빛 연구원',
  '알고리즘 탐정',
  '코드 대장장이',
  '번개 타자왕',
  '전설의 기사', // 35
  '구름 위 비행사',
  '은하수 항해사',
  '별자리 코더',
  '우주 기지 정비사',
  '우주 코딩 대장', // 40
  '지혜의 부엉이',
  '빛나는 현자',
  '시간 여행 코더',
  '무지개 마법사',
  '용을 길들인 코더', // 45
  '꿈을 만드는 코더',
  '세상을 바꾸는 코더',
  '황금 키보드 주인',
  '별을 모은 코더',
  '전설의 파이썬 마스터', // 50
];

/** 5레벨마다 큰 칭호 + 큰 보상 (§12-Q62) */
export function isMilestoneLevel(level: number): boolean {
  return level > 1 && level % 5 === 0;
}

/**
 * 레벨 업 코인 (§12-Q62): 그 레벨에 도착하면 20, 5레벨마다 100. 지급은 P8-03(원장)·P8-04(획득처)에서
 * 원장 ref_id 를 레벨 번호로 두면 한 레벨에 한 번만 (내려갔다 다시 올라도 중복 없음)
 */
export function levelUpCoins(level: number): number {
  if (level < 2 || level > MAX_LEVEL) return 0;
  return isMilestoneLevel(level) ? 100 : 20;
}

export function calculateXP(
  baseXP: number,
  hintsUsed: number,
  usedGoldenKey?: boolean,
): number {
  if (usedGoldenKey) return 0;
  if (hintsUsed === 0) return Math.round(baseXP * 1.5);
  if (hintsUsed === 1) return Math.round(baseXP * 1.25);
  return baseXP;
}

/**
 * 코드·프로젝트 퀘스트의 별 (F3·§12-Q17, 최종 시안 Quest.tsx maxStars): 황금키 1 / 힌트 0회 3 / 1회 2 / 그 외 1.
 * 지금은 힌트·황금키 안내의 미리 보기에만 쓴다(SHOW_STARS가 꺼져 있어 화면엔 XP). 서버 판정은 P8-05에서 같은 규칙으로
 */
export function codeQuestStars(
  hintsUsed: number,
  usedGoldenKey: boolean,
): 1 | 2 | 3 {
  if (usedGoldenKey) return 1;
  if (hintsUsed === 0) return 3;
  return hintsUsed === 1 ? 2 : 1;
}

/** 레벨은 total_xp 하나로만 정한다 (B20). DB current_level 도 같은 규칙(level_for_xp)으로 트리거가 맞춤 */
export function calculateLevel(totalXP: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level - 1] ?? LEVEL_TITLES[0];
}

export function getXPProgress(totalXP: number): {
  currentLevel: number;
  currentLevelXP: number;
  nextLevelXP: number | null;
  progressPercent: number;
} {
  const currentLevel = calculateLevel(totalXP);
  const currentLevelXP = LEVEL_THRESHOLDS[currentLevel - 1];
  const nextLevelXP =
    currentLevel < LEVEL_THRESHOLDS.length
      ? LEVEL_THRESHOLDS[currentLevel]
      : null;

  if (nextLevelXP === null) {
    return { currentLevel, currentLevelXP, nextLevelXP, progressPercent: 100 };
  }

  const progress = totalXP - currentLevelXP;
  const required = nextLevelXP - currentLevelXP;
  const progressPercent = Math.round((progress / required) * 100);

  return { currentLevel, currentLevelXP, nextLevelXP, progressPercent };
}
