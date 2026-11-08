/**
 * 30초 체험 공책의 라이브 데모 대본 (P4-02, Q43). 순수 함수라 화면 없이 테스트한다.
 *
 * `print("안녕!")`을 사람이 치듯 한 글자씩 보여 준다:
 * - 여는 괄호·따옴표를 치면 닫는 짝이 커서 뒤에 바로 생기고(에디터 자동 짝), 닫는 글자를 치면 새로 쓰지 않고 그 위를 지나간다
 * - 한글은 두벌식 조합 순서대로 (ㅇ → 아 → 안 → 안ㄴ → 안녀 → 안녕)
 * - 박자는 글자마다 조금씩 다르다 (고정 시드라 매번 같음 → 스크린샷·테스트가 흔들리지 않음)
 *
 * 대본은 "칸"(frame)의 목록이다. 칸마다 앞 칸에서 기다릴 시간(`ms`)과 그때의 공책 글자·커서 위치·단계가 있다.
 * 재생은 `useDemoPlayer`, 단계별 연출은 `TrialNotebook`이 맡는다.
 */

export type DemoPhase =
  /** 빈 공책 + 깜빡이는 커서 (시작 전 잠깐) */
  | 'ready'
  /** 글자를 치는 중 */
  | 'type'
  /** "주문 걸기" 버튼이 눌림 */
  | 'press'
  /** 결과가 튀어나옴 */
  | 'out'
  /** "이제 네 차례!" — 데모 끝, 공책을 넘겨줌 */
  | 'turn';

export interface DemoFrame {
  phase: DemoPhase;
  /** 공책 한 줄 글자 */
  code: string;
  /** 커서 위치 (글자 단위, 0 = 맨 앞) */
  caret: number;
  /** 앞 칸을 보여 준 뒤 이 칸까지 기다리는 시간 (ms) */
  ms: number;
}

/** 데모가 치는 주문과 그 결과 (화면 글자·스크린 리더 안내도 이 값을 쓴다) */
export const DEMO_CODE = 'print("안녕!")';
export const DEMO_OUTPUT = '안녕!';

/** 박자 (ms). full 기준이고 lite는 `DEMO_SPEED.lite`배 */
export const DEMO_TIMING = {
  /** 화면에 들어온 뒤 첫 글자까지 (빈 공책·커서를 잠깐 보여 줌) */
  lead: 650,
  /** 영문·기호 한 글자 */
  key: 92,
  /** 한글 조합 한 단계 (자모 하나) */
  jamo: 74,
  /** 글자마다 ± 흔들림 폭 */
  jitter: 34,
  /** 여는 괄호·따옴표 뒤 잠깐 멈칫 */
  afterOpen: 170,
  /** 다 치고 "실행"을 누르기 전 */
  beforeRun: 520,
  /** 버튼이 눌려 있는 시간 */
  press: 200,
  /** 결과가 나오고 "이제 네 차례!"까지 */
  hold: 1300,
} as const;

export const DEMO_SPEED = { full: 1, lite: 0.45 } as const;

const OPEN_TO_CLOSE: Record<string, string> = { '(': ')', '"': '"', "'": "'" };

// ── 한글 조합 ─────────────────────────────────────────────

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
/**
 * 초성 19개 → 호환 자모 코드 (공책에 혼자 찍히는 모양 ㄱㄲㄴ…ㅎ). 글자 대신 숫자로 둔다:
 * 랜딩 글꼴 서브셋은 코드의 문자열 글자를 모으는데, 이 자모는 화면에서 시스템 고정폭으로만 그려진다
 */
const CHOSEONG = [
  0x3131, 0x3132, 0x3134, 0x3137, 0x3138, 0x3139, 0x3141, 0x3142, 0x3143,
  0x3145, 0x3146, 0x3147, 0x3148, 0x3149, 0x314a, 0x314b, 0x314c, 0x314d,
  0x314e,
];

export function isHangulSyllable(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= HANGUL_BASE && c <= HANGUL_LAST;
}

