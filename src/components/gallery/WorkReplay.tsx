'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FastForward,
  Gauge,
  Loader2,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { TurtleCanvas } from '@/lib/turtle/TurtleCanvas';
import { describeDrawing } from '@/lib/turtle/describe';
import type { TurtleCommand } from '@/lib/turtle/scene';
import type { TranscriptRow } from '@/components/quest/outputSlip';
import '@/components/quest/outputPanel.css';
import './gallery.css';

/** 갤러리 다시 그리기 빠르기 (1 = CPython 과 비슷) */
const SPEEDS = [1, 2, 4] as const;

/** 저장된 turtle 명령 받기: gzip 을 브라우저가 푼다 (남의 코드는 실행하지 않음, Q74 ①) */
export async function loadCommands(id: string): Promise<TurtleCommand[]> {
  const res = await fetch(`/api/gallery/${id}/commands`);
  if (!res.ok || !res.body) throw new Error(`commands ${res.status}`);
  const json = await new Response(
    res.body.pipeThrough(new DecompressionStream('gzip')),
  ).json();
  if (!Array.isArray(json)) throw new Error('commands shape');
  return json as TurtleCommand[];
}

function useCalm() {
  const { budget, reduced, tier } = useMotionTier();
  return reduced || budget.effectDuration === 0 || tier === 'minimal';
}

/**
 * 그림 작품 다시 보기 (P11-07): 저장된 명령 스트림을 TurtleCanvas 로 처음부터 다시 그린다. Pyodide 를 띄우지 않아 바로 시작.
 * 받는 동안은 썸네일을 걸어 두고, 동작 줄이기·minimal 은 바로 완성. 낭독기에는 그림 요약 한 문장(describeDrawing)
 */
