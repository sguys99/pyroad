'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Code2,
  Info,
  Lightbulb,
  Play,
  Square,
  Terminal,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  Button,
  IconButton,
  type ButtonSize,
  type ButtonVariant,
} from '@/components/ui/button';
import {
  Card,
  CardButton,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Modal, Sheet, SheetClose } from '@/components/ui/sheet';
import {
  Toast,
  ToastViewport,
  useToastQueue,
  type ToastTone,
} from '@/components/ui/toast';
import { SegmentedTabs } from '@/components/ui/tabs';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon } from '@/components/ui/reward-icon';
import { PybaemStatic } from '@/components/characters/rig';
import { CodeSample, Demo, Labeled, Section } from './ui';

// ───────────────────────────── 게임 버튼

const VARIANTS: ButtonVariant[] = [
  'primary',
  'secondary',
  'reward',
  'danger',
  'ghost',
];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];
const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: '코드 돌려보기!',
  secondary: '멈추기',
  reward: '보상 받기',
  danger: '탈퇴하기',
  ghost: '건너뛰기',
};

export function ButtonSection() {
  return (
    <Section
      id="buttons"
      kicker="컴포넌트 §1"
      title="게임 버튼 · 아이콘 버튼"
      description="면 + 같은 계열의 진한 아랫면 3px, 누르면 아랫면만큼 내려갑니다. 손을 떼면 full은 jellyB 출렁임 · lite는 face 스프링 · minimal은 즉시 · 동작 줄이기는 움직이지 않고 면 색만 진해져요. 올려놓기(마우스)와 포커스(Tab 키)는 직접 해 보세요."
    >
      {VARIANTS.map((variant) => (
        <Demo
          key={variant}
          label={variant}
          note="크기 sm · md · lg × 기본 · 눌림(pressed) · 로딩 · 비활성"
          data-testid={`buttons-${variant}`}
        >
          <div className="space-y-3">
            {SIZES.map((size) => (
              <div key={size} className="flex flex-wrap items-start gap-3">
                <span className="w-7 pt-3 text-caption text-muted-foreground">
                  {size}
                </span>
                <Labeled label="기본">
                  <Button
                    variant={variant}
                    size={size}
                    sfx={false}
                    data-testid={`btn-${variant}-${size}`}
                  >
                    {VARIANT_TEXT[variant]}
                  </Button>
                </Labeled>
                <Labeled label="눌림">
                  <Button variant={variant} size={size} sfx={false} pressed>
                    {VARIANT_TEXT[variant]}
                  </Button>
                </Labeled>
                <Labeled label="로딩">
                  <Button variant={variant} size={size} sfx={false} loading>
                    {VARIANT_TEXT[variant]}
                  </Button>
                </Labeled>
                <Labeled label="비활성">
                  <Button variant={variant} size={size} sfx={false} disabled>
                    {VARIANT_TEXT[variant]}
                  </Button>
                </Labeled>
              </div>
            ))}
          </div>
        </Demo>
      ))}

      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="아이콘 앞 · 뒤 · 없음" note="아이콘은 aria-hidden, 글자가 이름">
          <div className="flex flex-wrap gap-3">
            <Button icon={<Play aria-hidden />} sfx={false}>
              코드 돌려보기!
            </Button>
            <Button iconRight={<ArrowRight aria-hidden />} sfx={false}>
              다음 퀘스트로
            </Button>
            <Button variant="secondary" sfx={false}>
              그만두기
            </Button>
            <Button
              variant="reward"
              size="sm"
              sfx={false}
              icon={<RewardIcon kind="key" size={22} />}
            >
              황금키
            </Button>
            <Button
              variant="reward"
              size="sm"
              disabled
              icon={<RewardIcon kind="key" size={22} />}
            >
              황금키 (비활성 55%)
            </Button>
          </div>
        </Demo>
        <Demo
          label="흰 카드 위"
          note="data-surface=raised 안의 secondary·danger는 보조 면 색"
          surface="card"
        >
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" sfx={false} icon={<Square aria-hidden />}>
              멈추기
            </Button>
            <Button variant="secondary" sfx={false} pressed>
              눌림
            </Button>
            <Button variant="danger" sfx={false} icon={<Trash2 aria-hidden />}>
              지우기
            </Button>
            <Button variant="danger" sfx={false} pressed>
              눌림
            </Button>
          </div>
        </Demo>
        <Demo
          label="링크 버튼 · 탭 소리"
          note="href면 Next Link(역할 link). primary·reward는 누르면 tap 소리"
        >
          <div className="flex flex-wrap gap-3">
            <Button href="#buttons" data-testid="btn-press-target">
              눌러 보기 (소리)
            </Button>
            <Button variant="reward" icon={<RewardIcon kind="coin" size={22} />}>
              보상 받기
            </Button>
            <Button variant="ghost" href="#buttons">
              더 보기
            </Button>
          </div>
        </Demo>
        <Demo label="IconButton md · sm" note="기본 · 눌림 · (포커스는 Tab으로)">
          <div className="flex flex-wrap items-center gap-4">
            <Labeled label="md">
              <IconButton label="소리 끄기">
                <Volume2 aria-hidden />
              </IconButton>
            </Labeled>
            <Labeled label="md 눌림">
              <IconButton label="소리 끄기 (눌림)" pressed>
                <Volume2 aria-hidden />
              </IconButton>
            </Labeled>
            <Labeled label="sm">
              <IconButton label="닫기" size="sm">
                <X aria-hidden />
              </IconButton>
            </Labeled>
            <Labeled label="sm 눌림">
              <IconButton label="닫기 (눌림)" size="sm" pressed>
                <X aria-hidden />
              </IconButton>
            </Labeled>
          </div>
        </Demo>
      </div>
      <CodeSample
        code={`<Button size="lg" icon={<Play aria-hidden />} loading={running} sfx={false}>코드 돌려보기!</Button>\n<Button variant="secondary" icon={<Square aria-hidden />}>멈추기</Button>\n<Button href={\`/quest/\${id}\`}>다음 퀘스트로 →</Button>\n<IconButton label="닫기"><X aria-hidden /></IconButton>`}
      />
    </Section>
  );
}

