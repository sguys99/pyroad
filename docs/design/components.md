# 공통 컴포넌트 (P2-11)

> - 시각 기준: 사용자가 승인한 최종 시안(§12-Q31) `design/prototypes/src/final/ui.tsx`·`reward.tsx`·`base.css`·`refine.css` (2차 수정: 테두리 없는 면 + 버튼 아랫면 3px, 그림자 한 종류, 반경 10/14/20, 중립 + 초록 + 금색)
> - 코드: `src/components/ui/` — `button.tsx`(Button·IconButton) · `card.tsx` · `alert-dialog.tsx`(확인 모달) · `sheet.tsx`(Sheet·Modal) · `toast.tsx` · `tabs.tsx` · `progress-bar.tsx` · `hud.tsx` · `speech-bubble.tsx` · `reward-icon.tsx` · `tooltip.tsx` · `use-count-up.ts`. 스타일은 `game-ui.css`(`globals.css`가 `@layer components`로 불러옴, 넘긴 Tailwind 클래스가 이김)
> - 값은 모두 토큰([tokens.md](tokens.md))만 쓴다(`npm run tokens:check`, CSS 계약 테스트 `src/components/ui/__tests__/game-ui-css.test.ts`). 모션은 [motion-guidelines.md](motion-guidelines.md)의 단계(full / lite / minimal)와 동작 줄이기(별개 축)를 따른다: CSS는 `<html data-motion data-reduced>`, JS는 `useMotionTier().budget`
> - P2-12 카탈로그(`/dev/design`, [catalog.md](catalog.md))는 각 절 끝의 **대표 상태** 목록을 그대로 진열한다. 단계별 대체는 그 페이지 위 막대에서 바꿔 보고 e2e(`design-catalog.spec.ts`)가 검사한다

## 0. 공통 규칙

| 항목 | 규칙 |
|---|---|
| 터치 | 누르는 것은 모두 48px 이상: 버튼 sm 45 + 아랫면 3, 아이콘 버튼 48(sm은 원 40 + 누르는 자리 48), 탭 칸 48 |
| 포커스 | `:focus-visible`에 2px `--ring`(짙은 중립, 배경 12.96 · 카드 14.24:1) + 2px 간격. 버튼은 면(face)에 링 |
| 흰 면 위 | 카드·시트·모달이 `data-surface="raised"`를 붙인다 → 안의 흰 버튼(secondary·danger)·진행바 홈은 보조 면(`surface-2`)으로 바뀌어 묻히지 않음(시안 refine.css) |
| 글자 | 버튼·제목·HUD 숫자 = Jua(`font-display`), 이름표·본문·글자 버튼 = pyRoad Sans. 14px 미만 없음 |
| 소리 | 소리는 유일한 정보가 아니다: 버튼 탭 소리와 함께 눌림 모양, 토스트 글자 등 |
| 랜딩 | 랜딩이 import하는 컴포넌트(Button·Modal)는 `@/lib/design/tokens`·사운드 매니페스트를 import하지 않는다 → 랜딩 글자 서브셋(`npm run fonts:check`)이 늘지 않음. 효과음 훅은 가벼운 `@/components/providers/soundContext` |

### 모션 단계별 동작 (한눈에)

