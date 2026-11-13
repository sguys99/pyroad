'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import { BossArena } from '@/components/quest/boss/BossArena';
import {
  BossIntro,
  BossQuestion,
  bossLine,
} from '@/components/quest/boss/BossQuest';
import { BossLost, BossWon } from '@/components/quest/boss/BossResult';
import { useSfx } from '@/components/providers/SoundProvider';
import { WRONG_GAIN } from '@/lib/quest/useQuizSession';
import { BOSS_HEARTS } from '@/lib/quest/boss';
import type { QuizPrompt } from '@/lib/quest/questKind';
import type {
  BossFx,
  BossPhase,
  BossSession,
} from '@/lib/quest/useBossSession';
import type { QuestCompleteResponse } from '@/lib/quest/rewards';
import '@/components/quest/quiz/quiz.css';
import '@/components/quest/outputPanel.css';
import '@/components/quest/questSuccess.css';
import '@/components/quest/boss/boss.css';
import { Demo, Section } from './ui';

const BOSS = {
  name: '출력 대장 버그버그',
  intro:
    '히히! 마을 안내판은 내가 접수했다! 내 문제를 다섯 개 다 풀면 돌려줄게!',
  on_defeat: '으앗, 졌다! 너 print() 진짜 잘하는구나. 다음 마을에서 또 보자!',
  on_victory:
    '이번엔 내가 이겼지롱! 그래도 거의 다 왔어. 조금 쉬었다가 다시 도전해!',
  rounds: [] as QuizPrompt[],
  review_quests: [] as (string | null)[],
};
const TOTAL = 5;

const QUIZ: QuizPrompt = {
  kind: 'multiple_choice',
  question: '이 코드를 돌리면 무엇이 나올까?',
  code: 'print("버그를")\nprint("잡자!")',
  options: [
    { id: 'opt-r4wk', text: '버그를\n잡자!' },
    { id: 'opt-c8nz', text: '버그를 잡자!' },
    { id: 'opt-y2hd', text: '"버그를"\n"잡자!"' },
  ],
};

const REWARD: QuestCompleteResponse = {
  already_completed: false,
  xp_gained: 40,
  total_xp: 640,
  level_before: 3,
  level_after: 3,
  stage_cleared: null,
  next_quest_id: null,
  golden_keys: 3,
  hints_used: 0,
  used_golden_key: false,
  coins_earned: 30,
  coins_balance: 420,
  level_ups: [],
  stars: 2,
  best_stars: 2,
  new_stars: 2,
  solved_directly: false,
  solution_copy: false,
  mode: 'first',
};

const noop = () => {};

// 채점 쪽지 견본의 채점 결과는 모듈 상수: 화면은 verdict 가 "바뀌면" 쪽지로 초점·스크롤을 옮기므로,
// 렌더마다 새 객체를 만들면 카탈로그가 다시 그려질 때마다 페이지가 이 견본으로 끌려감
const WRONG_VERDICT: BossSession['verdict'] = {
  correct: false,
  explanation: 'print()를 두 번 쓰면 두 줄로 나와요.',
  round: 1,
  submitted: 'opt-c8nz',
};
const RIGHT_VERDICT: BossSession['verdict'] = {
  correct: true,
  explanation: 'print()는 하나가 한 줄이에요.',
  round: 1,
  submitted: 'opt-r4wk',
};

/** 카탈로그용 세션 (화면 컴포넌트가 읽는 값만, 동작은 없음) */
function stub(over: Partial<BossSession>): BossSession {
  return {
    quest: { id: 'catalog-boss', title: BOSS.name } as BossSession['quest'],
    boss: BOSS,
    phase: 'battle',
    rounds: [QUIZ, QUIZ, QUIZ, QUIZ, QUIZ],
    round: 1,
    cleared: 1,
    hearts: 3,
    total: TOTAL,
    mode: 'first',
    value: null,
    misses: [],
    verdict: null,
    fx: null,
    reward: null,
    quiz: QUIZ,
    setValue: noop,
    start: async () => {},
    submit: async () => {},
    next: noop,
    isSubmitting: false,
    error: null,
    stale: false,
    bestStars: 0,
    userXP: 600,
    userLevel: 3,
    earnedXP: null,
    celebrationStore: {
      get: () => [],
      push: noop,
      dismiss: noop,
      subscribe: () => noop,
    },
    ...over,
  };
}

/** 무대 + 말풍선 (BossQuest 왼쪽 쪽과 같은 짜임) */
function Stage({
  phase,
  hp,
  hearts,
  fx,
  verdict = null,
  still = true,
}: {
  phase: BossPhase;
  hp: number;
  hearts: number;
  fx: BossFx | null;
  verdict?: BossSession['verdict'];
  still?: boolean;
}) {
  return (
    <BossArena
      phase={phase}
      bossName={BOSS.name}
      hp={hp}
      total={TOTAL}
      hearts={hearts}
      fx={fx}
      still={still}
      say={
        <SpeechBubble
          speaker={BOSS.name}
          tone="bug"
          tail="none"
          text={bossLine({ phase, verdict, hearts, boss: BOSS })}
        />
      }
    />
  );
}