// ───────────────────────────── 카드

export function CardSection() {
  return (
    <Section
      id="cards"
      kicker="컴포넌트 §2"
      title="카드"
      description="테두리 없이 흰 면 + 그림자 한 종류. 누를 수 있는 카드는 올려놓으면 2px 뜨고 누르면 내려앉아요(동작 줄이기는 면 색만)."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(['none', 'sm', 'md', 'lg'] as const).map((padding) => (
          <Card key={padding} padding={padding}>
            <CardTitle className={padding === 'none' ? 'p-2' : undefined}>
              radius m · {padding}
            </CardTitle>
            <CardDescription className={padding === 'none' ? 'px-2 pb-2' : undefined}>
              안쪽 여백 {padding}
            </CardDescription>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card radius="l" padding="lg" className="space-y-3">
          <CardTitle>오늘의 퀘스트 (radius l)</CardTitle>
          <CardDescription>흰 면 안의 버튼·진행바는 보조 면 색으로 바뀌어요.</CardDescription>
          <ProgressBar value={40} label="오늘의 진행" />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" sfx={false}>
              힌트 받기
            </Button>
            <Button size="sm" sfx={false}>
              시작하기
            </Button>
          </div>
        </Card>
        <div className="grid gap-3">
          <CardButton data-testid="card-button">
            <CardTitle>첫 번째 인사 (버튼)</CardTitle>
            <CardDescription>올려놓기 · 누름 · 포커스</CardDescription>
          </CardButton>
          <CardButton href="#cards">
            <CardTitle>두 번째 인사 (링크)</CardTitle>
            <CardDescription>href면 Next Link</CardDescription>
          </CardButton>
        </div>
      </div>
      <CodeSample
        code={`<Card radius="l" className="space-y-3"><CardTitle>오늘의 퀘스트</CardTitle>…</Card>\n<CardButton href="/quest/abc"><CardTitle>첫 번째 인사</CardTitle></CardButton>`}
      />
    </Section>
  );
}

// ───────────────────────────── 확인 모달

function LoadingConfirm() {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog onOpenChange={(open) => !open && setBusy(false)}>
      <AlertDialogTrigger render={<Button variant="secondary" sfx={false} />}>
        sm · 로딩 확인
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>신고할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            버튼을 누르면 로딩 모양이 돼요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <Button loading={busy} sfx={false} onClick={() => setBusy(true)}>
            신고하기
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AlertDialogSection() {
  return (
    <Section
      id="alert-dialog"
      kicker="컴포넌트 §3"
      title="확인 모달 (AlertDialog)"
      description="되돌릴 수 없는 일을 되묻는 상자. 포커스 가두기 · Esc · 닫으면 연 버튼으로 포커스 복귀. 등장은 바텀시트·모달과 같은 단계 규칙."
    >
      <Demo label="열어 보기" note="default · sm × 제목+설명 · Media × primary · danger · 로딩">
        <div className="flex flex-wrap gap-3">
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="secondary" sfx={false} data-testid="open-alert" />}
            >
              default · primary 확인
            </AlertDialogTrigger>
            <AlertDialogContent data-testid="alert-content">
              <AlertDialogHeader>
                <AlertDialogTitle>처음부터 다시 할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  지금 쓴 코드는 지워지고 처음 코드로 돌아가요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>그대로 두기</AlertDialogCancel>
                <AlertDialogAction>다시 하기</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="danger" sfx={false} />}>
              default · Media · danger
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <AlertTriangle aria-hidden className="text-destructive" />
                </AlertDialogMedia>
                <AlertDialogTitle>정말 탈퇴하시겠어요?</AlertDialogTitle>
                <AlertDialogDescription>
                  모은 별과 뱃지가 모두 사라지고 되돌릴 수 없어요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction variant="danger">탈퇴하기</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <LoadingConfirm />
        </div>
      </Demo>
      <CodeSample
        code={`<AlertDialog>\n  <AlertDialogTrigger render={<Button variant="danger" size="sm" />}>탈퇴하기</AlertDialogTrigger>\n  <AlertDialogContent>\n    <AlertDialogHeader><AlertDialogTitle>정말 탈퇴하시겠어요?</AlertDialogTitle></AlertDialogHeader>\n    <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction variant="danger">탈퇴하기</AlertDialogAction></AlertDialogFooter>\n  </AlertDialogContent>\n</AlertDialog>`}
      />
    </Section>
  );
}

// ───────────────────────────── 바텀시트 · 모달

const LONG_LINES = Array.from(
  { length: 18 },
  (_, i) => `${i + 1}. 파이뱀과 함께 배우는 파이썬 이야기 한 줄`,
);

export function SheetSection() {
  return (
    <Section
      id="sheet"
      kicker="컴포넌트 §4"
      title="바텀시트 · 모달"
      description="모바일(768px 미만)은 아래에서 올라오는 시트(손잡이), 넓은 화면은 가운데 상자. full은 기울어 떠오름(body 스프링) · lite 짧은 미끄러짐 · minimal 페이드 · 동작 줄이기 즉시."
    >
      <Demo label="열어 보기" note="Sheet · Sheet wide · 긴 내용 스크롤 · Modal · Modal media+가운데">
        <div className="flex flex-wrap gap-3">
          <Sheet
            title="스테이지 3 · 반복의 숲"
            description="별 2개 / 3개를 모았어요."
            trigger={<Button variant="secondary" sfx={false} data-testid="open-sheet" />}
            footer={
              <>
                <SheetClose render={<Button variant="secondary" sfx={false} />}>
                  그만두기
                </SheetClose>
                <Button sfx={false}>이어 하기</Button>
              </>
            }
            data-testid="sheet-popup"
          >
            <ProgressBar value={66} label="스테이지 진행" />
          </Sheet>
          <Sheet
            wide
            title="넓은 시트"
            description="768px 이상에서 45rem"
            trigger={<Button variant="secondary" sfx={false} />}
          >
            <p>퀘스트 고르기처럼 칸이 많은 내용에 써요.</p>
          </Sheet>
          <Sheet
            title="긴 내용"
            description="안에서 스크롤돼요 (바깥은 잠김)"
            trigger={<Button variant="secondary" sfx={false} />}
          >
            <ol className="space-y-2 text-small">
              {LONG_LINES.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ol>
          </Sheet>
          <Modal
            title="저장했어요"
            description="늘 가운데 상자 (28rem)"
            trigger={<Button variant="secondary" sfx={false} data-testid="open-modal" />}
            footer={
              <SheetClose render={<Button sfx={false} />}>확인</SheetClose>
            }
          />
          <Modal
            title="앱에서 열어 주세요"
            description="인앱 브라우저에서는 로그인이 막힐 수 있어요."
            align="center"
            media={<PybaemStatic state="think" size={120} framing="stage" label="" />}
            trigger={<Button variant="secondary" sfx={false} />}
          />
        </div>
      </Demo>
      <CodeSample
        code={`<Sheet title="스테이지 3" trigger={<Button variant="secondary" />}\n  footer={<SheetClose render={<Button variant="secondary" />}>그만두기</SheetClose>}>\n  …\n</Sheet>`}
      />
    </Section>
  );
}

// ───────────────────────────── 토스트

const TONES: { tone: ToastTone; icon: React.ReactNode; text: string }[] = [
  { tone: 'info', icon: <Info aria-hidden className="size-5" />, text: '자동 저장했어요.' },
  { tone: 'good', icon: <Check aria-hidden className="size-5" />, text: '정답이에요! 별을 받았어요.' },
  { tone: 'warn', icon: <Lightbulb aria-hidden className="size-5" />, text: '아직 잠긴 스테이지예요.' },
  { tone: 'error', icon: <AlertTriangle aria-hidden className="size-5" />, text: '저장하지 못했어요. 다시 해 볼까요?' },
];

export function ToastSection() {
  const { toasts, show, dismiss } = useToastQueue(3);
  return (
    <Section
      id="toast"
      kicker="컴포넌트 §5"
      title="토스트"
      description="화면 아래 가운데의 짧은 쪽지(aria-live). full은 기울어 올라옴(body 스프링) · lite 12px 220ms · minimal 페이드 · 동작 줄이기 즉시."
    >
      <Demo label="띄우기" note="버튼마다 하나씩 (최대 3개 쌓임, 4초 뒤 닫힘)">
        <div className="flex flex-wrap gap-3">
          {TONES.map((t) => (
            <Button
              key={t.tone}
              variant="secondary"
              size="sm"
              sfx={false}
              onClick={() => show(t.text, { tone: t.tone, icon: t.icon })}
              data-testid={`toast-${t.tone}`}
            >
              {t.tone}
            </Button>
          ))}
          <Button
            variant="secondary"
            size="sm"
            sfx={false}
            onClick={() =>
              TONES.slice(0, 3).forEach((t) =>
                show(t.text, { tone: t.tone, icon: t.icon }),
              )
            }
          >
            3개 쌓기
          </Button>
        </div>
      </Demo>
      <div className="grid gap-3 md:grid-cols-2">
        {TONES.map((t) => (
          <div key={t.tone} className="space-y-2">
            <Toast tone={t.tone} icon={t.icon} duration={0} onClose={() => {}}>
              {t.text}
            </Toast>
            <Toast tone={t.tone} duration={0}>
              {t.tone} · 아이콘·닫기 없음
            </Toast>
          </div>
        ))}
        <Toast tone="info" icon={<BookOpen aria-hidden className="size-5" />} duration={0}>
          두 줄 문구: 퀘스트를 다 깨면 다음 권이 열려요. 지금까지 모은 별은 그대로 남아요.
        </Toast>
      </div>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      <CodeSample
        code={`const { toasts, show, dismiss } = useToastQueue(3);\nshow('저장했어요', { tone: 'good', icon: <Check aria-hidden /> });\n<ToastViewport toasts={toasts} onDismiss={dismiss} />`}
      />
    </Section>
  );
}

// ───────────────────────────── 세그먼트 탭

const TAB_SETS = {
  two: [
    { value: 'story', label: '이야기' },
    { value: 'code', label: '코드' },
  ],
  three: [
    { value: 'story', label: '이야기', icon: <BookOpen aria-hidden className="size-4" /> },
    { value: 'code', label: '코드', icon: <Code2 aria-hidden className="size-4" /> },
    { value: 'result', label: '결과', icon: <Terminal aria-hidden className="size-4" /> },
  ],
  four: [
    { value: 'a', label: '1권' },
    { value: 'b', label: '2권' },
    { value: 'c', label: '3권' },
    { value: 'd', label: '4권' },
  ],
} as const;

function TabsDemo({ set, label }: { set: keyof typeof TAB_SETS; label: string }) {
  const items = TAB_SETS[set];
  const [value, setValue] = useState<string>(items[0].value);
  return (
    <SegmentedTabs<string>
      items={items}
      value={value}
      onValueChange={setValue}
      aria-label={label}
      className="w-full"
    />
  );
}

export function TabsSection() {
  return (
    <Section
      id="tabs"
      kicker="컴포넌트 §6"
      title="세그먼트 탭"
      description="같은 화면 안에서 보기 바꾸기. 엄지는 face 스프링 · lite 220ms · minimal·동작 줄이기 즉시. ←/→·Home·End로 옮겨요."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Demo label="2칸">
          <TabsDemo set="two" label="2칸 탭 견본" />
        </Demo>
        <Demo label="3칸 · 아이콘">
          <TabsDemo set="three" label="3칸 탭 견본" />
        </Demo>
        <Demo label="4칸">
          <TabsDemo set="four" label="4칸 탭 견본" />
        </Demo>
      </div>
      <CodeSample
        code={`<SegmentedTabs aria-label="퀘스트 보기" items={[{ value: 'story', label: '이야기' }, …]}\n  value={tab} onValueChange={setTab} idBase="quest-tab" />`}
      />
    </Section>
  );
}
