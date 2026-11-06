'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import {
  COLOR,
  CONTRAST_MIN,
  CONTRAST_PAIRS,
  DURATION,
  EASING,
  LINE,
  RADIUS,
  SHADOW,
  SPACE,
  SPRINGS,
  TYPE,
  WORLD_THEMES,
  contrastRatio,
  cssVar,
  colorVarName,
  fmtRatio,
  pairBackground,
  pairContrast,
  springTiming,
  type ColorName,
  type DurationName,
  type EasingName,
  type SpringName,
  type TypeName,
  type WorldId,
} from '@/lib/design/tokens';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CodeSample, Demo, Section } from './ui';

// ───────────────────────────── 색

/** 색 토큰의 쓰임 (tokens.ts 주석·docs/design/tokens.md 표에서). Record라 토큰이 늘면 tsc가 알려 준다 */
const COLOR_ROLE: Record<ColorName, string> = {
  bg: '단색 바탕',
  surface: '카드·시트·입력',
  surface2: '보조 면: 칩·결과 상자·눌린 탭',
  surfaceLip: '흰 버튼 아랫면 (장식)',
  line: '장식 구분선',
  lineStrong: '입력·코드 상자 경계 (UI 3:1)',
  text: '본문 글자',
  textMuted: '보조 글자',
  primary: '주색 면 (주 버튼)',
  onPrimary: '주색 위 글자',
  primaryLip: '주 버튼 아랫면 (장식)',
  primaryText: '초록 글자·링크',
  primaryBright: '진행 끝·지도 길 (장식)',
  primarySoft: '초록 틴트 면',
  secondary: '짙은 중립: 포커스 링·툴팁',
  onSecondary: '짙은 면 위 글자',
  accent: '금색 면 (장식·보상 버튼)',
  onAccent: '금색 위 글자',
  accentLip: '금색 아랫면·별 외곽 (장식)',
  accentLight: '별·코인 밝은 쪽 (장식)',
  accentText: '금색 계열 글자',
  accentSoft: '금색 틴트 면',
  success: '성공 글자',
  successSoft: '성공 틴트 면',
  warning: '경고 글자',
  warningSoft: '경고 틴트 면',
  error: '오류 글자',
  onError: '오류색 위 글자',
  errorSoft: '오류 틴트 면',
  onScrim: '덮개 위 글자',
  w1: '월드 1 틴트 (장식)',
  w1Ink: '월드 1 표지 글자',
  w1Soft: '월드 1 바탕',
  w2: '월드 2 틴트 (장식)',
  w2Ink: '월드 2 표지 글자',
  w2Soft: '월드 2 바탕',
  w3: '월드 3 틴트 (장식)',
  w3Ink: '월드 3 표지 글자',
  w3Soft: '월드 3 바탕',
  codeBg: '코드 바탕',
  codeText: '코드 글자',
  codeComment: '코드 주석',
  codeKeyword: '코드 키워드',
  codeString: '코드 문자열',
  codeNumber: '코드 숫자',
  codeFunc: '코드 함수 이름',
};

const COLOR_GROUPS: [string, ColorName[]][] = [
  ['중립', ['bg', 'surface', 'surface2', 'surfaceLip', 'line', 'lineStrong', 'text', 'textMuted']],
  ['주색 · 보조', ['primary', 'onPrimary', 'primaryLip', 'primaryText', 'primaryBright', 'primarySoft', 'secondary', 'onSecondary']],
  ['강조 금색', ['accent', 'onAccent', 'accentLip', 'accentLight', 'accentText', 'accentSoft']],
  ['의미색 · 덮개', ['success', 'successSoft', 'warning', 'warningSoft', 'error', 'onError', 'errorSoft', 'onScrim']],
  ['월드 틴트', ['w1', 'w1Ink', 'w1Soft', 'w2', 'w2Ink', 'w2Soft', 'w3', 'w3Ink', 'w3Soft']],
  ['코드', ['codeBg', 'codeText', 'codeComment', 'codeKeyword', 'codeString', 'codeNumber', 'codeFunc']],
];