| 컴포넌트 | full | lite | minimal | 동작 줄이기 |
|---|---|---|---|---|
| 버튼 눌림 | 3px 내려감 → 손 떼면 jellyB(602ms) + 찌그러짐 출렁임(WAAPI, 시안 `pressRelease`) | 3px → face 스프링(418ms) | 3px 즉시 오르내림 | 움직임 0, 면 색만 진해짐(`--press`) |
| 버튼 올려놓기(마우스) | 1px 뜸 | 1px | 1px(즉시) | 없음 |
| 누를 수 있는 카드 | 2px 뜸 · 1px 내려앉음, body 스프링 | face 스프링 | 즉시 | 움직임 0, 누르면 보조 면 색 |
| 모달·시트(넓은 화면) | 아래 24px · -1.5° · 96%에서 떠오름(body 스프링), 덮개 220ms 페이드 | 12px 미끄러짐 220ms | 페이드 150ms | 즉시(덮개도) |
| 바텀시트(모바일) | 아래에서 올라옴 360ms out | 220ms | 페이드 | 즉시 |
| 툴팁 | 95% → 100% + 페이드 140ms | 같음 | 페이드만 | 즉시 |
| 토스트 | 18px 아래 · -2°에서 body 스프링 | 12px 220ms | 페이드 150ms | 즉시 |
| 탭 엄지 | face 스프링 | 220ms out | 즉시 | 즉시 |
| 진행바 채움 | scaleX 700ms out + 오르면 빛 띠 한 번 | 490ms + 빛 띠 | 150ms, 빛 띠 없음 | 즉시, 빛 띠 없음 |
| HUD 숫자 | 카운트업 700ms + 칩 팝(prop 스프링) | 490ms + 팝 | 즉시 교체 + 금색 틴트 면 700ms | 즉시 교체 + 금색 틴트 면 |
| 말풍선 | 타자 효과 34ms/글자 + 깜빡이는 커서 | 같음 | 처음부터 전체 문장 | 전체 문장, 커서 멈춤 |

반복 연출은 말풍선 커서(바쁨 표시) 하나뿐이고 CSS opacity만, 동작 줄이기에서 멈춘다(로딩 표시 `animate-spin`도 `reduced:animate-none`).

## 1. 게임 버튼 `Button` · 아이콘 버튼 `IconButton`

**용도**: 화면의 모든 행동 버튼. 시안 `InkButton`: 테두리 없는 면 + 같은 계열의 진한 아랫면 3px(`--lip-h`), 누르면 아랫면만큼 내려간다.

| 변형 | 면 / 글자 / 아랫면 | 대비 | 쓰는 곳 |
|---|---|---|---|
| `primary` (기본) | `primary` / `onPrimary` / `primaryLip` | 글자 5.12, 눌림(동작 줄이기) 7.51, 면 vs 배경 4.66 | 화면당 주요 행동 하나 (코드 돌려보기, 다음 퀘스트로, 저장) |
| `secondary` | `surface`(흰 면 위 `surface2`) / `text` / `surfaceLip` | 14.24 / 12.07, 눌림 10.22 | 보조 행동 (멈추기, 그만두기, 힌트 받기) |
| `reward` | `accent` / `onAccent` / `accentLip` | 7.66, 눌림 4.74 | 보상·특별 행동 (황금키, 보상 받기) |
| `danger` | `surface`(`surface2`) / `error` / `surfaceLip` | 5.68 / 4.82, 눌림(`errorSoft`) 4.88 | 되돌릴 수 없는 행동 (탈퇴, 리셋, 신고). 색을 늘리지 않으려 빨간 면 대신 오류색 글자 |
| `ghost` | 면 없음 / `text`, 1px `lineStrong` 밑줄(offset 4px), 올려놓으면 `primaryText` | 12.96 / 5.18 | 글자 버튼 (더 보기, 건너뛰기) |

크기: `sm` 45px(+3, 반경 10, 16px) · `md` 48px(+3, 반경 14, 18px) · `lg` 54px(+3, 반경 14, 20px). 비활성은 변형과 상관없이 `surface2` 면 + `textMuted`(4.94) 글자, 아랫면에 내려앉은 납작한 모양, 색 있는 아이콘은 55%.

**props** (`Omit<BaseUI Button.Props, 'className'>` +)

