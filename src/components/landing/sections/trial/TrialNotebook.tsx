'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Code, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PybaemState } from '@/components/characters/rig';
import { useSfx } from '@/components/providers/soundContext';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { track } from '@/lib/analytics/track';
import {
  MAX_CODE_LENGTH,
  NO_PRINT_HINT,
  autoCorrect,
  explain,
  runMiniPython,
  type MiniResult,
} from '@/lib/landing/miniPython';
import {
  DEMO_CODE,
  DEMO_OUTPUT,
  DEMO_SPEED,
  buildDemoScript,
  type DemoFrame,
  type DemoPhase,
} from './demoScript';
import {
  useDemoPlayer,
  useFullyVisible,
  usePageVisible,
} from './useDemoPlayer';
import { inkReveal, popOut, shake, stampConfetti, stampSlam } from './trialFx';
import { TrialBuddy } from './TrialBuddy';
import { TrialCta } from './TrialCta';
import { highlightSegments, splitSegments, type Segment } from './highlight';

/** 색칠한 조각들 (문자열만 색) */
function Segments({ segs }: { segs: Segment[] }) {
  return segs.map((s, i) =>
    s.kind === 'str' ? (
      <span key={i} className="ld-trial-str">
        {s.text}
      </span>
    ) : (
      <span key={i}>{s.text}</span>
    ),
  );
}

/**
 * 파이뱀이 하는 말. 화면 글자는 랜딩 글꼴 서브셋에 들어가고 폰트 예산(150KB)이 빠듯해서
 * 이미 랜딩에 있는 글자로 쓴다 (새 글자는 차·례 둘). 바꾸면 `npm run fonts:build -- --landing`
 */
const LINES = {
  watch: '잘 봐! 내가 주문을 걸어 볼게.',
  out: '와! 파이썬이 그대로 말했어!',
  turn: '이제 네 차례! "안녕!"을 네 이름으로 고치고 주문을 걸어 봐.',
} as const;

/** 성공 뒤 "다른 주문도 걸어 볼래?" 추천 (누르면 공책에 넣고 바로 건다). Q28: 셋만 */
export const TRIAL_CHIPS = [
  'print("하" * 3)',
  'print(1 + 2 * 3)',
  'print("파이" + "썬")',
] as const;

/** 휴대폰 보조 키 (따옴표·괄호는 가상 키보드에서 찾기 어렵다) */
const AUX_KEYS = ['"', '(', ')'] as const;

/** 서버 HTML·데모 끝 모습의 결과 */
const DEMO_RESULT: MiniResult = {
  ok: true,
  out: `${DEMO_OUTPUT}\n`,
  printed: true,
};

/** 결과 칸에 보일 글자 (print의 마지막 줄바꿈 하나는 뺀다) */
function shown(out: string): string {
  return out.endsWith('\n') ? out.slice(0, -1) : out;
}

/** 데모가 끝나고 스크린 리더에 한 번 알리는 말 (데모 중 글자는 읽히지 않음) */
const HANDOFF_ANNOUNCE = `파이뱀이 ${DEMO_CODE} 주문을 걸자 결과에 ${DEMO_OUTPUT} 이 나왔어요. 이제 네 차례예요.`;

type Mode = DemoPhase | 'live';

/** 말풍선에 옮겨 말할 때는 짧게 (긴 결과가 말풍선을 키워 화면이 흔들리지 않게) */
function clip(text: string, max = 12): string {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  return chars.length > max
    ? `${chars.slice(0, max).join('')}…`
    : chars.join('');
}

/** 데모를 돌릴 단계: html 속성(부트 스크립트·Provider가 씀)이 있으면 그것, 없으면 컨텍스트 값 */
function pageMotion(
  springs: boolean,
  ambient: boolean,
): 'full' | 'lite' | 'still' {
  const d = document.documentElement.dataset;
  if (d.motion) {
    if (d.reduced === 'true' || d.motion === 'minimal') return 'still';
    return d.motion === 'lite' ? 'lite' : 'full';
  }
  if (!springs) return 'still';
  return ambient ? 'full' : 'lite';
}

const BUDDY_STATE: Record<Mode, PybaemState> = {
  ready: 'idle',
  type: 'teach',
  press: 'teach',
  out: 'happy',
  turn: 'encourage',
  live: 'encourage',
};

