'use client';

import type { CSSProperties } from 'react';
import {
  Check,
  CircleSlash,
  Hourglass,
  Keyboard,
  Loader2,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { keysLabel, type GuestRun } from '@/lib/quest/testGuests';
import { POP_LINES, transcriptRows } from './outputSlip';
import './testGuests.css';

/**
 * 시험 손님 대화 (P11-05, 제안 C): "시험 손님 부르기"를 누르면 손님마다 학생 코드를 자동으로 써 보고, 그 대화를 채팅처럼 보여 준다.
 * 프로그램이 한 말은 결과 쪽지와 같은 흰 줄 카드(코드 글꼴), 손님이 한 말은 오른쪽 해님 말풍선(내 말풍선은 초록, P11-01).
 * 손님마다 머리에 통과·달라요·오류를 글자 + 아이콘으로 (색만으로 알리지 않음). 등장 연출은 결과 쪽지 줄과 같은 연출 단계
 */
export function TestGuests({
  guests,
  running = false,
}: {
  guests: readonly GuestRun[];
  /** 손님이 아직 쓰는 중 (채점 전) */
  running?: boolean;
}) {
  const graded = guests.filter((g) => g.passed !== undefined);
  const passed = graded.filter((g) => g.passed).length;
  const summary = running
    ? `손님 ${guests.length}명이 차례로 써 보는 중이에요`
    : graded.length === guests.length
      ? `손님 ${guests.length}명 중 ${passed}명이 만족했어요`
      : guests.some((g) => g.state === 'error')
        ? '손님이 쓰다가 멈췄어요'
        : `손님 ${guests.length}명이 써 봤어요`;
  return (
    <section
      className="qg"
      data-testid="test-guests"
      aria-label="시험 손님"
      data-running={running || undefined}
    >
      <div className="qg-head">
        <span className="qg-title font-display">
          <UsersRound aria-hidden />
          시험 손님
        </span>
        <span className="qg-summary" role="status">
          {summary}
        </span>
      </div>
      <ol className="qg-list">
        {guests.map((g, i) => (
          <GuestCard key={i} guest={g} index={i} />
        ))}
      </ol>
    </section>
  );
}

function verdictOf(g: GuestRun) {
  if (g.state === 'running')
    return {
      tone: 'live',
      icon: (
        <Loader2 aria-hidden className="animate-spin reduced:animate-none" />
      ),
      text: '써 보는 중',
    };
  if (g.state === 'waiting')
    return {
      tone: 'idle',
      icon: <Hourglass aria-hidden />,
      text: '차례 기다림',
    };
  if (g.state === 'skipped')
    return {
      tone: 'idle',
      icon: <CircleSlash aria-hidden />,
      text: '못 써 봄',
    };
  if (g.state === 'error')
    return {
      tone: 'bug',
      icon: <Search aria-hidden />,
      text: g.errorType === 'EOFError' ? '입력이 더 필요해요' : '오류로 멈춤',
    };
  if (g.passed === true)
    return { tone: 'good', icon: <Check aria-hidden />, text: '통과' };
  if (g.passed === false)
    return { tone: 'diff', icon: <X aria-hidden />, text: '조금 달라요' };
  return { tone: 'idle', icon: <Check aria-hidden />, text: '다 써 봤어요' };
}

function GuestCard({ guest, index }: { guest: GuestRun; index: number }) {
  const v = verdictOf(guest);
  const rows = transcriptRows(guest.stdout, guest.inputs);
  const quiet = guest.state === 'waiting' || guest.state === 'skipped';
  return (
    <li
      className="qg-card qg-pop"
      data-tone={v.tone}
      data-state={guest.state}
      data-passed={
        guest.passed === undefined ? undefined : String(guest.passed)
      }
      data-testid="test-guest"
      style={{ '--i': index } as CSSProperties}
    >
      <div className="qg-card-head">
        <span className="qg-face font-display" aria-hidden>
          {guest.name.slice(0, 1)}
        </span>
        <h3 className="qg-name">{guest.name}</h3>
        <span className="qg-chip" data-tone={v.tone}>
          {v.icon}
          {v.text}
        </span>
      </div>
      {guest.keys.length > 0 && (
        <p className="qg-keys">
          <Keyboard aria-hidden />
          <span className="sr-only">손님이 누르는 키: </span>
          <span className="font-mono">{keysLabel(guest.keys)}</span>
        </p>
      )}
      {!quiet && rows.length > 0 && (
        <ol className="qg-lines">
          {rows.map((row, i) =>
            row.answer ? (
              <li
                key={i}
                className={cn('qg-answer', i < POP_LINES && 'qo-pop')}
                style={{ '--i': i } as CSSProperties}
                data-testid="guest-answer"
              >
                <span className="sr-only">{guest.name}의 대답: </span>
                <span className="qg-answer-bubble">{row.text || ' '}</span>
              </li>
            ) : (
              <li
                key={i}
                className={cn('qo-line font-mono', i < POP_LINES && 'qo-pop')}
                style={{ '--i': i } as CSSProperties}
              >
                {row.text || ' '}
              </li>
            ),
          )}
        </ol>
      )}
      {!quiet && guest.state !== 'running' && rows.length === 0 && (
        <p className="qo-empty">글자는 나오지 않았어요</p>
      )}
      {guest.errorType === 'EOFError' && (
        <p className="qg-note">
          손님이 준비한 대답을 다 썼는데 input()이 또 물었어요. 반복이 끝나는
          조건을 살펴봐요.
        </p>
      )}
    </li>
  );
}