| prop | 타입 | 기본 | 설명 |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'reward' \| 'danger' \| 'ghost'` | `primary` | |
| `size` | `'sm' \| 'md' \| 'lg'` | `md` | |
| `icon` · `iconRight` | ReactNode | — | 글자 앞·뒤 아이콘 (1.15em으로 맞춤). `aria-hidden`을 붙여 넘긴다 |
| `loading` | boolean | false | 앞 아이콘 자리에 도는 표시 + `aria-busy` + 누를 수 없음. 변형 색은 유지 |
| `sfx` | `SfxId \| false` | primary·reward = `tap`, 나머지 없음 | 다른 소리를 내는 버튼(실행 `run`, 힌트, 축하 CTA)은 `false` |
| `href` | string | — | Next `<Link>`로 그림 (역할은 link 그대로) |
| `pressed` | boolean | false | 눌린 모양 고정 (카탈로그용) |
| `render` · `nativeButton` | Base UI | — | 대화 상자 Trigger·Close가 이 버튼을 그릴 때 |

**접근성**: 네이티브 `<button>`(또는 링크), 글자가 이름. 키보드 Space·Enter에도 눌림 모양(`data-pressed`). 로딩 중 `aria-busy`, 비활성은 `disabled`.

`IconButton`: `label`(필수 `aria-label`) · `size` `md`(48 보조 면 원) / `sm`(투명 40 원 + 48 누르는 자리) · `pressed`(눌린 모양 고정, 카탈로그용). HUD 소리 토글, 시트·토스트 닫기.

```tsx
<Button size="lg" icon={<Play aria-hidden />} loading={running} sfx={false}>코드 돌려보기!</Button>
<Button variant="secondary" icon={<Square aria-hidden />}>멈추기</Button>
<Button variant="reward" size="sm" icon={<RewardIcon kind="key" size={22} />}>황금키</Button>
<Button href={`/quest/${id}`} className="w-full">다음 퀘스트로 →</Button>
<IconButton label="닫기"><X aria-hidden /></IconButton>
```

**대표 상태**: 5변형 × 3크기 × {기본, 올려놓기, 눌림(`pressed`), 로딩, 비활성, 포커스} + 아이콘 앞·뒤·없음 + 흰 면(카드) 위 secondary·danger + 동작 줄이기에서 눌림(면 색). IconButton md·sm × {기본, 눌림, 포커스}.

## 2. 카드 `Card` · `CardButton` · `CardTitle` · `CardDescription`

**용도**: 정보 묶음. 테두리 없이 흰 면 + `shadow-card`. `radius` `m`(14, 기본) · `l`(20, 큰 카드·패널), `padding` `none`·`sm`(12)·`md`(16, 기본)·`lg`(24). `data-surface="raised"`.

`CardButton`: 카드 전체가 버튼(`href`면 링크). 올려놓으면 2px 뜨고 누르면 내려앉음(§0 표), `focus-ring`. 카드 안에 다른 버튼을 넣지 않는다(중첩 상호작용 금지).

`CardTitle` = Jua `text-h3`, `CardDescription` = `text-small` `textMuted`(카드 위 5.83).

```tsx
<Card radius="l" className="space-y-3"><CardTitle>오늘의 퀘스트</CardTitle>…</Card>
<CardButton href="/quest/abc"><CardTitle>첫 번째 인사</CardTitle></CardButton>
```

**대표 상태**: Card m·l × padding 4종, 안에 secondary 버튼·진행바(보조 면으로 바뀜). CardButton {기본, 올려놓기, 눌림, 포커스} × 버튼·링크.

## 3. 확인 모달 `AlertDialog*`

**용도**: 되묻기(지울까요?·탈퇴할까요?·신고할까요?). Base UI AlertDialog: `role="alertdialog"`, 포커스 가두기, Esc, 바깥 스크롤 잠금, 닫으면 연 버튼으로 포커스 복귀. 덮개 `bg-scrim`(덮개 위 흰 글자 최악 4.59), 상자 흰 면 + `shadow-pop` + 반경 20, 패딩 24.

부품: `AlertDialog`(Root) · `Trigger`(`render={<Button …/>}`로 게임 버튼) · `Content`(`size` `default` 28rem / `sm` 22rem, sm은 버튼 두 칸 격자) · `Header` · `Media`(48 원) · `Title`(Jua h3) · `Description`(`text-small` muted) · `Footer`(모바일 세로 역순, sm 이상 가로 오른쪽) · `Action`(게임 버튼, 기본 primary) · `Cancel`(기본 secondary).

```tsx
<AlertDialog>
  <AlertDialogTrigger render={<Button variant="danger" size="sm" />}>탈퇴하기</AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>정말 탈퇴하시겠어요?</AlertDialogTitle><AlertDialogDescription>…</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction variant="danger">탈퇴하기</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**대표 상태**: default·sm × {제목+설명, Media 있음} × 버튼 {primary 확인, danger 확인, 로딩} + 360폭(세로 버튼) · 동작 줄이기(즉시).

