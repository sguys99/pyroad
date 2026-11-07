/**
 * 리그 그림 스타일 (P2-13). 시안 A(모험 섬 클레이) · B(마법 그림책) · A×B(혼합)를 같은 리그로 그린다.
 *
 * 최종 시안은 사용자 리뷰(P2-06~08) 뒤에 확정한다. 확정되면 `DEFAULT_RIG_STYLE` 한 줄만 바꾼다
 * (호출부는 `style`을 생략하면 이 값을 쓴다).
 */
export type RigStyle = 'A' | 'B' | 'AB';
export const RIG_STYLES: readonly RigStyle[] = ['A', 'B', 'AB'];

/** 기본 스타일. 사용자 리뷰(P2-06, §12-Q28)에서 B(그림책) 방향으로 확정 */
export const DEFAULT_RIG_STYLE: RigStyle = 'B';

export const STYLE_LABEL: Record<RigStyle, string> = {
  A: 'A 모험 섬',
  B: 'B 그림책',
  AB: 'A×B',
};

export interface StyleRules {
  /** 잉크 외곽선 두께 (0 = 외곽선 없음) */
  outline: number;
  /**
   * 외곽선을 "몸 면 색의 진한 톤"으로 쓰나 (P2-07 2차, B). 켜면 팔레트 `outline`이 몸색의 진한 톤이고,
   * 소품(반짝이·모자)·다리·더듬이는 잉크를 두르지 않고 제 색을 쓴다. 끄면 모든 부위에 같은 잉크 선(A×B)
   */
  tonal: boolean;
  /** 종이 결·선 흔들림 필터 (`feDisplacementMap` 기본 변위). 연출 단계가 lite 이하면 필터 자체를 뺀다 */
  paper: number;
  /** 선 떨림: 필터 seed를 바꾸는 주기(fps). 0이면 고정 */
  boilFps: number;
  /** 렌더 간격(초). B는 "2프레임마다"(12fps) 손그림 리듬, 0이면 연출 단계 상한까지 */
  renderInterval: number;
  /** 하이라이트 도형(광택)을 그리나 */
  gloss: boolean;
  /** 착지 젤리 스프링 (`tokens.ts` SPRINGS 이름) */
  jelly: 'jellyA' | 'jellyB' | 'jellyAB';
}

export const STYLE_RULES: Record<RigStyle, StyleRules> = {
  A: {
    outline: 0,
    tonal: false,
    paper: 0,
    boilFps: 0,
    renderInterval: 0,
    gloss: true,
    jelly: 'jellyA',
  },
  /** B 그림책 (P2-07 2차 "선이 굵어 투박"): 외곽선 2.2 잉크 갈색 → 1.1 몸색 진한 톤, 종이 결·선 떨림 없음. 12fps 리듬·젤리는 그대로 */
  B: {
    outline: 1.1,
    tonal: true,
    paper: 0,
    boilFps: 0,
    renderInterval: 1 / 12,
    gloss: false,
    jelly: 'jellyB',
  },
  AB: {
    outline: 2.6,
    tonal: false,
    paper: 1.5,
    boilFps: 0,
    renderInterval: 0,
    gloss: true,
    jelly: 'jellyAB',
  },
};
