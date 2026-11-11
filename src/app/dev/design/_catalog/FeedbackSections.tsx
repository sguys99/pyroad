'use client';

import { useEffect, useRef, useState } from 'react';
import { Bug, MessageCircle, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import {
  CurrencyHud,
  HudCounter,
  LevelSeal,
} from '@/components/ui/hud';
import { SpeechBubble, type BubbleTone } from '@/components/ui/speech-bubble';
import { DialogueBox } from '@/components/ui/dialogue-box';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import { RewardIcon, Stars, type RewardKind } from '@/components/ui/reward-icon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SoundToggle } from '@/components/sound/SoundToggle';
import { QuestHeader } from '@/components/quest/QuestHeader';
import { StageProgress } from '@/components/quest/StageProgress';
import { StepStrip } from '@/components/quest/StepStrip';
import { QuestHints } from '@/components/quest/QuestHints';
import { AskPybaem } from '@/components/quest/AskPybaem';
import { MotionProvider } from '@/components/providers/MotionProvider';
import {
  ASK_QUESTIONS,
  type AskQuestion,
  type QuestSession,
} from '@/lib/quest/useQuestSession';
import type { ChatMessage } from '@/lib/tutor/types';
import { stageDots, type StageQuestDot } from '@/lib/quest/stageProgress';
import { CodeSample, Demo, Labeled, Section } from './ui';

// 스테이지 진행 점 견본 (P6-02): 7개 중 1·2 끝냄, 지금 3번. 4·6번은 보너스 퀴즈(마름모 점, 숫자는 코드 퀘스트끼리 1/5, B53)
const STAGE_QUESTS: StageQuestDot[] = [
  '첫 인사',
  '두 줄 쓰기',
  '숫자 계산',
  '따옴표 친구',
  '이름표 붙이기',
  '틀린 곳 찾기',
  '마을 잔치',
].map((title, i) => ({
  id: `demo-q${i + 1}`,
  order: i + 1,
  title,
  completed: i < 2,
  quest_type: i === 3 || i === 5 ? 'quiz' : 'code',
}));

// ───────────────────────────── 진행바

export function ProgressSection() {
  const [value, setValue] = useState(30);
  return (
    <Section
      id="progress"
      kicker="컴포넌트 §7"
      title="진행바"
      description="채움은 transform scaleX만. 값이 오르면 빛 띠가 한 번 지나가요(full·lite). 길이 700ms · lite 70% · minimal 150ms(빛 띠 없음) · 동작 줄이기 즉시."
    >
      <Demo label="값 올리기" note="눌러서 채움 전환과 빛 띠를 확인" data-testid="progress-live">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            sfx={false}
            icon={<Plus aria-hidden />}
            onClick={() => setValue((v) => Math.min(100, v + 20))}
            data-testid="progress-up"
          >
            20 올리기
          </Button>
          <Button
            variant="secondary"
            size="sm"
            sfx={false}
            icon={<RotateCcw aria-hidden />}
            onClick={() => setValue(0)}
          >
            0으로
          </Button>
          <span className="hud-num text-small font-semibold">{value}%</span>
        </div>
        <ProgressBar value={value} label="견본 진행" size="lg" data-testid="progress-bar" />
        <ProgressBar value={value} label="견본 진행 (금색)" tone="reward" />
      </Demo>
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="0 · 40 · 100% × primary · reward × sm · md · lg">
          <div className="space-y-3">
            {(['sm', 'md', 'lg'] as const).map((size) => (
              <div key={size} className="grid grid-cols-[2rem_1fr_1fr_1fr] items-center gap-3">
                <span className="text-caption text-muted-foreground">{size}</span>
                {[0, 40, 100].map((v) => (
                  <ProgressBar key={v} value={v} size={size} label={`${size} ${v}%`} />
                ))}
                <span />
                {[0, 40, 100].map((v) => (
                  <ProgressBar
                    key={v}
                    value={v}
                    size={size}
                    tone="reward"
                    label={`${size} 금색 ${v}%`}
                  />
                ))}
              </div>
            ))}
          </div>
        </Demo>
        <Demo label="흰 카드 위 · 처음에 채워 올라감" surface="card" note="animateOnMount (월드맵·프로필 XP)">
          <ProgressBar value={72} label="다음 레벨까지" valueText="72 / 100 XP" animateOnMount />
          <p className="text-caption text-muted-foreground">72 / 100 XP</p>
        </Demo>
      </div>
      <CodeSample code={`<ProgressBar value={xp} max={200} label="다음 레벨까지 경험치" valueText={\`\${xp} / 200 XP\`} />`} />
      <StageProgressDemo />
      <StepStripDemo />
    </Section>
  );
}

function StageProgressDemo() {
  const [passed, setPassed] = useState(false);
  const dots = stageDots(STAGE_QUESTS, 'demo-q3', passed);
  return (
    <>
      <Demo
        label="스테이지 진행 점 (StageProgress, P6-02)"
        note="퀘스트 헤더 오른쪽. 초록 = 끝냄 · 회색 = 아직 · 긴 알약 = 지금(안 끝냈으면 금색, 통과하면 초록) · 작은 마름모 = 보너스 퀴즈(B53). 숫자는 코드 퀘스트끼리(3/5), 퀴즈에서는 '퀴즈 1/2'. 열린 점은 그 퀘스트 링크, 좁은 화면은 제목 대신 점과 숫자"
        data-testid="stage-progress-demo"
      >
        <div className="overflow-hidden rounded-xl ring-1 ring-border">
          <QuestHeader
            worldHref="#"
            bgm={null}
            stageTitle="파이썬 마을"
            stageOrder={1}
            questTitle="숫자 계산"
            dots={dots}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Labeled label="보너스 퀴즈 화면 (퀴즈 1/2)">
            <StageProgress dots={stageDots(STAGE_QUESTS, 'demo-q4', false)} />
          </Labeled>
          <Labeled label="잠긴 스테이지 복습 (안 끝낸 점 잠김)">
            <StageProgress
              dots={stageDots(STAGE_QUESTS, 'demo-q1', false, false)}
            />
          </Labeled>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPassed((p) => !p)}
            icon={passed ? <RotateCcw aria-hidden /> : <Plus aria-hidden />}
          >
            {passed ? '되돌리기' : '3번 통과하기'}
          </Button>
        </div>
      </Demo>
      <CodeSample code={`<QuestHeader … dots={stageDots(quest.stage.quests ?? [], quest.id, session.isCompleted, quest.stage.unlocked)} />`} />
    </>
  );
}

