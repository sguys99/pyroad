'use client';

import Link from 'next/link';
import {
  useQuestSession,
  type QuestSessionOptions,
} from '@/lib/quest/useQuestSession';
import { QuestWorkspace } from './QuestWorkspace';

/** 코드 퀘스트 렌더러: 코드를 써서 한 번에 통과하는 기본 퀘스트 */
export function CodeQuest(props: QuestSessionOptions) {
  const session = useQuestSession(props);
  const { nextQuestId } = session;

  return (
    <QuestWorkspace
      session={session}
      nextQuestId={nextQuestId}
      completedBanner={
        <>
          이미 완료한 퀘스트예요!{' '}
          {nextQuestId && (
            <>
              <Link href={`/quest/${nextQuestId}`} className="underline">
                다음 퀘스트로
              </Link>
              {' · '}
            </>
          )}
          <Link href="/world" className="underline">
            월드맵으로 돌아가기
          </Link>
        </>
      }
    />
  );
}