## 4. 바텀시트 `Sheet` · 모달 `Modal`

**용도**: 화면 위에 뜨는 긴 내용(설정 묶음, 안내, 고르기). 시안 `Sheet`: **모바일은 아래에서 올라오는 시트**(위 모서리 20, 손잡이 표시, safe-area 여백), **768px 이상은 가운데 대화 상자**(35rem, `wide` 45rem). `Modal`은 늘 가운데(28rem). Base UI Dialog(`role="dialog"` `aria-modal`, 포커스 가두기·Esc·덮개 누르기·포커스 복귀).

| prop | 설명 |
|---|---|
| `open` · `defaultOpen` · `onOpenChange` · `trigger` | 제어·비제어 둘 다 |
| `title` (필수) · `hideTitle` · `description` | 대화 상자 이름·설명 (`aria-labelledby`·`describedby`) |
| `media` · `align` | 제목 위 그림, 머리글 가운데 정렬 (인앱 브라우저 안내) |
| `footer` | 버튼 줄 (모바일 세로 역순) |
| `closeLabel` · `showClose` | 오른쪽 위 48px 닫기 버튼 (기본 "닫기") |
| `initialFocus` | 처음 포커스 (기본 첫 포커스 가능한 요소) |
| `wide` (Sheet) | 넓은 화면 45rem |

시트 안에서 닫는 버튼: `<SheetClose render={<Button variant="secondary" />}>그만두기</SheetClose>`. 끌어서 닫기는 넣지 않았다(선택 항목, 닫기 버튼·Esc·덮개로 충분, 필요하면 Base UI Drawer 검토).

**대표 상태**: Sheet 360(아래 시트·손잡이) · 1280(가운데) · wide · 긴 내용 스크롤, Modal 기본·media+가운데. 열리는 중(full·lite·minimal)·동작 줄이기.

## 5. 토스트 `ToastRegion` · `Toast` · `useToastQueue` · `ToastViewport`

**용도**: 짧은 알림(저장했어요, 잠긴 스테이지). 시안의 담백한 쪽지: 흰 면(또는 의미색 틴트) + `shadow-pop` + 반경 14, 화면 아래 가운데(최대 26.25rem, safe-area 위). 글자 `text-small` 15px.

| tone | 면 | 글자 대비 |
|---|---|---|
| `info` | `surface` | 14.24 |
| `good` | `successSoft` | 12.21 |
| `warn` | `warningSoft` | 12.69 |
| `error` | `errorSoft` | 12.22 |

- **`ToastRegion`은 늘 떠 있는 `role="status"` `aria-live="polite"` 영역**: 화면에 먼저 두고 그 안에 `Toast`를 넣어야 낭독기가 새 알림을 읽는다.
- `Toast` props: `tone` · `icon`(36 원) · `duration`(ms, 기본 4000, 0이면 저절로 안 닫힘; 끝나기 140ms 전 흐려짐) · `onClose`(있으면 닫기 버튼, 바로 닫힘) · `closeLabel`.
- 여러 개: `const { toasts, show, dismiss } = useToastQueue(3)` + `<ToastViewport toasts={toasts} onDismiss={dismiss} />`.

**대표 상태**: 4 tone × {아이콘 있음/없음} × {닫기 버튼 있음/없음}, 두 줄 문구, 쌓인 3개, 360폭.

## 6. 세그먼트 탭 `SegmentedTabs`

**용도**: 같은 화면 안의 보기 바꾸기(퀘스트 모바일 이야기/코드/결과). 시안 `.f-seg`: 보조 면 알약 안에서 주색 엄지가 미끄러짐. 고른 칸 글자 `onPrimary` on `primary` 5.12, 나머지 `text` on `surface2` 12.07.