// 프로젝트 단계 띠 견본 (P6-12): 숫자 맞추기 게임 5단계
const DEMO_STEPS = [
  'random 모듈로 1~10 사이의 비밀 숫자를 만들고 출력해보기',
  '추측 숫자를 guess 변수에 저장하고 "추측"과 함께 출력하기',
  'if/elif/else로 비밀 숫자와 추측을 비교하기',
  'while 반복문으로 정답을 맞출 때까지 반복하기',
  '시도 횟수를 세고 완성 메시지 출력하기',
];

function StepStripDemo() {
  const [step, setStep] = useState(2);
  const [cleared, setCleared] = useState<number | null>(null);
  const done = step > DEMO_STEPS.length;
  const advance = () => {
    setCleared(null);
    setStep((n) => n + 1);
  };
  const pass = () =>
    step < DEMO_STEPS.length ? setCleared(step) : setStep(step + 1);
  return (
    <>
      <Demo
        label="프로젝트 단계 띠 (StepStrip, P6-12)"
        note="공책 쪽 맨 위. 칸 막대·주색 초록만(헤더 스테이지 점의 둥근 점·금색 알약과 구분: 점 = 어느 퀘스트, 칸 = 이 퀘스트 안 단계). 통과하면 칸이 차오르고 “N단계 통과!” → 다음 목표, “다음 단계로”로 건너뜀(앱은 2.2초 뒤 저절로). minimal 페이드 · 동작 줄이기 없음"
        surface="card"
        data-testid="step-strip-demo"
      >
        <div className="max-w-xl">
          <StepStrip
            goals={DEMO_STEPS}
            current={Math.min(step, DEMO_STEPS.length)}
            cleared={cleared}
            completed={done}
            onSkip={advance}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={pass}
            disabled={done || cleared !== null}
            icon={<Plus aria-hidden />}
          >
            {step < DEMO_STEPS.length ? `${step}단계 통과하기` : '프로젝트 완성하기'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCleared(null);
              setStep(1);
            }}
            icon={<RotateCcw aria-hidden />}
          >
            처음부터
          </Button>
        </div>
      </Demo>
      <CodeSample code={`<StepStrip goals={steps.map((s) => s.step_goal)} current={session.currentStep} cleared={session.stepCleared} completed={session.isCompleted} onSkip={session.skipStepBeat} />`} />
    </>
  );
}