/**
 * 한 음절을 두벌식으로 칠 때 화면에 보이는 모양들. 예: 안 → [ㅇ, 아, 안], 녕 → [ㄴ, 녀, 녕].
 * 겹받침·겹모음은 한 번에 (아이가 보기에 충분히 "치는" 느낌이면 된다)
 */
export function composeSteps(syllable: string): string[] {
  if (!isHangulSyllable(syllable)) return [syllable];
  const idx = (syllable.codePointAt(0) ?? 0) - HANGUL_BASE;
  const lead = Math.floor(idx / (21 * 28));
  const final = idx % 28;
  const leadOnly = String.fromCodePoint(CHOSEONG[lead]);
  const withVowel = String.fromCodePoint(syllable.codePointAt(0)! - final);
  return final === 0 ? [leadOnly, withVowel] : [leadOnly, withVowel, syllable];
}

// ── 대본 ─────────────────────────────────────────────────

/** 작은 고정 시드 난수 (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoScriptOptions {
  /** 박자 배율 (1 = full, 0.45 = lite) */
  speed?: number;
  seed?: number;
}

/**
 * `code`를 치는 데모 대본. 마지막 칸은 항상 `{ phase: 'turn', code, caret: code.length }`.
 * 자동 짝: 여는 글자를 치면 짝이 뒤에 붙고, 이미 커서 바로 뒤에 같은 닫는 글자가 있으면 그 위를 지나간다
 * (따옴표 안의 글자를 치는 동안에는 새 따옴표를 짝 짓지 않는다 — 문자열을 닫는 따옴표만 지나간다).
 */
export function buildDemoScript(
  code: string = DEMO_CODE,
  { speed = 1, seed = 7 }: DemoScriptOptions = {},
): DemoFrame[] {
  const t = (ms: number) => Math.max(16, Math.round(ms * speed));
  const rand = rng(seed);
  const jitter = () => (rand() * 2 - 1) * DEMO_TIMING.jitter;

  const frames: DemoFrame[] = [{ phase: 'ready', code: '', caret: 0, ms: 0 }];
  let text = '';
  let caret = 0;
  /** 문자열 안인지 (어느 따옴표로 열었는지) */
  let quote: string | null = null;
  let wait: number = DEMO_TIMING.lead;

  const push = (ms: number) => {
    frames.push({ phase: 'type', code: text, caret, ms: t(ms) });
  };

  for (const ch of [...code]) {
    const base = DEMO_TIMING.key + jitter();
    // 닫는 짝 위를 지나가기
    if (text[caret] === ch && (ch === ')' || ch === quote)) {
      caret += 1;
      if (ch === quote) quote = null;
      push(wait + base);
      wait = 0;
      continue;
    }
    if (isHangulSyllable(ch)) {
      const steps = composeSteps(ch);
      steps.forEach((shape, i) => {
        if (i === 0) {
          // 새 자리에 초성
          text = text.slice(0, caret) + shape + text.slice(caret);
          caret += 1;
          push(wait + base);
        } else {
          // 커서 바로 앞 글자를 조합 중인 모양으로 바꿈
          text = text.slice(0, caret - 1) + shape + text.slice(caret);
          push(DEMO_TIMING.jamo + jitter() / 2);
        }
        wait = 0;
      });
      continue;
    }
    const opens = quote === null && ch in OPEN_TO_CLOSE;
    text =
      text.slice(0, caret) +
      ch +
      (opens ? OPEN_TO_CLOSE[ch] : '') +
      text.slice(caret);
    caret += 1;
    if (opens && ch !== '(') quote = ch;
    push(wait + base);
    wait = opens ? DEMO_TIMING.afterOpen : 0;
  }

  frames.push({
    phase: 'press',
    code: text,
    caret,
    ms: t(DEMO_TIMING.beforeRun),
  });
  frames.push({ phase: 'out', code: text, caret, ms: t(DEMO_TIMING.press) });
  frames.push({ phase: 'turn', code: text, caret, ms: t(DEMO_TIMING.hold) });
  return frames;
}

/** 대본 전체 길이 (ms) */
export function scriptDuration(frames: readonly DemoFrame[]): number {
  return frames.reduce((sum, f) => sum + f.ms, 0);
}
