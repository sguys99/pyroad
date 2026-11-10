'use client';

import Link from 'next/link';
import { worldPath } from '@/lib/world/worldBook';
import {
  useQuestSession,
  type QuestSessionOptions,
} from '@/lib/quest/useQuestSession';
import { PhoneQuizNote } from './PhoneQuizNote';
import { QuestWorkspace } from './QuestWorkspace';

/** 코드 퀘스트 렌더러: 코드를 써서 한 번에 통과하는 기본 퀘스트 */
export function CodeQuest(props: QuestSessionOptions) {
  const session = useQuestSession(props);
  const { nextQuestId } = session;

  return (
    <>
      {/* 폰에서는 이 스테이지 퀴즈를 한 번 권함 (P7-11, 코드 퀘스트만 — 프로젝트는 단계가 이어져 끼어들지 않음) */}
      <PhoneQuizNote
        quests={session.quest.stage.quests ?? []}
        unlocked={session.quest.stage.unlocked}
      />
      <QuestWorkspace
        session={session}
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
            <Link
              href={worldPath(session.quest.stage.world?.slug)}
              className="underline"
            >
              월드맵으로 돌아가기
            </Link>
          </>
        }
      />
    </>
  );
}