// 힌트·황금키 견본 (P6-09): 저장된 힌트처럼 쪽지가 하나씩 열림. 별 안내는 SHOW_STARS가 꺼져 있어도 여기서 확인
const DEMO_HINTS = [
  '`print()` 괄호 안에 보여 주고 싶은 글자를 넣어요.',
  '글자는 따옴표로 감싸야 해요. 예: `"안녕"`',
  '`print("안녕하세요!")` 처럼 써 봐요.',
];

function QuestHintsDemo() {
  const [hints, setHints] = useState(0);
  const [keys, setKeys] = useState(3);
  const [usedKey, setUsedKey] = useState(false);
  const [done, setDone] = useState(false);
  const common = {
    kind: 'code' as const,
    hintsUsed: hints,
    notes: DEMO_HINTS.slice(0, hints).map((text, i) => ({
      level: i + 1,
      text,
    })),
    onHint: () => setHints((h) => Math.min(h + 1, 3)),
    hintBusy: false,
    goldenKeys: keys,
    onGoldenKey: () => {
      setKeys((k) => k - 1);
      setUsedKey(true);
      setDone(true);
    },
    keyBlocked: false,
    xpReward: 50,
    totalHintsUsed: hints,
    usedGoldenKey: usedKey,
    isCompleted: done,
    completion: done ? ('just' as const) : null,
  };
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Demo
          label="힌트·황금키 (QuestHints, P6-09) · XP 안내 (SHOW_STARS 끄면)"
          note="이야기 쪽 대사창 아래. 버튼에 남은 횟수, 쓰기 전에 받을 XP가 어떻게 바뀌는지(힌트 0회 1.5배 · 1회 1.25배 · 그 외 기본 · 황금키 0, 서버 quest_xp와 같은 규칙). 황금키는 확인 창(결과·남는 키·다시 채우는 때). 쪽지 등장: full 스프링 · lite 짧게 · minimal 페이드 · 동작 줄이기 즉시"
          surface="card"
          data-testid="quest-hints-demo"
        >
          <QuestHints {...common} showStars={false} />
        </Demo>
        <Demo
          label="같은 줄 · 별 안내 = 지금 화면 (SHOW_STARS, P8-05)"
          note="별 규칙 F3: 힌트 0회 ★★★ · 1회 ★★ · 그 외·황금키 ★. 두 견본은 같은 상태를 공유해요"
          surface="card"
        >
          <QuestHints {...common} showStars />
        </Demo>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setHints(0);
          setKeys(3);
          setUsedKey(false);
          setDone(false);
        }}
        icon={<RotateCcw aria-hidden />}
      >
        처음부터
      </Button>
      <CodeSample code={`<QuestHints kind={session.kind} hintsUsed={session.hintsUsed} notes={hintNotes(session.messages, session.currentStep, session.streamingContent)} … xpReward={quest.xp_reward} totalHintsUsed={session.totalHintsUsed} usedGoldenKey={session.usedGoldenKey} />`} />
    </>
  );
}

// ───────────────────────────── 재화 HUD

export function HudSection() {
  const [coins, setCoins] = useState(1280);
  const [stars, setStars] = useState(14);
  const [keys, setKeys] = useState(2);
  const [level, setLevel] = useState(3);
  const [xp, setXp] = useState(40);
  return (
    <Section
      id="hud"
      kicker="컴포넌트 §8"
      title="재화 HUD"
      description="숫자는 고정 폭(hud-num). 오르면 카운트업 + 칩 팝(prop 스프링, full·lite), minimal·동작 줄이기는 숫자를 바로 바꾸고 칩을 금색 틴트로 잠깐 칠해요. 640px 미만은 1만 이상을 '1.2만'으로."
    >
      <Demo label="전체 (코인 · 별 · 키 · 소리)" data-testid="hud-live">
        {/* 360폭에서 코인·별·키·소리를 다 넣으면 넘친다(P2-12에서 발견, HUD 개편 Phase 4~6에서 정리). 페이지가 옆으로 밀리지 않게 이 칸만 스크롤 */}
        <div className="overflow-x-auto pb-1">
        <CurrencyHud
          level={level}
          xp={{ value: xp, max: 100 }}
          coins={coins}
          stars={stars}
          keys={keys}
          end={<SoundToggle />}
          className="min-w-max"
        />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            sfx="coin"
            onClick={() => setCoins((c) => c + 37)}
            data-testid="hud-coin-up"
          >
            코인 +37
          </Button>
          <Button size="sm" sfx="star" onClick={() => setStars((s) => s + 1)}>
            별 +1
          </Button>
          <Button size="sm" sfx={false} onClick={() => setKeys((k) => k + 1)}>
            황금키 +1
          </Button>
          <Button
            size="sm"
            sfx="levelup"
            onClick={() => {
              setLevel((l) => l + 1);
              setXp(10);
            }}
          >
            레벨 업
          </Button>
          <Button size="sm" variant="secondary" sfx={false} onClick={() => setXp((x) => Math.min(100, x + 25))}>
            경험치 +25
          </Button>
          <Button size="sm" variant="secondary" sfx={false} onClick={() => setCoins(12345)}>
            큰 수 12,345
          </Button>
        </div>
      </Demo>
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="키 없음 (월드맵)">
          <CurrencyHud level={7} xp={{ value: 80, max: 100 }} coins={12345} stars={42} />
        </Demo>
        <Demo label="LevelSeal md · sm · 두 자리 / 칩 하나씩">
          <div className="flex flex-wrap items-center gap-4">
            <LevelSeal level={3} />
            <LevelSeal level={3} size="sm" />
            <LevelSeal level={27} />
            <HudCounter kind="coin" value={999} />
            <HudCounter kind="star" value={150000000} />
            <HudCounter kind="key" value={1} noCompact />
          </div>
        </Demo>
      </div>
      <CodeSample code={`<CurrencyHud level={3} xp={{ value: 40, max: 100 }} coins={1280} stars={14} keys={2} end={<SoundToggle />} />`} />
    </Section>
  );
}