/** 직접 눌러 보는 판: 정답 = 공격(HP −1), 오답 = 피격(하트 −1) */
function LiveDemo() {
  const play = useSfx();
  const [s, setS] = useState({ hp: TOTAL, hearts: BOSS_HEARTS, n: 0 });
  const [fx, setFx] = useState<BossFx | null>(null);
  const [verdict, setVerdict] = useState<BossSession['verdict']>(null);
  const phase: BossPhase =
    s.hp === 0 ? 'won' : s.hearts === 0 ? 'lost' : 'battle';
  const hit = (correct: boolean) => {
    const n = s.n + 1;
    setS({
      hp: correct ? s.hp - 1 : s.hp,
      hearts: correct ? s.hearts : s.hearts - 1,
      n,
    });
    setFx({ type: correct ? 'attack' : 'hurt', n });
    setVerdict({ correct, explanation: null, round: 0, submitted: '' });
    if (correct) play('correct');
    else play('wrong', { gain: WRONG_GAIN });
  };
  return (
    <div className="space-y-3" data-testid="boss-demo">
      <Stage
        still={false}
        phase={phase}
        hp={s.hp}
        hearts={s.hearts}
        fx={fx}
        verdict={verdict}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => hit(true)}
          disabled={phase !== 'battle'}
          data-testid="boss-demo-attack"
        >
          정답 (공격)
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => hit(false)}
          disabled={phase !== 'battle'}
          data-testid="boss-demo-hurt"
        >
          오답 (피격)
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setS({ hp: TOTAL, hearts: BOSS_HEARTS, n: 0 });
            setFx(null);
            setVerdict(null);
          }}
        >
          처음부터
        </Button>
      </div>
    </div>
  );
}

export function BossSection() {
  return (
    <Section
      id="boss"
      kicker="P9-12 · 보스 배틀"
      title="보스 배틀"
      description="스테이지 마지막 관문. 문제를 맞히면 꾸민 파이뱀이 별탄을 쏘아 보스 HP가 한 칸 줄고, 틀리면 버그버그가 돌진해 하트가 하나 깨져요. HP 바는 scaleX 트윈 + 늦게 따라오는 잔상, 흔들림·깜빡임은 transform·opacity만. 위 막대에서 lite(0.7배)·minimal(깜빡임·숫자만)·동작 줄이기(움직임 0, 표정·글자·색)로 바꿔 보세요. 숫자는 늘 글자로도(HP 3/5, 하트 2/3) 보이고 낭독기는 채점마다 한 줄로 읽어요."
    >
      <Demo
        label="직접 해 보기"
        note="정답·오답을 눌러 공격·피격 연출과 HP 바·하트를 봐요"
        data-testid="boss-live"
      >
        <LiveDemo />
      </Demo>
      <div className="grid gap-4 lg:grid-cols-2" data-testid="boss-states">
        <Demo label="등장" note="보스가 통통 뛰어 들어옴 (리그 appear)">
          <Stage phase="intro" hp={TOTAL} hearts={3} fx={null} />
        </Demo>
        <Demo label="공격 직후" note="HP 4/5 · 보스 깜빡 + −1">
          <Stage
            phase="battle"
            hp={4}
            hearts={3}
            fx={{ type: 'attack', n: 1 }}
            verdict={{
              correct: true,
              explanation: null,
              round: 0,
              submitted: '',
            }}
          />
        </Demo>
        <Demo label="피격 직후" note="하트 2/3 · 무대 흔들림 + 파이뱀 깜빡">
          <Stage
            phase="battle"
            hp={4}
            hearts={2}
            fx={{ type: 'hurt', n: 2 }}
            verdict={{
              correct: false,
              explanation: null,
              round: 1,
              submitted: '',
            }}
          />
        </Demo>
        <Demo label="승리" note="보스 쓰러짐(defeat) · 파이뱀 응원">
          <Stage phase="won" hp={0} hearts={2} fx={null} />
        </Demo>
        <Demo label="패배" note="버그버그 한마디 · 파이뱀 격려">
          <Stage phase="lost" hp={2} hearts={0} fx={null} />
        </Demo>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="등장 쪽" surface="card">
          <BossIntro
            session={stub({ phase: 'intro' })}
            locked={false}
            firstBlocking={null}
          />
        </Demo>
        <Demo label="잠긴 보스" note="코드 퀘스트가 남았을 때" surface="card">
          <BossIntro
            session={stub({ phase: 'intro' })}
            locked
            firstBlocking="catalog"
          />
        </Demo>
        <Demo label="문제 (고르는 중)" surface="card">
          <BossQuestion session={stub({ value: 'opt-r4wk' })} />
        </Demo>
        <Demo label="문제 (틀림 → 다시 고르기)" surface="card">
          <BossQuestion
            session={stub({
              hearts: 2,
              misses: ['opt-c8nz'],
              verdict: WRONG_VERDICT,
            })}
          />
        </Demo>
        <Demo label="문제 (정답 → 다음 문제)" surface="card">
          <BossQuestion
            session={stub({
              cleared: 2,
              value: 'opt-r4wk',
              verdict: RIGHT_VERDICT,
            })}
          />
        </Demo>
        <Demo label="승리 쪽" note="별 = 남은 하트 2개" surface="card">
          <BossWon
            session={stub({
              phase: 'won',
              hearts: 2,
              cleared: TOTAL,
              reward: REWARD,
            })}
            mapHref="/dev/design#boss"
            stageId="a1000000-0000-0000-0000-000000000001"
          />
        </Demo>
        <Demo label="패배 쪽" note="다시 도전 · 복습하러 가기" surface="card">
          <BossLost
            session={stub({ phase: 'lost', hearts: 0, cleared: 3 })}
            reviewHref="/dev/design#boss"
          />
        </Demo>
      </div>
    </Section>
  );
}
