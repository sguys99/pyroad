'use client';

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import type { BugBugState, PybaemState } from '@/components/characters/rig';
import type {
  BugBugRigProps,
  PybaemRigProps,
} from '@/components/characters/rig/MascotRig';
import { SpeechBubble, type BubbleTone } from '@/components/ui/speech-bubble';
import { TRIAL_BUDDY_SIZE } from './buddyStill';

type Rigs = {
  Pybaem: ComponentType<PybaemRigProps>;
  BugBug: ComponentType<BugBugRigProps>;
};

const SIZE = TRIAL_BUDDY_SIZE;

/** 브라우저가 한가할 때 (없으면 잠깐 뒤) */
function whenIdle(fn: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 2000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 400);
  return () => window.clearTimeout(id);
}

export type TrialBuddyProps = {
  /** 바뀌면 말풍선을 새로 친다 (타자 효과 다시)·버그버그가 새로 등장한다 */
  lineKey: string | number;
  /** 말풍선 글자 */
  line: string;
  /** 타자 효과 (서버 첫 화면·동작 줄이기는 바로) */
  typing: boolean;
  /** 바뀔 때마다 반짝이가 터진다 (히어로 파이뱀과 같은 `.hero-burst`). 0이면 없음 */
  burst?: number;
  /** 마스코트·말풍선 아래 한 줄 전체 (체험 성공 뒤 로그인 카드) */
  children?: ReactNode;
  /**
   * 라이브 리그가 오기 전 파이뱀 정지 그림 (서버 컴포넌트 TrialSection이 그려 넘김, P4-12: 리그 코드를 첫 JS에 싣지 않음).
   * 서버 첫 화면의 표정(`encourage`) 그대로라 라이브가 오기 전 잠깐은 표정이 바뀌지 않는다
   */
  still: ReactNode;
} & (
  | { who: 'pybaem'; state: PybaemState; tone?: BubbleTone }
  | { who: 'bugbug'; tone?: BubbleTone }
);

/**
 * 공책 옆 마스코트 + 말풍선 (P4-02·P4-03). 평소는 파이뱀, 주문에 버그가 있으면 버그버그가 등장(appear → found)해 알려 준다.
 * 첫 페인트는 서버가 그린 정지 그림(`still`), 한가할 때(또는 버그버그가 처음 나올 때) 라이브 리그로 바꾼다
 * (히어로와 같은 모듈이라 추가로 받을 것이 거의 없다). 버그버그는 정지 그림 없이 리그가 오면 등장한다(첫 주문 뒤라 거의 늘 와 있음).
 * 동작 줄이기는 리그가 위치·크기 변화 0(표정만), 반짝이는 `hero.css`가 minimal·동작 줄이기에서 그리지 않는다.
 *
 * 말풍선은 aria-live가 아니다: 데모 중 말이 바뀔 때마다 읽히지 않게, 알림은 공책이 한 번만 한다.
 */
export function TrialBuddy(props: TrialBuddyProps) {
  const { line, lineKey, typing, burst = 0, children, who, still } = props;
  const [rigs, setRigs] = useState<Rigs | null>(null);
  const [bug, setBug] = useState<BugBugState>('appear');
  const loading = useRef(false);

  const loadRigs = () => {
    if (loading.current) return;
    loading.current = true;
    void import('@/components/characters/rig/MascotRig').then(
      (m) => setRigs({ Pybaem: m.PybaemRig, BugBug: m.BugBugRig }),
      () => {
        loading.current = false;
      },
    );
  };

  useEffect(() => whenIdle(loadRigs), []);
  // 리그가 오기 전에 버그버그가 필요하면 바로 받는다
  useEffect(() => {
    if (who === 'bugbug') loadRigs();
  }, [who]);
  // 버그를 새로 찾을 때마다 다시 등장
  useEffect(() => setBug('appear'), [lineKey]);

  const common = {
    size: SIZE,
    framing: 'stage' as const,
    label: '',
    className: 'ld-trial-py-svg',
  };
  const tone = props.tone ?? (who === 'bugbug' ? 'bug' : 'tutor');

  let figure: ReactNode;
  if (who === 'bugbug') {
    figure = rigs ? (
      <rigs.BugBug
        key={lineKey}
        {...common}
        state={bug}
        pokeable={false}
        onAutoState={() => setBug('found')}
      />
    ) : null;
  } else {
    figure = rigs ? (
      <rigs.Pybaem {...common} state={props.state} pokeable={false} />
    ) : (
      still
    );
  }

  return (
    <div className="ld-trial-buddy" data-testid="trial-buddy" data-who={who}>
      <div className="ld-trial-py" aria-hidden>
        {figure}
        {burst > 0 && (
          <span key={burst} className="hero-burst ld-trial-burst">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
      <div className="ld-trial-say">
        <SpeechBubble
          key={lineKey}
          speaker={who === 'bugbug' ? '버그버그' : '파이뱀'}
          text={line}
          typing={typing}
          tone={tone}
          tail="left"
          className="ld-trial-bubble"
          data-testid="trial-bubble"
        />
      </div>
      {children}
    </div>
  );
}
