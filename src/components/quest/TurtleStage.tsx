'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Download,
  FastForward,
  Grid3x3,
  Loader2,
  Palette,
  Rabbit,
  Snail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import type { LiveOutputStore } from '@/lib/pyodide/liveOutput';
import { TurtleCanvas } from '@/lib/turtle/TurtleCanvas';
import { describeDrawing } from '@/lib/turtle/describe';
import type { TurtleCommand } from '@/lib/turtle/scene';
import './turtleStage.css';

/** 빠르기 칸: 1 = CPython과 비슷, Infinity = 바로 (P0-06) */
export const TURTLE_SPEEDS = [0.25, 0.5, 1, 2, 4, 8, Infinity] as const;
const NORMAL = TURTLE_SPEEDS.indexOf(1);
const INSTANT = TURTLE_SPEEDS.length - 1;

export const speedLabel = (m: number) => (m === Infinity ? '바로' : `${m}배`);

const NO_COMMANDS: readonly TurtleCommand[] = [];
const noop = () => () => {};

/** 저장 파일 이름: title("…")이 있으면 그 이름, 파일 이름에 못 쓰는 글자는 뺀다 */
function fileName(title: string | null) {
  const name = (title ?? '').replace(/[\\/:*?"<>|\n\r\t]/g, '').trim();
  return `${name.slice(0, 40) || '거북이 그림'}.png`;
}

export interface TurtleStageProps {
  /** 실행 중 출력 저장소 (turtle 명령이 여기로 온다) */
  store?: LiveOutputStore;
  /** Python이 아직 실행 중 (끝나면 renderer에 더 올 명령이 없다고 알림) */
  running: boolean;
}

/**
 * 그림판 (P11-02): turtle 명령을 `TurtleCanvas`로 그리는 종이 + 빠르기·바로 완성·모눈·저장.
 * 결과 쪽지와 같은 옅은 면 위에 흰 도화지 한 장. 동작 줄이기·minimal 단계는 처음부터 "바로" 그리고 다리를 흔들지 않는다
 * (빠르기는 아이가 바꿀 수 있음). 캔버스는 보일 때만 만든다(데스크톱·모바일 결과 자리가 둘 다 붙어 있어 숨은 쪽은 그리지 않음).
 * 낭독기에는 그림 요약 한 문장(describeDrawing)을 읽어 준다
 */
export function TurtleStage({ store, running }: TurtleStageProps) {
  const { budget, reduced, tier } = useMotionTier();
  const calm = reduced || budget.effectDuration === 0 || tier === 'minimal';
  const [speed, setSpeed] = useState(calm ? INSTANT : NORMAL);
  const [grid, setGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [summary, setSummary] = useState('빈 그림판');
  const [saving, setSaving] = useState(false);
  const speedId = useId();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<TurtleCanvas | null>(null);
  const fed = useRef<{ list: readonly TurtleCommand[]; n: number }>({
    list: NO_COMMANDS,
    n: 0,
  });

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const runningRef = useRef(running);
  runningRef.current = running;

  // 빈 그림판 안내만 다시 그린다 (명령은 아래 구독이 React를 거치지 않고 캔버스로 바로 넘김)
  const count = useSyncExternalStore(
    store?.subscribeTurtle ?? noop,
    () => store?.getTurtle().length ?? 0,
    () => 0,
  );

  // 저장소 → 캔버스: 새 실행이면 비우고, 아직 안 넘긴 명령만 넘긴다
  const feed = useCallback(() => {
    const cv = canvasRef.current;
    const list = store?.getTurtle() ?? NO_COMMANDS;
    if (!cv) return;
    if (fed.current.list !== list) {
      cv.reset();
      fed.current = { list, n: 0 };
      setTitle(null);
    }
    if (list.length > fed.current.n) {
      cv.push(list.slice(fed.current.n));
      fed.current.n = list.length;
    }
    if (!runningRef.current) cv.end();
  }, [store]);

  // 캔버스는 처음 보일 때 만든다 (display:none 쪽은 폭이 0)
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cv: TurtleCanvas | null = null;
    const offs: (() => void)[] = [];
    const make = () => {
      if (cv || host.clientWidth === 0) return;
      cv = new TurtleCanvas(host, { walk: !calm });
      canvasRef.current = cv;
      offs.push(
        cv.on('busy', () => setBusy(true)),
        cv.on('idle', () => {
          setBusy(false);
          setSummary(describeDrawing(fed.current.list));
        }),
        cv.on('title', setTitle),
      );
      cv.setSpeedMultiplier(TURTLE_SPEEDS[speedRef.current]);
      cv.setGrid(gridRef.current);
      fed.current = { list: NO_COMMANDS, n: 0 };
      feed();
      // 실행이 이미 끝난 뒤 처음 보이면(모바일 쪽 넘김) 기다리지 않고 완성
      if (!runningRef.current) {
        cv.end();
        cv.skipToEnd();
      }
    };
    const ro = new ResizeObserver(make);
    ro.observe(host);
    make();
    return () => {
      ro.disconnect();
      offs.forEach((off) => off());
      cv?.destroy();
      canvasRef.current = null;
    };
    // calm·feed는 처음 만들 때만 (바뀌면 아래 효과가 반영)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => store?.subscribeTurtle(feed), [store, feed]);
  useEffect(() => {
    if (!running) canvasRef.current?.end();
  }, [running]);
  useEffect(() => {
    canvasRef.current?.setSpeedMultiplier(TURTLE_SPEEDS[speed]);
  }, [speed]);
  useEffect(() => {
    canvasRef.current?.setGrid(grid);
  }, [grid]);
  useEffect(() => {
    canvasRef.current?.setWalk(!calm);
  }, [calm]);

  const save = async () => {
    const cv = canvasRef.current;
    if (!cv || saving) return;
    setSaving(true);
    try {
      const a = cv.viewAspect();
      const side = 1200;
      const blob = await cv.exportPNG({
        width: a >= 1 ? side : Math.round(side * a),
        height: a >= 1 ? Math.round(side / a) : side,
        fit: 'view',
        padding: 0,
        grid,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName(cv.title);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setSaving(false);
    }
  };

  const empty = count === 0;
  const live = running || busy;
  return (
    <section
      className="ts"
      aria-label="그림판"
      data-testid="turtle-stage"
      data-state={empty ? 'empty' : live ? 'drawing' : 'done'}
    >
      <div className="ts-head">
        <span className="ts-k">
          <Palette aria-hidden />
          그림판
        </span>
        {title && (
          <span className="ts-title font-display" data-testid="turtle-title">
            {title}
          </span>
        )}
        {!empty && live && (
          <span className="ts-chip" role="status">
            <Loader2
              aria-hidden
              className="animate-spin reduced:animate-none"
            />
            그리는 중
          </span>
        )}
      </div>

      <div className="ts-paper">
        <div
          ref={hostRef}
          className="ts-canvas"
          role="img"
          aria-label={empty ? '빈 그림판' : summary}
          data-testid="turtle-canvas"
          data-summary={summary}
        />
        {empty && (
          <p className="ts-empty" aria-hidden>
            {running
              ? '느릿이가 붓을 드는 중…'
              : '코드를 돌리면 거북이 느릿이가 여기에 그림을 그려요'}
          </p>
        )}
      </div>

      <div className="ts-tools">
        <div className="ts-speed">
          <label htmlFor={speedId} className="ts-speed-k">
            빠르기
          </label>
          <Snail aria-hidden className="ts-speed-i" />
          <input
            id={speedId}
            type="range"
            min={0}
            max={INSTANT}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-valuetext={speedLabel(TURTLE_SPEEDS[speed])}
            className="ts-range"
            data-testid="turtle-speed"
          />
          <Rabbit aria-hidden className="ts-speed-i" />
          <output htmlFor={speedId} className="ts-speed-v" aria-hidden>
            {speedLabel(TURTLE_SPEEDS[speed])}
          </output>
        </div>
        <div className="ts-buttons">
          <Button
            variant="secondary"
            size="sm"
            icon={<FastForward aria-hidden />}
            disabled={!busy}
            onClick={() => canvasRef.current?.skipToEnd()}
            aria-label="바로 완성"
            data-testid="turtle-finish"
          >
            <span className="ts-btn-label">바로 완성</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Grid3x3 aria-hidden />}
            aria-pressed={grid}
            onClick={() => setGrid((g) => !g)}
            aria-label="모눈 보기"
            className="ts-toggle"
            data-testid="turtle-grid"
          >
            <span className="ts-btn-label">모눈</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download aria-hidden />}
            loading={saving}
            disabled={empty || busy}
            onClick={save}
            aria-label="그림 저장하기"
            data-testid="turtle-save"
          >
            <span className="ts-btn-label">저장</span>
          </Button>
        </div>
      </div>
    </section>
  );
}

export default TurtleStage;
