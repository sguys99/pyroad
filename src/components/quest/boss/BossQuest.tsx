'use client';

import { useEffect, useId, useRef } from 'react';
import { ArrowRight, Check, Crown, Lock, Swords, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import type { QuestSessionOptions } from '@/lib/quest/useQuestSession';
import { bossHp } from '@/lib/quest/boss';
import { useBossSession, type BossSession } from '@/lib/quest/useBossSession';
import type { QuizKind } from '@/lib/quest/questKind';
import { stageDots } from '@/lib/quest/stageProgress';
import { worldPath } from '@/lib/world/worldBook';
import { QuestHeader } from '../QuestHeader';
import { QuestStatusBar } from '../QuestStatusBar';
import { CelebrationLayer } from '../QuestWorkspace';
import { StoryHead } from '../StoryPage';
import { PRACTICE_NOTE } from '../quiz/QuizPanel';
import { QUIZ_INPUTS } from '../quiz/quizInputs';
import type { QuizInputDef } from '../quiz/types';
import { BossArena } from './BossArena';
import { BossLost, BossWon } from './BossResult';
import '../questWorkspace.css';
import '../outputPanel.css';
import '../quiz/quiz.css';
import './boss.css';

/** 버그버그 한마디 (무대 말풍선). 판 단계·마지막 채점 결과에 따라 */
export function bossLine(
  s: Pick<BossSession, 'phase' | 'verdict' | 'hearts' | 'boss'>,
): string {
  if (s.phase === 'intro') return s.boss.intro;
  if (s.phase === 'won') return s.boss.on_defeat;
  if (s.phase === 'lost') return s.boss.on_victory;
  if (!s.verdict) return '어디 한번 풀어 봐! 틀리면 내가 콕 찌른다?';
  if (s.verdict.correct) return '아야야! 제법인데? 다음 문제는 어림없지!';
  return s.hearts === 1
    ? '히히, 하트가 하나 남았네! 천천히 다시 골라 봐.'
    : '히히, 한 대 맞았지? 같은 문제, 다시 골라 봐!';
}

/** 화면 낭독기 알림 (채점마다 한 번): 소리·연출과 같은 정보를 글자로 */
export function bossAnnounce(
  s: Pick<BossSession, 'phase' | 'verdict' | 'hearts' | 'cleared' | 'total'>,
): string {
  if (!s.verdict) return '';
  const hp = `보스 HP ${s.total - s.cleared}/${s.total}`;
  const hearts = `하트 ${s.hearts}개 남음`;
  if (s.phase === 'won') return `보스를 물리쳤어요! ${hearts}.`;
  if (s.verdict.correct) return `정답! 공격 성공. ${hp}, ${hearts}.`;
  return s.hearts <= 0
    ? `아쉬워요. 하트를 모두 잃었어요. ${hp}.`
    : `아쉬워요. ${hearts}, ${hp}.`;
}

/**
 * 보스 배틀 렌더러 (P9-12, §2.5). 퀴즈와 같은 책 펼침: 헤더 · [무대 쪽(이야기 머리·BossArena) | 문제·결과 쪽] · 상태바 · 축하.
 * lg 미만은 두 쪽을 이어 한 번에 스크롤. 상태는 useBossSession 이 가지고, 문제 입력은 퀴즈 입력 컴포넌트(QUIZ_INPUTS)를 그대로 씀
 */
export function BossQuest(props: QuestSessionOptions) {
  const s = useBossSession(props);
  const { quest } = s;
  const worldHref = worldPath(quest.stage.world?.slug);
  const stageHref = `${worldHref}?stage=${quest.stage.id}`;
  const dots = stageDots(
    quest.stage.quests ?? [],
    quest.id,
    s.phase === 'won' || props.progress?.status === 'completed',
    quest.stage.unlocked,
  );
  // 스테이지 마지막 관문: 같은 스테이지 코드 퀘스트를 다 끝내야 열림 (서버 boss_locked 와 같은 규칙)
  const blocking = (quest.stage.quests ?? []).filter(
    (q) =>
      q.id !== quest.id &&
      q.quest_type !== 'quiz' &&
      q.quest_type !== 'boss' &&
      !q.completed,
  );
  const locked = blocking.length > 0;
  const reviewQuests = s.boss.review_quests ?? [];
  const reviewId = reviewQuests[s.round] ?? null;

  return (
    <div className="qw-root flex h-dvh flex-col bg-bg">
      <QuestHeader
        worldHref={worldHref}
        bgm={quest.stage.world?.bgm ?? null}
        stageTitle={quest.stage.title}
        stageOrder={quest.stage.order}
        questTitle={quest.title}
        dots={dots}
      />
      <div className="qw-book qz-book bb-book" data-phase={s.phase}>
        <div className="qw-page qw-page-l">
          <article className="qs" aria-labelledby="quest-title">
            <StoryHead quest={quest} />
          </article>
          <BossArena
            phase={s.phase}
            bossName={s.boss.name}
            hp={bossHp({ round: s.cleared, total: s.total })}
            total={s.total}
            hearts={s.hearts}
            fx={s.fx}
            say={
              <SpeechBubble
                speaker={s.boss.name}
                tone="bug"
                tail="none"
                text={bossLine(s)}
                data-testid="boss-line"
              />
            }
          />
        </div>
        <div className="qw-page qw-page-r">
          {s.phase === 'intro' ? (
            <BossIntro
              session={s}
              locked={locked}
              firstBlocking={blocking[0]?.id ?? null}
            />
          ) : s.phase === 'won' ? (
            <BossWon session={s} mapHref={worldHref} stageId={quest.stage.id} />
          ) : s.phase === 'lost' ? (
            <BossLost
              session={s}
              reviewHref={reviewId ? `/quest/${reviewId}` : stageHref}
            />
          ) : (
            <BossQuestion session={s} />
          )}
          <p className="sr-only" aria-live="polite" data-testid="boss-announce">
            {bossAnnounce(s)}
          </p>
        </div>
      </div>
      <QuestStatusBar xp={s.userXP} level={s.userLevel} earnedXP={s.earnedXP} />
      <CelebrationLayer session={s} worldHref={worldHref} />
    </div>
  );
}

/** 등장 쪽: 규칙 세 줄 + 도전! (잠겼으면 남은 퀘스트로) */
export function BossIntro({
  session: s,
  locked,
  firstBlocking,
}: {
  session: BossSession;
  locked: boolean;
  firstBlocking: string | null;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <section className="qz bb-intro" aria-labelledby="boss-intro-t">
      <div className="qz-card" data-testid="boss-intro">
        <div className="qz-head">
          <span className="qz-k">
            <Crown aria-hidden />
            스테이지 보스
          </span>
          <ModeChip mode={s.mode} />
        </div>
        <h2
          id="boss-intro-t"
          ref={heading}
          tabIndex={-1}
          className="qz-q font-display"
        >
          {s.boss.name} 등장!
        </h2>
        <ul className="bb-rules">
          <li>
            <Swords aria-hidden />
            문제 {s.total}개를 모두 맞히면 보스를 물리쳐요.
          </li>
          <li>
            <span className="bb-rules-heart" aria-hidden />
            틀리면 하트가 하나 줄어요. 하트는 3개예요.
          </li>
          <li>
            <Check aria-hidden />
            남은 하트 수만큼 별을 받아요. 져도 바로 다시 도전할 수 있어요!
          </li>
        </ul>
        {s.mode !== 'first' && (
          <p className="qz-notice" data-testid="boss-mode-note">
            {s.mode === 'practice'
              ? `오늘은 연습 판이에요. ${PRACTICE_NOTE}.`
              : `복습 도전! 오늘 하트를 더 많이 남기면 별을 더 모을 수 있어요${s.bestStars ? ` (지금 별 ${s.bestStars}개)` : ''}.`}
          </p>
        )}
      </div>
      <div className="qz-actions">
        {s.error && (
          <p className="qz-error" role="alert">
            {s.error}
          </p>
        )}
        {locked ? (
          <>
            <p className="qz-notice" data-testid="boss-locked">
              <Lock aria-hidden className="mr-1 inline size-4" />이 스테이지
              퀘스트를 모두 깨면 보스와 싸울 수 있어요.
            </p>
            {firstBlocking && (
              <Button
                size="lg"
                href={`/quest/${firstBlocking}`}
                iconRight={<ArrowRight aria-hidden />}
              >
                남은 퀘스트 하러 가기
              </Button>
            )}
          </>
        ) : (
          <Button
            size="lg"
            onClick={s.start}
            loading={s.isSubmitting}
            icon={<Swords aria-hidden />}
            sfx={false}
            data-testid="boss-start"
          >
            도전!
          </Button>
        )}
      </div>
    </section>
  );
}

function ModeChip({ mode }: { mode: BossSession['mode'] }) {
  if (mode === 'review')
    return (
      <span className="qz-chip" data-tone="review">
        복습 도전
      </span>
    );
  if (mode === 'practice')
    return (
      <span className="qz-chip" data-tone="practice">
        연습
      </span>
    );
  return null;
}

/** 문제 쪽: 문제 카드(퀴즈 입력 그대로) → 채점 쪽지 → 공격! / 다음 문제 */
export function BossQuestion({ session: s }: { session: BossSession }) {
  const qid = useId();
  const quiz = s.quiz;
  const def = quiz
    ? (QUIZ_INPUTS[quiz.kind] as QuizInputDef<QuizKind> | undefined)
    : undefined;
  const verdict = s.verdict?.round === s.round ? s.verdict : null;
  const solved = !!verdict?.correct;
  const last = s.round + 1 >= s.total;
  const canSubmit =
    !!def &&
    !solved &&
    s.phase === 'battle' &&
    def.isComplete(s.value as never, quiz as never);

  // 새 문제 → 문제 제목으로, 채점 → 쪽지로 초점 (퀴즈와 같은 규칙, P7-13)
  const heading = useRef<HTMLHeadingElement>(null);
  const slip = useRef<HTMLDivElement>(null);
  const seen = useRef({ round: s.round, verdict: s.verdict });
  useEffect(() => {
    const prev = seen.current;
    seen.current = { round: s.round, verdict: s.verdict };
    if (prev.round !== s.round) heading.current?.focus({ preventScroll: true });
    else if (s.verdict && prev.verdict !== s.verdict) {
      slip.current?.scrollIntoView?.({ block: 'nearest' });
      slip.current?.focus({ preventScroll: true });
    }
  }, [s.round, s.verdict]);

  if (!quiz) return null;
  return (
    <div
      className="qz bb-q"
      data-status={verdict ? (solved ? 'correct' : 'wrong') : 'answering'}
    >
      <section
        className="qz-card"
        aria-labelledby={qid}
        data-testid="boss-card"
      >
        <div className="qz-head">
          <span className="qz-k bb-round" data-testid="boss-round">
            <Swords aria-hidden />
            문제 {s.round + 1} / {s.total}
            {def ? ` · ${def.label}` : ''}
          </span>
          <ModeChip mode={s.mode} />
        </div>
        <h2 id={qid} className="qz-q" ref={heading} tabIndex={-1}>
          {quiz.question}
        </h2>
        {def && (
          <div className="qz-input">
            <def.Input
              quiz={quiz as never}
              value={s.value as never}
              onChange={s.setValue as never}
              disabled={solved || s.isSubmitting}
              result={
                solved && verdict
                  ? ({
                      status: 'correct',
                      submitted: verdict.submitted,
                      answer: null,
                    } as never)
                  : null
              }
              misses={s.misses as never}
              labelledBy={qid}
            />
          </div>
        )}
      </section>

      <div className="qz-live">
        {verdict && (
          <div
            ref={slip}
            className="qo-slip qz-verdict"
            tabIndex={-1}
            data-tone={solved ? 'good' : 'diff'}
            data-testid="boss-verdict"
            data-status={solved ? 'correct' : 'wrong'}
          >
            <div className="qo-head">
              <span className="qo-k">
                {solved ? '공격 성공' : '앗, 맞았다!'}
              </span>
              <span className="qo-chip" data-tone={solved ? 'good' : 'diff'}>
                {solved ? (
                  <>
                    <Check aria-hidden /> 정답이에요!
                  </>
                ) : (
                  <>
                    <X aria-hidden /> 하트 −1
                  </>
                )}
              </span>
            </div>
            {!solved && (
              <p className="qz-verdict-t">
                {s.hearts > 0
                  ? `괜찮아요! 하트가 ${s.hearts}개 남았어요. 같은 문제를 다시 골라 봐요.`
                  : '하트를 모두 썼어요.'}
              </p>
            )}
            {verdict.explanation && (
              <p className="qo-note">{verdict.explanation}</p>
            )}
          </div>
        )}
      </div>

      <div className="qz-actions" data-graded={verdict ? true : undefined}>
        {s.error && (
          <p className="qz-error" role="alert">
            {s.error}
          </p>
        )}
        {s.stale ? (
          <Button size="lg" onClick={s.start} loading={s.isSubmitting}>
            처음부터 다시 도전
          </Button>
        ) : solved ? (
          !last && (
            <Button
              size="lg"
              onClick={s.next}
              iconRight={<ArrowRight aria-hidden />}
              data-testid="boss-next"
            >
              다음 문제
            </Button>
          )
        ) : (
          <Button
            size="lg"
            onClick={s.submit}
            disabled={!canSubmit}
            loading={s.isSubmitting}
            icon={<Swords aria-hidden />}
            sfx={false}
            data-testid="boss-submit"
          >
            {canSubmit || s.isSubmitting ? '공격!' : '답을 골라요'}
          </Button>
        )}
      </div>
    </div>
  );
}
