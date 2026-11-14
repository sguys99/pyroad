import { CalendarClock, ClipboardCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { withObjectParticle } from '@/lib/korean';
import {
  SKILL_CHECK_QUESTIONS,
  skillCheckPassScore,
  skillCheckPath,
} from '@/lib/world/skillCheck';

/**
 * 잠긴 월드의 "실력 확인 퀴즈" 진입점 (P10-03, docs/curriculum/world2.md §7): 앞 월드를 이미 아는 학생이 바로 여는 길.
 * 책장·다음 권 미리 보기(compact)와 잠긴 책 안내(LockedBook)에 붙는 시험지 쪽지. 오늘 이미 냈으면 "내일 다시" + 오늘 결과 보기.
 * 상태는 글자·아이콘으로도 보여 준다(색만으로 구분하지 않음)
 */
export function SkillCheckOffer({
  slug,
  prevTitle,
  triedToday,
  compact = false,
}: {
  slug: string;
  /** 해제 조건의 앞 월드 이름 (예: 파이썬 섬) */
  prevTitle: string;
  triedToday: boolean;
  /** 책장 카드 안: 설명 한 줄 + 작은 버튼 */
  compact?: boolean;
}) {
  const href = skillCheckPath(slug);
  const pass = skillCheckPassScore(SKILL_CHECK_QUESTIONS);
  return (
    <div
      className="wb-skill"
      data-compact={compact || undefined}
      data-tried={triedToday || undefined}
      data-testid="skill-check-offer"
    >
      <span className="wb-skill-k">
        {triedToday ? (
          <CalendarClock className="size-4" aria-hidden />
        ) : (
          <ClipboardCheck className="size-4" aria-hidden />
        )}
        실력 확인 퀴즈
      </span>
      <p className="wb-skill-t">
        {triedToday
          ? '오늘은 이미 도전했어요. 내일 다시 도전할 수 있어요!'
          : `${withObjectParticle(prevTitle)} 이미 잘 안다면? ${SKILL_CHECK_QUESTIONS}문제 중 ${pass}문제를 맞히면 바로 열려요.`}
      </p>
      {triedToday ? (
        <Button
          href={href}
          size="sm"
          variant="ghost"
          data-testid="skill-check-result-link"
        >
          오늘 결과 보기
        </Button>
      ) : (
        <Button
          href={href}
          size={compact ? 'sm' : 'md'}
          variant={compact ? 'secondary' : 'primary'}
          icon={<ClipboardCheck aria-hidden />}
          data-testid="skill-check-start-link"
        >
          실력 확인 퀴즈
        </Button>
      )}
    </div>
  );
}