export function DrawingReplay({
  id,
  title,
  poster,
  load = loadCommands,
}: {
  id: string;
  title: string;
  poster: string | null;
  load?: (id: string) => Promise<TurtleCommand[]>;
}) {
  const calm = useCalm();
  const hostRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<TurtleCanvas | null>(null);
  const [commands, setCommands] = useState<TurtleCommand[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    let alive = true;
    setFailed(false);
    load(id)
      .then((c) => alive && setCommands(c))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id, load, attempt]);

  const play = useCallback(
    (instant = false) => {
      const cv = cvRef.current;
      if (!cv || !commands) return;
      cv.reset();
      cv.setSpeedMultiplier(SPEEDS[speedRef.current]);
      cv.push(commands);
      cv.end();
      if (instant) cv.skipToEnd();
      setStarted(true);
    },
    [commands],
  );

  // 캔버스는 보일 때 만들고, 명령이 오면 한 번 그린다
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !commands) return;
    let cv: TurtleCanvas | null = null;
    const offs: (() => void)[] = [];
    const make = () => {
      if (cv || host.clientWidth === 0) return;
      cv = new TurtleCanvas(host, { walk: !calm });
      cvRef.current = cv;
      offs.push(
        cv.on('busy', () => setBusy(true)),
        cv.on('idle', () => setBusy(false)),
      );
      play(calm);
    };
    const ro = new ResizeObserver(make);
    ro.observe(host);
    make();
    return () => {
      ro.disconnect();
      offs.forEach((off) => off());
      cv?.destroy();
      cvRef.current = null;
    };
    // calm 은 처음 만들 때만 (바뀌면 아래 효과가 반영)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commands, play]);

  useEffect(() => {
    cvRef.current?.setWalk(!calm);
  }, [calm]);
  useEffect(() => {
    cvRef.current?.setSpeedMultiplier(SPEEDS[speed]);
  }, [speed]);

  const summary = commands ? describeDrawing(commands) : '';
  return (
    <div className="gl-exhibit" data-testid="gallery-drawing">
      <div className="gl-easel">
        <div className="gl-easel-mat">
          <div className="gl-canvas">
            <div
              ref={hostRef}
              className="gl-canvas-host"
              role="img"
              aria-label={
                commands
                  ? `${title}: ${summary}`
                  : `${title} 그림을 불러오는 중`
              }
              data-testid="gallery-canvas"
              data-summary={summary}
              data-state={!commands ? 'loading' : busy ? 'drawing' : 'done'}
            />
            {!started && poster && (
              // 그림을 받는 동안 걸어 두는 썸네일 (동적 PNG 라 next/image 를 거치지 않음)
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt="" aria-hidden />
            )}
            {!commands && (
              <p className="gl-canvas-note" role="status">
                {failed ? (
                  <>
                    <TriangleAlert aria-hidden />
                    그림을 불러오지 못했어요
                  </>
                ) : (
                  <>
                    <Loader2
                      aria-hidden
                      className="animate-spin reduced:animate-none"
                    />
                    느릿이가 붓을 드는 중…
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="gl-tools">
        {failed ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<RotateCcw aria-hidden />}
            onClick={() => setAttempt((n) => n + 1)}
          >
            다시 불러오기
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCcw aria-hidden />}
              disabled={!commands}
              onClick={() => play(false)}
              data-testid="gallery-replay"
            >
              다시 그리기
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<FastForward aria-hidden />}
              disabled={!busy}
              onClick={() => cvRef.current?.skipToEnd()}
              data-testid="gallery-finish"
            >
              바로 완성
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Gauge aria-hidden />}
              onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
              aria-label={`빠르기 ${SPEEDS[speed]}배, 눌러서 바꾸기`}
            >
              {SPEEDS[speed]}배
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 대화 작품 다시 보기 (Q74 ④): 작가가 실행한 기록을 채팅처럼 한 줄씩. 프로그램 말은 왼쪽 쪽지, 작가의 대답은 오른쪽 초록 말풍선
 * (결과 쪽지 `.qo-line`·`.qo-answer`와 같은 모양). 모든 줄은 처음부터 문서에 있어 낭독기는 전체를 읽고, 화면만 차례로 보여 준다
 */
export function ConversationReplay({ rows }: { rows: TranscriptRow[] }) {
  const calm = useCalm();
  const [shown, setShown] = useState(calm ? rows.length : 0);
  const listRef = useRef<HTMLOListElement>(null);
  const done = shown >= rows.length;

  useEffect(() => {
    if (calm) setShown(rows.length);
  }, [calm, rows.length]);

  useEffect(() => {
    if (done) return;
    const next = rows[shown];
    const t = setTimeout(
      () => setShown((n) => n + 1),
      shown === 0 ? 300 : next?.answer ? 1000 : 550,
    );
    return () => clearTimeout(t);
  }, [shown, done, rows]);

  useEffect(() => {
    const el = listRef.current;
    const last = el?.children[Math.max(0, shown - 1)] as
      | HTMLElement
      | undefined;
    if (el && last && !calm)
      el.scrollTop = Math.max(
        0,
        last.offsetTop - el.clientHeight + last.offsetHeight + 48,
      );
  }, [shown, calm]);

  return (
    <div className="gl-exhibit" data-testid="gallery-conversation">
      <div className="gl-easel">
        <div className="gl-easel-mat">
          <ol
            ref={listRef}
            className="gl-chat"
            aria-label="작가가 실행한 대화"
            data-state={done ? 'done' : 'playing'}
          >
            {rows.map((row, i) =>
              row.answer ? (
                <li
                  key={i}
                  className="qo-answer"
                  data-pending={i >= shown || undefined}
                >
                  <span className="sr-only">작가의 대답: </span>
                  <span className="qo-answer-bubble">{row.text || ' '}</span>
                </li>
              ) : (
                <li
                  key={i}
                  className="qo-line font-mono"
                  data-pending={i >= shown || undefined}
                >
                  {row.text || ' '}
                </li>
              ),
            )}
            {!done && rows[shown]?.answer && (
              <li className="gl-typing" aria-hidden>
                <i />
                <i />
                <i />
              </li>
            )}
          </ol>
        </div>
      </div>
      <div className="gl-tools">
        <Button
          size="sm"
          variant="secondary"
          icon={<RotateCcw aria-hidden />}
          onClick={() => setShown(calm ? rows.length : 0)}
          data-testid="gallery-replay"
        >
          처음부터 보기
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<FastForward aria-hidden />}
          disabled={done}
          onClick={() => setShown(rows.length)}
        >
          한 번에 보기
        </Button>
      </div>
    </div>
  );
}
