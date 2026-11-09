/**
 * 잉크 번짐 마스크 모양 (시안 `fx.ts` BLOT). 필터 없이 모양으로 번져 저사양에서도 가볍다. 마스크라 색은 의미 없음.
 * 30초 체험(trialFx, P4-02)과 잠금 해제 연출(unlockFx, P5-05)이 같이 쓴다. 크기·위치는 px로 함께 움직여 중심을 고정한다
 */
export const INK_BLOT = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 8 C63 6 70 18 80 20 C93 23 95 38 90 48 C86 57 96 66 89 77 C82 88 66 84 57 92 C48 99 36 92 28 86 C17 79 6 74 9 60 C11 50 3 42 9 32 C16 20 33 22 38 14 C42 9 45 9 50 8Z'/><circle cx='93' cy='22' r='4'/><circle cx='8' cy='84' r='3'/><circle cx='84' cy='94' r='2.5'/></svg>",
)}")`;

/** lite 단계: 둥근 번짐 */
export const INK_ROUND = 'radial-gradient(circle, black 49%, transparent 50%)';