props: `items`(`{ value, label, icon?, panelId? }[]`) · `value` · `onValueChange` · `aria-label`(필수) · `idBase`(탭 id `<idBase>-<value>`, 패널 `aria-labelledby`용).

**접근성**: `role="tablist"`·`tab`·`aria-selected`, roving tabindex(고른 탭만 Tab 순서), ←/→(끝에서 돌아감)·Home·End로 옮기며 바로 고름(자동 활성화), `panelId`가 있으면 `aria-controls`. 칸 너비는 같다(엄지가 transform 하나로 움직이게).

**대표 상태**: 2·3·4칸 × 각 칸 선택, 포커스 링, 아이콘 있는 칸, 360 꽉 찬 폭.

## 7. 진행바 `ProgressBar`

**용도**: XP·스테이지·퀘스트 진행. 시안 `InkProgress`: 보조 면 홈 + 주색(또는 금색) 채움, 원형 끝. **채움은 `transform: scaleX()`만** 움직인다.

| prop | 기본 | 설명 |
|---|---|---|
| `value` · `max` | — · 100 | 넘치면 자름 |
| `label` 또는 `aria-labelledby` | — | 이름 (필수) |
| `valueText` | 백분율 | 낭독기가 읽을 값 ("120 / 200 XP") |
| `tone` | `primary` | `reward` = 금색 |
| `size` | `md` 10px | `sm` 6px · `lg` 14px |
| `animateOnMount` | false | 화면에 들어올 때 0에서 채워 올라감 (월드맵·프로필 XP) |

값이 오르면 `data-rising`(a/b 번갈아)으로 빛 띠가 한 번 지나간다(full·lite). 채움 색은 장식(UI 3:1 대상 아님) — 값은 `aria-valuenow`·옆 글자로 함께 보여 준다.

**대표 상태**: 0 · 40 · 100% × primary·reward × sm·md·lg, 오르는 순간(빛 띠), 흰 카드 위.

## 8. 재화 HUD `CurrencyHud` · `LevelSeal` · `HudCounter` · `useCountUp`

**용도**: 레벨·경험치·보물 한 줄. 시안 `Hud`: 레벨 도장(48 주색 원, "Lv" 14px + Jua 숫자) · XP 바(96px, "경험치" 캡션) · 코인·별·(퀘스트에서만) 황금키 칩(보조 면 알약 + 보상 아이콘 26 + Jua 20px 숫자) · 끝 자리(소리 토글).

- 숫자는 `hud-num`(고정 폭 숫자 + 최소 폭 3.2ch, 오른쪽 정렬) → 카운트업 중 칩 폭이 흔들리지 않음
- 값이 오르면 `useCountUp`(ease-out 3차, `DURATION.progress`, lite 70%, minimal·동작 줄이기 즉시) + 칩 팝(`scale(1.25) rotate(-4deg)` → 제자리, prop 스프링). minimal·동작 줄이기는 칩을 `accentSoft`로 700ms(색만, 글자 12.69)
- 640px 미만: 칸 사이를 좁히고 숫자 18px, "경험치"는 낭독기에만, 1만 이상은 `formatCompact`("1.2만", "1.5억")
- 낭독기: 그룹 "내 레벨과 보물", 도장 "레벨 3", 칩 "코인 1,234개"(보이는 숫자는 `aria-hidden`이라 카운트업 중간값을 읽지 않음), XP 바 "다음 레벨까지 경험치"

```tsx
<CurrencyHud level={3} xp={{ value: 40, max: 100 }} coins={1280} stars={14} keys={2} end={<SoundToggle />} />
```

지금 앱에는 코인·별 재화가 없어 `CurrencyHud` 전체는 아직 화면에 없다(Phase 4~6 HUD 개편에서). 퀘스트 상태바가 `LevelSeal`(sm 40px)·`useCountUp`을, 월드맵·퀘스트 헤더가 소리 토글(`IconButton`)을 쓴다.

**대표 상태**: 전체(코인·별·키·소리) 1280·360, 키 없음(월드맵), 큰 수(12,345 → 1.2만), 값 오름 순간(팝·카운트업)·동작 줄이기(금색 틴트), LevelSeal md·sm·두 자리.