const PAIR_KIND_LABEL = { text: '본문', large: '큰 글자', ui: 'UI' } as const;

export function ColorSection() {
  return (
    <Section
      id="colors"
      kicker="토큰 · 색 (P2-09)"
      title="색"
      description="값은 src/lib/design/tokens.ts 원본에서 읽고, 대비는 같은 파일의 contrastRatio로 이 자리에서 계산합니다. '바탕'·'카드'는 그 색을 글자로 썼을 때의 대비예요 (장식 전용 색은 글자로 쓰지 않음)."
    >
      {COLOR_GROUPS.map(([group, names]) => (
        <div key={group} className="space-y-2">
          <h3 className="font-display text-h3">{group}</h3>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {names.map((name) => (
              <li
                key={name}
                className="flex gap-3 rounded-2xl bg-card p-3 shadow-card"
                data-testid={`color-${name}`}
              >
                <span
                  className="size-14 shrink-0 rounded-xl ring-1 ring-border"
                  style={{ background: cssVar(name) }}
                  aria-hidden
                />
                <span className="min-w-0 space-y-0.5">
                  <span className="block font-semibold">{name}</span>
                  <span className="block font-mono text-caption text-foreground">
                    {COLOR[name]}
                  </span>
                  <span className="block font-mono text-caption break-all text-muted-foreground">
                    {colorVarName(name)}
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    {COLOR_ROLE[name]}
                  </span>
                  <span className="block text-caption">
                    바탕 {fmtRatio(contrastRatio(COLOR[name], COLOR.bg))} · 카드{' '}
                    {fmtRatio(contrastRatio(COLOR[name], COLOR.surface))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="space-y-2">
        <h3 className="font-display text-h3">
          글자 조합 {CONTRAST_PAIRS.length}쌍 (모두 AA)
        </h3>
        <div className="overflow-x-auto rounded-2xl bg-card shadow-card">
          <table className="w-full min-w-[40rem] text-left text-small">
            <caption className="sr-only">CONTRAST_PAIRS 대비 표</caption>
            <thead className="text-caption text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-semibold">견본</th>
                <th className="px-3 py-2 font-semibold">글자 / 배경</th>
                <th className="px-3 py-2 font-semibold">쓰임</th>
                <th className="px-3 py-2 font-semibold">기준</th>
                <th className="px-3 py-2 font-semibold">대비</th>
              </tr>
            </thead>
            <tbody>
              {CONTRAST_PAIRS.map((p) => {
                const ratio = pairContrast(p);
                const ok = ratio >= CONTRAST_MIN[p.kind];
                return (
                  <tr
                    key={`${p.fg}-${p.bg}-${p.over ?? ''}-${p.use}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-1.5">
                      <span
                        className="inline-flex min-h-8 items-center rounded-md px-2 font-semibold"
                        style={{
                          color: cssVar(p.fg),
                          background: pairBackground(p),
                        }}
                      >
                        가나 Aa
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-caption">
                      {p.fg} / {p.over ? `${p.bg}@${p.alpha ?? 1}+${p.over}` : p.bg}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.use}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {PAIR_KIND_LABEL[p.kind]} {CONTRAST_MIN[p.kind]}
                    </td>
                    <td
                      className={cn(
                        'hud-num px-3 py-1.5 font-semibold',
                        ok ? 'text-success' : 'text-destructive',
                      )}
                    >
                      {fmtRatio(ratio)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────────── 글자

/** Tailwind가 찾을 수 있게 클래스 이름을 그대로 적는다 (`text-${name}`처럼 만들면 CSS가 생기지 않음) */
const TYPE_CLASS: Record<TypeName, string> = {
  hero: 'text-hero',
  heroWide: 'text-hero-wide',
  h1: 'text-h1',
  h2: 'text-h2',
  h3: 'text-h3',
  button: 'text-button',
  buttonLg: 'text-button-lg',
  body: 'text-body',
  small: 'text-small',
  caption: 'text-caption',
  kicker: 'text-kicker',
  code: 'text-code',
};
const FONT_CLASS = {
  display: 'font-display',
  sans: 'font-sans',
  mono: 'font-mono',
} as const;
const TYPE_SAMPLE: Record<TypeName, string> = {
  hero: '코드 주문으로 모험 지도를 채워라!',
  heroWide: '코드 주문으로 모험 지도를 채워라!',
  h1: '숲 마을 1권',
  h2: '오늘의 퀘스트',
  h3: '첫 번째 인사',
  button: '코드 돌려보기!',
  buttonLg: '모험 시작!',
  body: '파이뱀 선생님과 퀘스트를 깨면 지도에 잉크 길이 그려져요. 한 권을 다 읽으면 다음 모험이 열려요.',
  small: '힌트를 보면 별이 하나 줄어들어요.',
  caption: '경험치 · 3분 전',
  kicker: '그림책 1권 · 숲 마을',
  code: 'print("안녕, 파이뱀!")  # 인사',
};

export function TypeSection() {
  return (
    <Section
      id="type"
      kicker="토큰 · 글자 (P2-09·P2-10)"
      title="글자"
      description="제목·버튼·큰 숫자는 Jua, 본문은 pyRoad Sans(Pretendard), 코드는 pyRoad Mono(D2Coding, 짝수 px). 본문 17px · 행간 1.7 · keep-all, 14px 미만 없음."
    >
      <div className="divide-y divide-border rounded-2xl bg-card shadow-card">
        {(Object.keys(TYPE) as TypeName[]).map((name) => {
          const t = TYPE[name];
          return (
            <div
              key={name}
              className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"
            >
              <p className="text-caption text-muted-foreground">
                <b className="text-foreground">{name}</b>
                <br />
                {t.size}px · {t.lineHeight} · {t.font}
                {'weight' in t ? ` · ${t.weight}` : ''}
              </p>
              <p
                className={cn(
                  TYPE_CLASS[name],
                  FONT_CLASS[t.font],
                  name === 'kicker' && 'text-primary-text',
                  'min-w-0 break-keep',
                )}
              >
                {TYPE_SAMPLE[name]}
              </p>
            </div>
          );
        })}
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <p className="text-caption text-muted-foreground">
            <b className="text-foreground">HUD 숫자</b>
            <br />
            .hud-num 고정 폭 숫자
          </p>
          <p className="flex flex-wrap gap-6 font-display text-button-lg">
            <span className="hud-num">1,234</span>
            <span className="hud-num">9,999</span>
            <span className="hud-num">111</span>
          </p>
        </div>
      </div>
    </Section>
  );
}

// ───────────────────────────── 반경·그림자·간격·선

export function ShapeSection() {
  return (
    <Section
      id="shape"
      kicker="토큰 · 모양 (P2-09)"
      title="반경 · 그림자 · 간격 · 선"
      description="테두리 없는 면 + 버튼 아랫면 3px, 그림자는 카드 한 종류와 떠 있는 층 하나. 간격은 4px 단위."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Demo label="반경" note="작은 칩·입력 10 · 카드·버튼 14 · 시트·큰 카드 20 · 원형">
          <div className="flex flex-wrap items-end gap-4">
            {(
              [
                ['s', 'rounded-md'],
                ['m', 'rounded-xl'],
                ['l', 'rounded-2xl'],
                ['pill', 'rounded-full'],
              ] as const
            ).map(([k, cls]) => (
              <div key={k} className="flex flex-col items-center gap-1">
                <span className={cn('size-16 bg-primary-soft ring-1 ring-primary-text/30', cls)} />
                <span className="text-caption text-muted-foreground">
                  {k} {RADIUS[k] > 999 ? '원형' : `${RADIUS[k]}px`}
                </span>
              </div>
            ))}
          </div>
        </Demo>
        <Demo label="그림자" note="card(기본) · pop(시트·토스트·덮개 위)">
          <div className="flex flex-wrap gap-4">
            {(
              [
                ['card', 'shadow-card'],
                ['pop', 'shadow-pop'],
              ] as const
            ).map(([k, cls]) => (
              <div
                key={k}
                className={cn('w-36 space-y-1 rounded-xl bg-card p-3', cls)}
                title={SHADOW[k]}
              >
                <p className="font-semibold">{k}</p>
                <p className="font-mono text-caption break-all text-muted-foreground">
                  shadow-{k}
                </p>
              </div>
            ))}
          </div>
        </Demo>
        <Demo
          label="간격"
          note={`4px 단위 · 터치 최소 ${SPACE.touch}px (min-h-touch) · 모바일 좌우 여백 ${SPACE.gutter}px (px-gutter)`}
        >
          <div className="space-y-1">
            {SPACE.scale.map((px) => (
              <div key={px} className="flex items-center gap-3">
                <span className="hud-num w-10 text-caption text-muted-foreground">
                  {px}
                </span>
                <span
                  className="h-3 rounded-full bg-primary"
                  style={{ width: px * 2 }}
                />
              </div>
            ))}
          </div>
        </Demo>
        <Demo
          label="선"
          note={`테두리는 입력·코드 상자 ${LINE.ui}px만 · 버튼 아랫면 ${LINE.lip}px · 포커스 링 ${LINE.focus}px + 간격 ${LINE.focusOffset}px`}
        >
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex min-h-touch items-center rounded-md border border-input bg-card px-3 text-small">
              입력 경계
            </span>
            <Button variant="secondary" size="sm" sfx={false}>
              아랫면 3px
            </Button>
            <span className="inline-flex min-h-touch items-center rounded-xl bg-card px-3 text-small outline-2 outline-offset-2 outline-ring">
              포커스 링
            </span>
          </div>
        </Demo>
      </div>
    </Section>
  );
}

// ───────────────────────────── 월드 테마

export function WorldSection() {
  return (
    <Section
      id="worlds"
      kicker="토큰 · 월드 테마 (P2-09)"
      title="월드 테마"
      description='같은 디자인 시스템 위에서 [data-world="1|2|3"]이 --world·--world-ink·--world-soft만 바꿉니다 (지도·표지 배경에만 옅게).'
    >
      <div className="grid gap-4 md:grid-cols-3">
        {([1, 2, 3] as WorldId[]).map((id) => {
          const t = WORLD_THEMES[id];
          return (
            <div
              key={id}
              data-world={id}
              className="overflow-hidden rounded-2xl bg-world-soft shadow-card"
              data-testid={`world-${id}`}
            >
              <div className="h-12 bg-world" aria-hidden />
              <div className="space-y-1 p-4">
                <p className="text-kicker text-world-ink">{id}권</p>
                <p className="font-display text-h3">월드 {id} 표지</p>
                <p className="text-caption text-muted-foreground">
                  {t.tint} · {t.ink} · {t.soft}
                </p>
                <p className="text-caption">
                  표지 글자{' '}
                  {fmtRatio(contrastRatio(COLOR[t.ink], COLOR[t.soft]))} · 본문{' '}
                  {fmtRatio(contrastRatio(COLOR.text, COLOR[t.soft]))}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <CodeSample
        code={`<section data-world="2">\n  <div className="bg-world-soft text-world-ink">…</div>\n</section>`}
      />
    </Section>
  );
}

// ───────────────────────────── 모션 토큰

/**
 * 누르면 점이 반대편으로 움직인다. 지금 연출 단계를 따른다: 스프링(full·lite) → 150ms 페이드처럼 짧게(minimal) → 즉시(동작 줄이기).
 * 토큰 자체를 보려면 막대에서 full을 고른다
 */
function MotionDot({
  timing,
  testId,
}: {
  timing: { duration: number; easing: string };
  testId: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [right, setRight] = useState(false);
  const { reduced, budget } = useMotionTier();
  const play = () => {
    const el = ref.current;
    if (!el) return;
    const track = el.parentElement?.clientWidth ?? 200;
    const dist = Math.max(0, track - el.offsetWidth);
    const from = `translateX(${right ? dist : 0}px)`;
    const to = `translateX(${right ? 0 : dist}px)`;
    el.style.transform = to;
    setRight(!right);
    if (reduced || !el.animate) return;
    el.animate(
      [{ transform: from }, { transform: to }],
      budget.springs
        ? timing
        : { duration: DURATION.fade, easing: EASING.out },
    );
  };
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        sfx={false}
        icon={<Play aria-hidden />}
        onClick={play}
        data-testid={testId}
      >
        재생
      </Button>
      <div className="relative h-6 min-w-0 flex-1 rounded-full bg-surface-2">
        <span
          ref={ref}
          className="absolute top-0 left-0 size-6 rounded-full bg-primary"
        />
      </div>
    </div>
  );
}

export function MotionTokenSection() {
  return (
    <Section
      id="motion-tokens"
      kicker="토큰 · 모션 (P2-09·P2-15)"
      title="모션 토큰"
      description="스프링은 리그와 공유하는 7종(질량 1). CSS는 springTiming()이 샘플링한 linear() 곡선(--spring-*). 재생은 지금 연출 단계를 따르니 토큰 그대로 보려면 full을 고르세요."
    >
      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card" data-surface="raised">
        <h3 className="font-display text-h3">스프링 7종</h3>
        {(Object.keys(SPRINGS) as SpringName[]).map((name) => {
          const s = SPRINGS[name];
          const t = springTiming(name);
          const zeta = s.c / (2 * Math.sqrt(s.k));
          return (
            <div
              key={name}
              className="grid items-center gap-2 sm:grid-cols-[13rem_minmax(0,1fr)]"
            >
              <p className="text-small">
                <b>{name}</b>{' '}
                <span className="text-caption text-muted-foreground">
                  k {s.k} · c {s.c} · ζ {zeta.toFixed(2)} · {t.duration}ms
                </span>
              </p>
              <MotionDot timing={t} testId={`spring-${name}`} />
            </div>
          );
        })}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl bg-card shadow-card">
          <table className="w-full text-left text-small">
            <caption className="px-4 pt-3 text-left font-display text-h3">
              길이 (DURATION)
            </caption>
            <tbody>
              {(Object.keys(DURATION) as DurationName[]).map((name) => (
                <tr key={name} className="border-b border-border last:border-0">
                  <th scope="row" className="px-4 py-1.5 font-medium">
                    {name}
                  </th>
                  <td className="hud-num px-4 py-1.5">{DURATION[name]}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card" data-surface="raised">
          <h3 className="font-display text-h3">easing (DURATION.slow로 재생)</h3>
          {(Object.keys(EASING) as EasingName[]).map((name) => (
            <div key={name} className="space-y-1">
              <p className="text-small">
                <b>{name}</b>{' '}
                <span className="font-mono text-caption text-muted-foreground">
                  {EASING[name]}
                </span>
              </p>
              <MotionDot
                timing={{ duration: DURATION.slow, easing: EASING[name] }}
                testId={`easing-${name}`}
              />
            </div>
          ))}
        </div>
      </div>
      <CodeSample
        code={`import { framerSpring, springOrFade, tierDuration } from '@/lib/motion/tokens';\nconst { budget } = useMotionTier();\n<m.div transition={springOrFade('body', budget)} />\nel.animate(frames, springTiming('prop'));`}
      />
    </Section>
  );
}