/**
 * 30초 체험 공책 (P4-02 라이브 데모 → P4-03 체험, Q43 "데모와 체험은 한 공책").
 *
 * 흐름: 서버 HTML·동작 줄이기·minimal은 완성된 주문과 결과가 보이는 정지 상태(= 데모가 끝난 모습).
 * full·lite는 하이드레이션 뒤 빈 공책으로 바꿔 두고, 공책 줄이 화면에 다 들어오면 대본(`demoScript`)을 재생한다:
 * 타이핑(자동 짝·한글 조합) → "주문 걸기" 눌림 → 결과가 잉크 번짐 + 팝으로 튀어나옴(파이뱀 폴짝) → "이제 네 차례!".
 *
 * - 화면 밖·숨긴 탭이면 그 자리에서 멈췄다가 이어 친다
 * - 공책을 누르거나(포인터) 키보드로 들어오면 데모를 바로 끝내고 넘겨준다
 * - 데모 글자는 `aria-hidden` 겹 레이어에만 그린다 (입력칸은 그동안 비어 있음) → 한 글자씩 읽히지 않고, 끝나면 한 번 알림
 */
export function TrialNotebook() {
  const { budget } = useMotionTier();
  const play = useSfx();

  // 서버·첫 렌더 = 데모가 끝난 모습 (하이드레이션 일치)
  const [code, setCode] = useState(DEMO_CODE);
  const [result, setResult] = useState<MiniResult | null>(DEMO_RESULT);
  const [script, setScript] = useState<DemoFrame[] | null>(null);
  /** 데모가 끝나고 넘겨받은 직후 ("이제 네 차례" 강조, 처음 고칠 때까지) */
  const [handed, setHanded] = useState(false);
  const [announce, setAnnounce] = useState('');
  /** 마스코트가 지금 하는 말: 넘겨줄 때 안내 / 아이가 건 주문의 결과 */
  const [said, setSaid] = useState<'turn' | 'result'>('turn');
  /** 말풍선을 새로 칠 때마다 +1 */
  const [talk, setTalk] = useState(0);
  /** 성공할 때마다 +1 (파이뱀 반짝이) */
  const [burst, setBurst] = useState(0);
  /** 처음 성공함 → "첫 주문!" 도장·로그인 카드·추천 주문 */
  const [won, setWon] = useState(false);
  const started = useRef(false);
  const touched = useRef(false);
  const runs = useRef(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  const valRef = useRef<HTMLSpanElement>(null);
  const stampRef = useRef<HTMLDivElement>(null);
  const ghostIn = useRef<HTMLSpanElement>(null);
  const [lineRef, lineVisible] = useFullyVisible<HTMLDivElement>();
  const pageVisible = usePageVisible();
  const index = useDemoPlayer(script, lineVisible && pageVisible);
  const frame = script?.[index] ?? null;
  const mode: Mode = frame?.phase ?? 'live';
  const demo = frame !== null;

  // full·lite: 빈 공책으로 바꿔 두고 화면에 들어오면 재생. minimal·동작 줄이기는 정지 상태 그대로.
  // 단계는 <html data-motion data-reduced>에서 읽는다 (부트 스크립트가 첫 페인트 전에 정한 값 = 진짜 단계.
  // 컨텍스트는 하이드레이션 직후 잠깐 기본값 full일 수 있다)
  useEffect(() => {
    if (started.current) return;
    const tier = pageMotion(budget.springs, budget.ambient);
    if (tier === 'still') return;
    started.current = true;
    setScript(
      buildDemoScript(DEMO_CODE, {
        speed: tier === 'full' ? DEMO_SPEED.full : DEMO_SPEED.lite,
      }),
    );
  }, [budget.springs, budget.ambient]);

  /** 데모를 끝내고 공책을 넘겨준다 (끝까지 봤거나, 아이가 건드렸거나) */
  const handOff = useCallback(() => {
    setScript(null);
    setCode(DEMO_CODE);
    setResult(DEMO_RESULT);
    setHanded(true);
    setSaid('turn');
    setTalk((n) => n + 1);
    setAnnounce(HANDOFF_ANNOUNCE);
  }, []);

  // 데모 도중 단계가 minimal·동작 줄이기로 내려가면 바로 끝 모습으로 (아직 치기 전이면 조용히)
  useEffect(() => {
    if (!demo || budget.springs) return;
    if (index === 0) setScript(null);
    else handOff();
  }, [demo, budget.springs, index, handOff]);

  // 데모 단계별 연출
  useEffect(() => {
    if (mode === 'out') {
      inkReveal(outRef.current, budget);
      popOut(valRef.current, budget);
    } else if (mode === 'turn') {
      handOff();
    }
    // 단계가 바뀔 때만 (budget은 그 순간 값을 읽음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 말풍선: 데모 단계가 바뀔 때 새로 친다
  useEffect(() => {
    if (mode === 'ready' || mode === 'out') setTalk((n) => n + 1);
  }, [mode]);

  // 첫 성공: 도장 쾅 → 닿는 순간 효과음·컨페티
  useEffect(() => {
    if (!won) return;
    stampSlam(stampRef.current, budget, {
      paper: cardRef.current,
      onImpact: () => {
        play('star');
        stampConfetti(stampRef.current, budget);
      },
    });
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const skip = () => {
    if (demo) handOff();
  };

  /** 아이가 처음 공책을 만짐 (분석 `trial_start`, 페이지당 1번) */
  const touch = () => {
    if (touched.current) return;
    touched.current = true;
    track('trial_start', {});
  };

  /** 입력칸이 옆으로 스크롤되면 겹 레이어도 같이 민다 */
  const syncScroll = (el: HTMLInputElement) => {
    const g = ghostIn.current;
    if (g)
      g.style.transform = el.scrollLeft
        ? `translateX(${-el.scrollLeft}px)`
        : '';
  };

  const run = (src: string = code) => {
    if (demo) return;
    touch();
    const r = runMiniPython(src);
    runs.current += 1;
    const success = r.ok && r.printed;
    track('trial_run', {
      result: r.ok ? (r.printed ? 'ok' : 'no_print') : r.error.kind,
    });
    const first = success && !won;
    if (first) {
      setWon(true);
      track('trial_success', { runs: Math.min(runs.current, 99) });
    }
    setResult(r);
    setHanded(false);
    setSaid('result');
    setTalk((n) => n + 1);
    play('run');
    if (success) {
      play('correct');
      setBurst((n) => n + 1);
    } else if (!r.ok) {
      play('bug');
      shake(cardRef.current, budget);
    }
    setAnnounce(
      success
        ? `${first ? '첫 주문 성공! ' : ''}결과: ${shown(r.out)}`
        : r.ok
          ? NO_PRINT_HINT
          : explain(r.error),
    );
    requestAnimationFrame(() => {
      inkReveal(outRef.current, budget);
      if (success) popOut(valRef.current, budget);
    });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      run();
    }
  };

  /** 보조 키: 커서 자리에 글자를 넣고 입력칸에 그대로 둔다 */
  const insert = (text: string) => {
    const el = inputRef.current;
    if (demo || !el) return;
    touch();
    const s = el.selectionStart ?? code.length;
    const e = el.selectionEnd ?? s;
    const next = code.slice(0, s) + text + code.slice(e);
    if (next.length > MAX_CODE_LENGTH) return;
    setCode(next);
    setHanded(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + text.length, s + text.length);
      syncScroll(el);
    });
  };

  const tryChip = (chip: string) => {
    setCode(chip);
    run(chip);
  };

  // 화면에 보이는 값 (데모 중이면 대본, 아니면 아이 것)
  const shownResult: MiniResult | null = demo
    ? mode === 'out' || mode === 'turn'
      ? DEMO_RESULT
      : null
    : result;
  // 색칠 겹 레이어: 데모 중이면 대본 글자 + 커서, 아니면 아이가 친 글자 (입력칸 글자는 투명, 커서만 보임)
  const shownCode = frame ? frame.code : code;
  const [before, after] = splitSegments(
    highlightSegments(shownCode),
    frame ? frame.caret : shownCode.length,
  );

  // 마스코트: 데모·넘겨줌은 파이뱀, 버그가 있으면 버그버그
  const buddy = useMemo(() => {
    if (demo) {
      return {
        who: 'pybaem' as const,
        state: BUDDY_STATE[mode],
        line: mode === 'out' ? LINES.out : LINES.watch,
      };
    }
    if (said === 'turn' || !result) {
      return {
        who: 'pybaem' as const,
        state: 'encourage' as const,
        line: LINES.turn,
      };
    }
    if (!result.ok) {
      return {
        who: 'bugbug' as const,
        line: `히히, 버그 찾았다! ${explain(result.error)}`,
      };
    }
    if (!result.printed) {
      return {
        who: 'pybaem' as const,
        state: 'think' as const,
        line: NO_PRINT_HINT,
      };
    }
    return {
      who: 'pybaem' as const,
      state: 'happy' as const,
      line: `"${clip(shown(result.out))}" 잘 들렸어! 방금 진짜 파이썬 주문을 걸었어.`,
    };
  }, [demo, mode, said, result]);

  const outState = !shownResult
    ? 'empty'
    : !shownResult.ok
      ? 'err'
      : shownResult.printed
        ? 'ok'
        : 'none';

  return (
    <div className="ld-trial" data-mode={mode} data-won={won || undefined}>
      <div
        ref={cardRef}
        className="ld-trial-card"
        data-testid="trial-card"
        data-demo={demo || undefined}
        onPointerDownCapture={skip}
        onFocusCapture={skip}
      >
        <p className="ld-trial-label font-display">
          <Code aria-hidden />
          나의 첫 공책
        </p>
        {won && (
          <div
            ref={stampRef}
            className="ld-trial-stamp font-display"
            data-testid="trial-stamp"
            aria-hidden
          >
            첫 주문!
          </div>
        )}

        <label className="sr-only" htmlFor="try-code">
          파이썬 한 줄
        </label>
        <div
          ref={lineRef}
          className="ld-trial-line"
          data-turn={handed || undefined}
        >
          <span className="ld-trial-no font-mono" aria-hidden>
            1
          </span>
          <div className="ld-trial-field">
            <input
              ref={inputRef}
              id="try-code"
              className="ld-trial-input font-mono"
              data-testid="trial-input"
              value={demo ? '' : code}
              readOnly={demo}
              maxLength={MAX_CODE_LENGTH}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              enterKeyHint="go"
              onChange={(e) => {
                const el = e.currentTarget;
                const raw = el.value;
                // 휴대폰 둥근 따옴표·전각 괄호는 코드용 글자로 (글자 수는 같아 커서를 되돌릴 수 있다)
                const fixed = autoCorrect(raw);
                setCode(fixed);
                setHanded(false);
                touch();
                const s = el.selectionStart;
                const en = el.selectionEnd;
                requestAnimationFrame(() => {
                  if (fixed !== raw && s !== null && en !== null) {
                    el.setSelectionRange(s, en);
                  }
                  syncScroll(el);
                });
              }}
              onScroll={(e) => syncScroll(e.currentTarget)}
              onSelect={(e) => syncScroll(e.currentTarget)}
              onKeyDown={onKey}
            />
            <div
              className="ld-trial-ghost font-mono"
              aria-hidden
              data-testid="trial-ghost"
              data-typing={mode === 'type' || undefined}
            >
              <span ref={ghostIn} className="ld-trial-ghost-in">
                <Segments segs={before} />
                {frame && <span className="g-caret ld-trial-caret" />}
                <Segments segs={after} />
              </span>
            </div>
          </div>
        </div>

        <div className="ld-trial-actions">
          <Button
            variant="primary"
            icon={<Play aria-hidden />}
            pressed={mode === 'press'}
            sfx={false}
            onClick={() => run()}
            data-testid="trial-run"
          >
            주문 걸기
          </Button>
          {/* 휴대폰 보조 키 (누를 때 입력칸 포커스·가상 키보드를 그대로 둔다) */}
          <div className="ld-trial-keys" data-testid="trial-keys">
            {AUX_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                className="ld-trial-key font-mono"
                aria-label={`${k} 쓰기`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => insert(k)}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={outRef}
          className="ld-trial-out"
          data-testid="trial-out"
          data-state={outState}
        >
          <span className="ld-trial-out-k">결과</span>
          {!shownResult && (
            <span className="ld-trial-out-empty">
              주문을 걸면 여기에 나와요
            </span>
          )}
          {shownResult && shownResult.out !== '' && (
            <span ref={valRef} className="ld-trial-out-v font-sans">
              {shown(shownResult.out)}
            </span>
          )}
          {shownResult?.ok && !shownResult.printed && (
            <span className="ld-trial-out-empty">{NO_PRINT_HINT}</span>
          )}
          {shownResult && !shownResult.ok && (
            <span className="ld-trial-out-e">
              {shownResult.error.pyType && (
                <span className="ld-trial-err-name font-mono">
                  {shownResult.error.pyType}
                </span>
              )}
              {explain(shownResult.error)}
            </span>
          )}
        </div>
      </div>

      {buddy.who === 'bugbug' ? (
        <TrialBuddy
          who="bugbug"
          line={buddy.line}
          lineKey={talk}
          typing={talk > 0}
        />
      ) : (
        <TrialBuddy
          who="pybaem"
          state={buddy.state}
          line={buddy.line}
          lineKey={talk}
          typing={talk > 0}
          burst={burst}
          tone={
            said === 'result' && result?.ok && result.printed ? 'good' : 'tutor'
          }
        />
      )}

      {/* 첫 성공 뒤: 좁은 화면은 공책 바로 아래 로그인 카드 → 추천 주문 → 마스코트 순서 (trial.css 격자) */}
      {won && <TrialCta />}
      {won && !demo && (
        <div className="ld-trial-chips" data-testid="trial-chips">
          <span className="ld-trial-chips-k">다른 주문도 걸어 볼래?</span>
          {TRIAL_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              className="ld-trial-chip font-mono"
              onClick={() => tryChip(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* 데모가 끝날 때·주문을 걸 때 한 번만 읽힘 */}
      <p className="sr-only" aria-live="polite" data-testid="trial-announce">
        {announce}
      </p>
    </div>
  );
}
