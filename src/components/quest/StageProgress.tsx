'use client';

import Link from 'next/link';
import { questNumbers, type StageDot } from '@/lib/quest/stageProgress';
import './stageProgress.css';

const STATE_TEXT = { done: '완료', todo: '아직', locked: '잠김' } as const;

/**
 * 스테이지 안 진행 점 (P6-02, 퀘스트 헤더). 퀘스트마다 점 하나: 끝냄(초록) · 아직(회색) · 잠김(옅은 회색),
 * 지금 퀘스트는 긴 알약(안 끝냈으면 금색, 끝냈으면 초록) + `aria-current="step"`. 열린 점은 그 퀘스트 링크.
 * 별(SHOW_STARS)은 여기 넣지 않는다 — 별 기록은 스테이지 시트가 보여 줌
 */
export function StageProgress({ dots }: { dots: StageDot[] }) {
  const here = dots.find((d) => d.current);
  if (!here || dots.length < 2) return null;
  // 숫자는 코드 퀘스트끼리·퀴즈끼리 (B53, 월드맵 노드·스테이지 시트와 같은 기준). 점은 순서 이동용이라 퀴즈도 그 자리에 다른 모양으로
  const nums = questNumbers(dots);
  const at = nums.get(here.id)!;
  const name = (d: StageDot) => {
    const x = nums.get(d.id)!;
    return x.quiz ? `보너스 퀴즈 ${x.n}` : `${x.n}번`;
  };
  return (
    <nav className="sp" aria-label="스테이지 진행" data-testid="stage-progress">
      <span className="sp-count font-display" data-quiz={at.quiz || undefined}>
        <span className="sp-count-k">{at.quiz ? '퀴즈' : '퀘스트'} </span>
        <b>{at.n}</b>
        <span className="sp-count-total">/{at.total}</span>
      </span>
      <ol className="sp-dots">
        {dots.map((d) => {
          const label = `${name(d)} ${d.title} (${d.current ? '지금 퀘스트, ' : ''}${STATE_TEXT[d.state]})`;
          const kind = nums.get(d.id)!.quiz ? 'quiz' : undefined;
          const mark = <span className="sp-mark" aria-hidden />;
          return (
            <li key={d.id}>
              {d.state === 'locked' ? (
                <span
                  className="sp-dot"
                  data-state={d.state}
                  data-kind={kind}
                  role="img"
                  aria-label={label}
                >
                  {mark}
                </span>
              ) : (
                <Link
                  href={`/quest/${d.id}`}
                  className="sp-dot"
                  data-state={d.state}
                  data-kind={kind}
                  data-current={d.current || undefined}
                  aria-current={d.current ? 'step' : undefined}
                  aria-label={label}
                  title={`${name(d)} ${d.title}`}
                >
                  {mark}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