// ───────────────────────────── 말풍선

const BUBBLE_TONES: BubbleTone[] = ['tutor', 'good', 'bug', 'quiet'];
const BUBBLE_TEXT: Record<BubbleTone, string> = {
  tutor: '안녕, 모험가! 나는 파이뱀이야.',
  good: '맞았어요! 별 하나 받았어요.',
  bug: '앗, 내가 코드를 살짝 바꿨지롱!',
  quiet: '생각 중이에요…',
};
const SPEAKER: Record<BubbleTone, string> = {
  tutor: '파이뱀 선생님',
  good: '파이뱀 선생님',
  bug: '버그버그',
  quiet: '파이뱀 선생님',
};
const TYPING_TEXT =
  '반복문은 같은 일을 여러 번 하게 해 줘. for i in range(3): 을 쓰면 세 번 반복해!';

const DIALOGUE_LINES = [
  '이야기를 읽고 해 볼 일을 확인해요. 공책에 주문을 써서 "코드 돌려보기"를 눌러 봐요!',
  '돌아가긴 했는데 나온 글자가 조금 달라요. 해 볼 일을 다시 읽어 봐요!',
  '해냈어요! 해 볼 일을 모두 끝냈어요. 통과 도장 쾅!',
];

// 파이뱀에게 물어보기 견본 (P6-10): 가짜 세션으로 질문 → 생각 중 → 흐르는 글자 → 답, 닫힌 채 말이 오면 배지·미리 보기
const DEMO_CHAT: ChatMessage[] = [
  {
    role: 'tutor',
    content:
      '`print()`는 화면에 글자를 보여 주는 **마법 주문**이에요! 따옴표 안에 보여 주고 싶은 말을 넣어 봐요.',
    isFallback: true,
  },
  { role: 'system', content: '🔑 황금키를 사용했어요!' },
];
const DEMO_ANSWER: Record<AskQuestion, string> = {
  concept:
    '`print()`는 괄호 안의 것을 화면에 보여 주는 주문이에요. 칠판에 글씨를 쓰는 것과 비슷해요! 예: `print("사과")` → 사과',
  what: '해 볼 일은 두 가지예요. 먼저 print() 괄호 안에 "안녕하세요!"를 넣고, 코드 돌려보기를 눌러 나온 글자를 확인해요.',
  why: '나온 글자가 hello였어요. 해 볼 일은 "안녕하세요!"를 보여 주는 거니까 따옴표 안 글자를 바꿔 볼까요?',
};