## 9. 말풍선 `SpeechBubble`

**용도**: 마스코트·튜터 대사. 시안 `Bubble`: 흰 면 + 그림자 한 종류 + 반경 14 + 꼬리, 위에 화자 이름표(14px 700, `primaryText` 5.69).

| prop | 설명 |
|---|---|
| `speaker` · `speakerIcon` · `badge` | 이름표, 앞 아이콘, 뒤 배지("저장된 답변") |
| `tone` | `tutor`(흰 면) · `good`(`successSoft`) · `bug`(`errorSoft`, 이름표 `error` 4.88) · `quiet`(`surface2`, 그림자 없음) |
| `tail` | `left`(왼쪽 캐릭터) · `top` · `none` |
| `text` + `typing` · `onTypingDone` | 문자열 대사의 타자 효과 (34ms/글자) |
| `children` | 마크다운 등 아무 내용 (`text`가 없을 때) |

타자 효과는 **전체 문장을 처음부터 배치하고 아직 안 나온 글자만 `visibility: hidden`** → 상자 크기가 흔들리지 않는다. 보이는 글자는 `aria-hidden`이고 `sr-only`에 전체 문장이 있어 낭독기는 한 번에 읽는다. minimal·동작 줄이기는 처음부터 전체 문장. 스트리밍 대사(AI 튜터)는 `children` + `.g-caret` 커서.

**대표 상태**: 4 tone × 꼬리 3종, 타자 중(커서)·끝, 긴 대사 두 줄 이상, 배지 있는 이름표, 360폭.

## 10. 보상 아이콘 `RewardIcon` · `Stars`

시안 `reward.tsx`를 옮김: 금색 하나(`accent`) + 그 진한 톤 1px 안팎(`accentLip`) + 밝은 쪽(`accentLight`), 빈 별은 `line` + 옅은 `lineStrong`. 색은 Tailwind 토큰 클래스(`fill-accent` …)라 이모지·하드코딩 색이 없다. `kind` `coin`·`star`·`starEmpty`·`key`, `size`(px, 보기 상자 32), `label`이 있으면 `role="img"`, 없으면 장식.

`Stars n max size label`: 화면 낭독기에 "별 2개 / 3개" 한 번.

**대표 상태**: 4종 × 20·26·34px, Stars 0~3, 비활성 버튼 안(55%).

## 11. 툴팁 `Tooltip*`

shadcn(Base UI) 툴팁을 토큰으로: 짙은 면 `secondary` + 흰 글자 14px(14.24:1), 반경 10, `shadow-pop`. 등장 `.g-tooltip`(§0 표).

## 12. 지금 앱에 적용한 곳 (화면 개편은 Phase 4~6)

| 컴포넌트 | 사용처 |
|---|---|
| Button | 실행·멈추기·실행기 다시 불러오기·다음 퀘스트로(CodePanel·QuestWorkspace), 힌트·황금키(ConversationPanel), 축하 CTA(`celebration-cta`), Google로 시작하기(랜딩), 인앱 브라우저 안내, 설정 저장, 계정 관리, 신고·삭제 대화 상자, 게시판·공지·댓글 등록 |
| IconButton | HUD 소리 토글(`SoundToggle`), 시트·토스트 닫기 |
| Card | 월드맵 프로필 요약, 프로필 카드 4개, 계정 관리 |
| AlertDialog | 신고, 글·공지 삭제, 리셋·탈퇴(2단계) |
| Modal | 인앱 브라우저 안내(포커스 가두기·Esc 생김) |
| Toast | 잠긴 스테이지 안내(B38) |
| SegmentedTabs | 퀘스트 모바일 이야기/코드/결과 |
| ProgressBar | XP 막대(`XPProgressBar`), 프로필 스테이지 진행률 |
| LevelSeal · useCountUp | 퀘스트 상태바 |
| SpeechBubble | 튜터 대사·스트리밍·생각 중 |
| RewardIcon | 황금키 버튼·남은 개수, 황금키 확인 카드 |
| Tooltip | 힌트·황금키 안내 |
