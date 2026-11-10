import { CalendarDays, Check, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { isDailyQuizDone, type DailyQuizState } from '@/lib/quest/dailyQuiz';

import './dailyQuizCard.css';

/**
 * 월드맵 맨 위 "오늘의 퀴즈" 쪽지 (P7-10): 남은 문제 수 · 진행 칸 · 복습 n개 포함 → `/daily`. 다 풀면 완료 도장 + "결과 보기".
 * 이어하기(지도 머리, 주 버튼)보다 위에 있지만 보조 버튼이라 무게가 낮고, 폰 퀴즈 추천(P7-11 점선 쪽지)은 지도 머리 아래라 겹치지 않음
 */
export function DailyQuizCard({
  daily,
}: {
  daily: Pick<DailyQuizState, 'picks' | 'results'>;
}) {
  const total = daily.picks.length;
  const done = daily.picks.filter((p) => p.questId in daily.results).length;
  const review = daily.picks.filter((p) => p.review).length;
  const finished = isDailyQuizDone(daily);
  const state = total === 0 ? 'empty' : finished ? 'done' : 'todo';
  return (
    <section
      className="dqc"
      data-state={state}
      aria-labelledby="daily-card-title"
      data-testid="daily-card"
    >
      <span className="dqc-badge" aria-hidden>
        {finished ? (
          <Check className="size-5" strokeWidth={3} />
        ) : (
          <CalendarDays className="size-5" strokeWidth={2.4} />
        )}
      </span>
      <span className="dqc-main">
        <span className="dqc-k font-sans">오늘의 퀴즈</span>
        <span id="daily-card-title" className="dqc-t">
          {state === 'empty'
            ? '첫 스테이지를 지나면 열려요'
            : finished
              ? '오늘 퀴즈 완료! 내일 또 만나요'
              : `${total - done}문제 남았어요`}
        </span>
        {total > 0 && (
          <span className="dqc-meta font-sans">
            <span className="dqc-cells" aria-hidden>
              {daily.picks.map((p) => (
                <span
                  key={p.questId}
                  className="dqc-cell"
                  data-on={p.questId in daily.results || undefined}
                />
              ))}
            </span>
            <span aria-hidden>
              {done}/{total}
            </span>
            <span className="sr-only">
              {total}문제 중 {done}문제 풀었어요
            </span>
            {review > 0 && (
              <span className="dqc-review">
                <RotateCcw aria-hidden className="size-3.5" strokeWidth={2.6} />
                복습 {review}개 포함
              </span>
            )}
          </span>
        )}
      </span>
      {total > 0 && (
        <Button
          variant="secondary"
          size="sm"
          href="/daily"
          className="dqc-go"
          data-testid="daily-card-go"
        >
          {finished ? '결과 보기' : done > 0 ? '이어 풀기' : '풀러 가기'}
        </Button>
      )}
    </section>
  );
}
