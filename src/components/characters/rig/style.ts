/**
 * 리그 그림 스타일 (P2-13). 시안 A(모험 섬 클레이) · B(마법 그림책) · A×B(혼합)를 같은 리그로 그린다.
 *
 * 최종 시안은 사용자 리뷰(P2-06~08) 뒤에 확정한다. 확정되면 `DEFAULT_RIG_STYLE` 한 줄만 바꾼다
 * (호출부는 `style`을 생략하면 이 값을 쓴다).
 */
export type RigStyle = 'A' | 'B' | 'AB';
export const RIG_STYLES: readonly RigStyle[] = ['A', 'B', 'AB'];

/** 기본 스타일. 시안 확정 전 임시값 A×B (`src/lib/motion/tokens.ts`의 `DEFAULT_CONCEPT = 'ab'`와 같음) */
export const DEFAULT_RIG_STYLE: RigStyle = 'AB';

export const STYLE_LABEL: Record<RigStyle, string> = {
  A: 'A 모험 섬',
  B: 'B 그림책',
  AB: 'A×B',
};

export interface StyleRules {
  /** 잉크 외곽선 두께 (0 = 외곽선 없음) */
  outline: number;
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
    paper: 0,
    boilFps: 0,
    renderInterval: 0,
    gloss: true,
    jelly: 'jellyA',
  },
  B: {
    outline: 2.2,
    paper: 2.6,
    boilFps: 8,
    renderInterval: 1 / 12,
    gloss: false,
    jelly: 'jellyB',
  },
  AB: {
    outline: 2.6,
    paper: 1.5,
    boilFps: 0,
    renderInterval: 0,
    gloss: true,
    jelly: 'jellyAB',
  },
};