function TutorChatDemo() {
  const [messages, setMessages] = useState(DEMO_CHAT);
  const [loading, setLoading] = useState(false);
  const [stream, setStream] = useState('');
  const [askOpen, setAskOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const at = (ms: number, fn: () => void) =>
    timers.current.push(setTimeout(fn, ms));

  /** 생각 중 1.2초 → 한 글자씩 흘려 쓰기 → 답 */
  const reply = (answer: string) => {
    setLoading(true);
    const chars = [...answer];
    chars.forEach((_, i) =>
      at(1200 + i * 30, () => setStream(chars.slice(0, i + 1).join(''))),
    );
    at(1400 + chars.length * 30, () => {
      setStream('');
      setLoading(false);
      setMessages((m) => [...m, { role: 'tutor', content: answer }]);
    });
  };
  const session = {
    messages,
    isAiLoading: loading,
    streamingContent: stream,
    hasApiKey: false,
    canAskWhy: true,
    askOpen,
    setAskOpen,
    handleAsk: (q: AskQuestion) => {
      setMessages((m) => [...m, { role: 'student', content: ASK_QUESTIONS[q] }]);
      reply(DEMO_ANSWER[q]);
    },
  } as unknown as QuestSession;

  return (
    <MotionProvider>
      <Demo
        label="파이뱀에게 물어보기 (AskPybaem + ConversationPanel, P6-10)"
        note="대사창 아래 한 줄: 닫혀 있을 때 파이뱀이 한 말은 새 이야기 수 + 두 줄 미리 보기. 누르면 lg↑는 이 자리에서 펼침(대화만 스크롤), 그 아래는 바텀시트. 질문은 정해진 버튼 3개(무엇을 하면 돼요? = 지금 할 일 · 개념만 · 왜 이렇게 나왔어요?, 자유 입력은 P9-17). 생각 중 점 세 개는 바쁨 표시라 동작 줄이기에서만 멈추고 글자는 늘 보임, 다 쓴 답만 aria-live로 읽음. 키가 없으면 맨 위에 기본 튜터 안내"
        surface="card"
        data-testid="tutor-chat-demo"
      >
        <div className="max-w-xl">
          <AskPybaem session={session} hintPending={false} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            sfx={false}
            icon={<MessageCircle aria-hidden />}
            disabled={loading}
            onClick={() => reply(DEMO_ANSWER.why)}
            data-testid="tutor-chat-arrive"
          >
            파이뱀이 말하기 (닫힌 채로 보면 배지)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            sfx={false}
            icon={<RotateCcw aria-hidden />}
            onClick={() => {
              timers.current.forEach(clearTimeout);
              setStream('');
              setLoading(false);
              setMessages(DEMO_CHAT);
            }}
          >
            처음부터
          </Button>
        </div>
        <CodeSample code={`<AskPybaem session={session} hintPending={notes.some((n) => n.pending)} />  // StoryPage ask 자리`} />
      </Demo>
    </MotionProvider>
  );
}

export function BubbleSection() {
  const [round, setRound] = useState(0);
  return (
    <Section
      id="bubble"
      kicker="컴포넌트 §9"
      title="말풍선"
      description="흰 면 + 꼬리 + 화자 이름표. 타자 효과는 전체 문장을 미리 배치해 상자가 흔들리지 않아요(34ms/글자, 깜빡이는 커서). minimal·동작 줄이기는 처음부터 전체 문장."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="타자 효과" note="다시 누르면 처음부터" data-testid="bubble-typing">
          <SpeechBubble
            key={round}
            speaker="파이뱀 선생님"
            text={TYPING_TEXT}
            typing
          />
          <Button
            size="sm"
            variant="secondary"
            sfx={false}
            icon={<RotateCcw aria-hidden />}
            onClick={() => setRound((r) => r + 1)}
            data-testid="bubble-retype"
          >
            다시 타자
          </Button>
        </Demo>
        <Demo label="스트리밍 (AI 튜터) · 배지 · 긴 대사">
          <SpeechBubble
            speaker="파이뱀 선생님"
            badge={
              <span className="ml-1 rounded-full bg-surface-2 px-2 text-caption font-medium text-muted-foreground">
                저장된 답변
              </span>
            }
          >
            답을 쓰는 중이에요 <span className="g-caret" aria-hidden />
          </SpeechBubble>
          <SpeechBubble speaker="파이뱀 선생님" tail="top">
            print() 안에 글자를 넣을 때는 따옴표로 감싸야 해. 따옴표가 없으면
            파이썬은 그 글자를 변수 이름으로 생각하거든. &quot;안녕&quot;처럼
            써 볼래? 두 줄이 넘는 긴 대사도 상자 폭에 맞춰 줄바꿈돼요.
          </SpeechBubble>
        </Demo>
      </div>
      <Demo
        label="대사창 (DialogueBox, P6-01)"
        note="캐릭터 + 말풍선 + 타자. 누르거나 Enter·Space면 남은 글자를 한 번에, 낭독기는 대사가 바뀔 때 전체 문장을 한 번. 글자가 나오는 동안 리그가 말해요"
        data-testid="dialogue-box-demo"
      >
        <DialogueBox
          key={round}
          speaker="파이뱀"
          text={DIALOGUE_LINES[round % DIALOGUE_LINES.length]}
          tone={round % DIALOGUE_LINES.length === 2 ? 'good' : 'tutor'}
          data-testid="dialogue-box"
          character={(speaking) => (
            <PybaemRig
              state={round % DIALOGUE_LINES.length === 2 ? 'cheer' : 'talk'}
              talking={speaking}
              size={96}
              label=""
            />
          )}
        />
      </Demo>
      <TutorChatDemo />
      <div className="grid gap-4 sm:grid-cols-2">
        {BUBBLE_TONES.map((tone) => (
          <Demo key={tone} label={tone} note="꼬리 left · top · none">
            <div className="space-y-4 pl-2">
              {(['left', 'top', 'none'] as const).map((tail) => (
                <SpeechBubble
                  key={tail}
                  tone={tone}
                  tail={tail}
                  speaker={SPEAKER[tone]}
                  speakerIcon={tone === 'bug' ? <Bug /> : <Sparkles />}
                  text={BUBBLE_TEXT[tone]}
                />
              ))}
            </div>
          </Demo>
        ))}
      </div>
      <CodeSample code={`<DialogueBox speaker="파이뱀" text={line} character={(speaking) => <PybaemRig state="talk" talking={speaking} size={96} label="" />} />\n<SpeechBubble speaker="파이뱀 선생님" text={line} typing onTypingDone={next} />\n<SpeechBubble tone="bug" speaker="버그버그">…</SpeechBubble>`} />
    </Section>
  );
}

// ───────────────────────────── 보상 아이콘

const KINDS: RewardKind[] = ['coin', 'star', 'starEmpty', 'key'];

export function RewardSection() {
  return (
    <Section
      id="reward"
      kicker="컴포넌트 §10"
      title="보상 아이콘 · 별"
      description="금색 하나(accent) + 진한 톤 외곽 + 밝은 쪽. 이모지·하드코딩 색 없음."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="4종 × 20 · 26 · 34px">
          <div className="grid grid-cols-4 gap-3">
            {KINDS.map((kind) => (
              <Labeled key={kind} label={kind}>
                <span className="flex items-end gap-2">
                  {[20, 26, 34].map((size) => (
                    <RewardIcon key={size} kind={kind} size={size} />
                  ))}
                </span>
              </Labeled>
            ))}
          </div>
        </Demo>
        <Demo label="Stars 0~3 · 비활성 버튼 안">
          <div className="flex flex-wrap items-center gap-4">
            {[0, 1, 2, 3].map((n) => (
              <Stars key={n} n={n} size={26} />
            ))}
            <Button
              variant="reward"
              size="sm"
              disabled
              icon={<RewardIcon kind="star" size={22} />}
            >
              별 받기
            </Button>
          </div>
        </Demo>
      </div>
      <CodeSample code={`<RewardIcon kind="coin" size={26} label="코인" />\n<Stars n={2} max={3} />`} />
      <QuestHintsDemo />
    </Section>
  );
}

// ───────────────────────────── 툴팁

export function TooltipSection() {
  return (
    <Section
      id="tooltip"
      kicker="컴포넌트 §11"
      title="툴팁"
      description="짙은 면 + 흰 글자 14px(14.24:1). 95% → 100% + 페이드 140ms · minimal 페이드만 · 동작 줄이기 즉시."
    >
      <Card className="flex flex-wrap gap-3">
        <Tooltip>
          <TooltipTrigger render={<Button variant="secondary" size="sm" sfx={false} />}>
            힌트 받기 (올려놓기)
          </TooltipTrigger>
          <TooltipContent>힌트를 보면 별이 하나 줄어들어요</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="reward"
                size="sm"
                sfx={false}
                icon={<RewardIcon kind="key" size={22} />}
              />
            }
          >
            황금키
          </TooltipTrigger>
          <TooltipContent side="bottom">
            정답을 바로 볼 수 있어요 (2개 남음)
          </TooltipContent>
        </Tooltip>
      </Card>
      <CodeSample code={`<Tooltip>\n  <TooltipTrigger render={<Button variant="secondary" />}>힌트 받기</TooltipTrigger>\n  <TooltipContent>힌트를 보면 별이 하나 줄어들어요</TooltipContent>\n</Tooltip>`} />
    </Section>
  );
}
