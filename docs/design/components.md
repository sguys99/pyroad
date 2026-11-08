# 공통 컴포넌트 (P2-11)

> - 시각 기준: 사용자가 승인한 최종 시안(§12-Q31) `design/prototypes/src/final/ui.tsx`·`reward.tsx`·`base.css`·`refine.css` (2차 수정: 테두리 없는 면 + 버튼 아랫면 3px, 그림자 한 종류, 반경 10/14/20, 중립 + 초록 + 금색)
> - 코드: `src/components/ui/` — `button.tsx`(Button·IconButton) · `card.tsx` · `alert-dialog.tsx`(확인 모달) · `sheet.tsx`(Sheet·Modal) · `toast.tsx` · `tabs.tsx` · `progress-bar.tsx` · `hud.tsx` · `speech-bubble.tsx` · `reward-icon.tsx` · `tooltip.tsx` · `use-count-up.ts`. 스타일은 `game-ui.css`(버튼·아이콘 버튼·말풍선, `globals.css`가 `@layer components`로 불러옴, 넘긴 Tailwind 클래스가 이김)와 컴포넌트가 직접 import하는 조각 `card.css`·`tooltip.css`·`overlay.css`(덮개·모달·시트)·`toast.css`·`tabs.css`·`progress-bar.css`·`hud.css`(P4-12: 랜딩 렌더 차단 CSS 예산)
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
| 바텀시트(모바일) | 아래에서 body 스프링으로 올라옴(넘침은 아래 치마 면이 가림, P4-09), 닫힘 220ms | 220ms | 페이드 | 즉시 |
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
| `closeOnBack` | 기기·브라우저 뒤로 가기로 닫기 (P4-09, `use-back-to-close.ts`): 열면 같은 주소로 기록 항목 하나(지금 `history.state` 복사), 뒤로 가기면 닫히고 화면은 그대로, 다른 방법으로 닫으면 그 항목을 거둠. 랜딩 로그인 시트가 켬 |
| `wide` (Sheet) | 넓은 화면 45rem |

시트 안에서 닫는 버튼: `<SheetClose render={<Button variant="secondary" />}>그만두기</SheetClose>`. 끌어서 닫기는 넣지 않았다(선택 항목, 닫기 버튼·Esc·덮개로 충분, 필요하면 Base UI Drawer 검토).

주의 (P4-09): **처음부터 `open`인 채로 마운트하면 Base UI가 등장 전환을 건너뛴다.** 늦게 불러와 여는 시트는 닫힌 채 한 번 그린 다음 프레임에 연다(`useLazyLoginSheet`). 제목 글자색은 상자에서 물려받는다: `cn`(tailwind-merge)이 `text-h2`·`text-foreground` 같은 크기 토큰과 색을 한 무리로 보고 앞의 것을 지운다(제목이 17px로 나오던 원인).

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
- 버튼 하나 (P4-11): `action={<Button size="sm">추가하기</Button>}` — 글 뒤, 닫기 앞. 행동을 고를 때까지 남아야 하므로 `duration={0}`과 함께 쓴다(월드맵 "홈 화면에 추가" 쪽지).

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

## 12. 소셜 로그인 버튼 `SocialLoginButton` · `SocialLoginButtons` · 로그인 시트 `LoginSheet` · `LoginSheetButton` (P3-05)

**용도**: 카카오·네이버·Google 로그인. 코드 `src/components/auth/` (스타일 `social-login.css` — 버튼 컴포넌트가 import, 로고·문구 `brandMarks.tsx`). 로그인 호출은 provider마다 **`useSocialLogin(provider)`(P1-14 헬퍼)로만** 한다(버튼이 Supabase를 직접 부르지 않음).

게임 버튼과 다른 점: 각 사 가이드가 면 색·글자색·로고를 정해 두어 **아랫면(lip)을 붙이지 않는다**(카카오는 규정 밖 색 금지라 진한 노랑 아랫면도 안 됨, Google은 흰 면 + 1px 테두리 고정). 그래서 브랜드 색은 pyRoad 토큰이 아니라 `social-login.css`의 provider별 사용자 정의 속성이고(테마를 바꿔도 그대로, [tokens.md](tokens.md) §6), 눌림은 1px 움직임 + 얇은 상태 층으로만 알린다.

| provider | 면 | 글자 | 로고 | 문구 | 가이드 (2026-11-06 확인) |
|---|---|---|---|---|---|
| 카카오 | `#FEE500` | `#000000` 85% (대비 12.5:1) | 말풍선 심볼 `#000000`, 20px | 카카오 로그인 (가이드 완성형) | [카카오 로그인 디자인 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/design-guide): radius 12px, 레이블 높이 ≤ 컨테이너 1/3, 늘리면 심볼+레이블 묶음은 가운데, 심볼 형태·비율·색 변경 금지. 심볼 경로는 카카오 리소스 미리 보기 SVG에서 떼어 옴 |
| 네이버 | **`#03A94D`** | `#FFFFFF` (대비 3.09:1 → 19px 굵게 = WCAG 큰 글자 AA. 옛 `#03C75A`였다면 2.25:1로 미달) | N 로고 `#FFFFFF`, 17px | 네이버 로그인 (공식 애셋 문구) | [네이버 로그인 버튼 사용 가이드](https://developers.naver.com/docs/login/bi/bi.md): 지정 녹색이 `#03C75A` → `#03A94D`로 바뀜(계획서의 `#03C75A`는 옛 값), 로고·레이블 흰색(**Phase 2의 "글자색 확인" = 흰색**), N 로고 완성형 16px 이상, 레이블은 로고 높이보다 작게, 가운데 정렬이면 간격 8px. N 경로는 공식 PNG 애셋(4배)에서 재어 옮김 |
| Google | `#FFFFFF` + 1px 안쪽 테두리 `#747775` | `#1F1F1F` (16.5:1), 테두리 4.5:1 | 4색 G, 20px | Google로 로그인 | [Sign in with Google 브랜딩 가이드](https://developers.google.com/identity/branding-guidelines): 밝은 테마 색, 문구 현지화 허용, 비율 유지, 다른 버튼보다 덜 눈에 띄게 두지 않음. G는 GIS 버튼 라이브러리가 지금 그리는 4색 경로 그대로 |

**어긋남과 이유**
- 글꼴: 카카오는 "OS 기본 시스템 서체", Google은 Google Sans Medium을 권하지만 세 버튼 모두 pyRoad Sans 700(Pretendard, 시스템 한글 고딕과 같은 계열)으로 통일했다. Google Sans는 자체 호스팅할 수 있는 라이선스가 아니다.
- Google G: 브랜딩 페이지의 새 다운로드 묶음은 그라디언트 "super G"(Figma 내보내기, `foreignObject` 원뿔 그라디언트 + 흐림 필터)다. Safari의 `foreignObject` 렌더 차이와 무게 때문에, Google이 GIS 공식 버튼에서 **지금도 그리는** 4색 G 경로를 썼다(2026-11-06 `credential_button_library`에서 확인). GIS가 바꾸면 따라 바꾼다.
- Google 문구: GIS 기본 한국어 "Google 계정으로 로그인"은 320px 화면 시트(안쪽 288px)에서 한 줄에 들어가지 않아 같은 뜻의 "Google로 로그인"을 쓴다(가이드: 현지화 허용, Google 자격 증명으로 로그인함이 분명할 것).
- 크기: 세 버튼 높이 54px(게임 버튼 lg 면과 같음, 터치 48 이상), 반경 12px(카카오 규정을 세 버튼에 같게). 네이버 기본 애셋 반경(약 8px)과 다르지만 네이버 가이드는 반경을 정하지 않는다.
- 상태 층: 올려놓기·눌림 때 면 위에 짙은 중립(`--text`) 5%·10%를 얹는다. 면 색 자체는 바꾸지 않는다.

| 상태 | 모양 |
|---|---|
| 기본 | 로고 + 글자 묶음 가운데, 19px 굵게 |
| 올려놓기(마우스) | 1px 뜸 + 상태 층 5% |
| 눌림 | 1px 내려앉음 · 98.5% + 10% (full = face 스프링 · lite = 짧게 · minimal = 즉시 · 동작 줄이기 = 움직임 0, 색만) |
| 로딩 | 로고·글자 그대로 + 오른쪽 끝 바쁨 표시(`animate-spin reduced:animate-none`), `aria-busy`, 누를 수 없음 |
| 비활성 | 브랜드 색 그대로 45%로 흐리게 |
| 포커스 | 2px `--ring` + 2px 간격 |
| 오류 (묶음) | 버튼을 되살리고 아래에 "앗, 로그인을 시작하지 못했어요…" (`role="alert"`, 오류색 글자) |
| 큰 버튼 `size="lg"` (P3-09) | 60px · 21px 글자 · 로고도 같은 비율(카카오 레이블 높이 ≤ 1/3 유지). 카카오톡 인앱의 카카오 버튼 |
| 최근에 사용 (P3-08) | 그 버튼이 맨 위 + 오른쪽 위 모서리에 금색 알약 "최근에 사용"(`accent`/`onAccent` 7.66:1, 14px 굵게, 흰 테두리 2px, 위로 8px 나와 브랜드 면을 거의 덮지 않음). 등장 full = prop 스프링 팝 · lite = 220ms · minimal = 페이드 · 동작 줄이기 = 없음. 알약은 `aria-hidden`, 낭독기는 버튼 밖 문장 "최근에 ○○로 로그인했어요"를 `aria-describedby`로 읽음(버튼 이름은 브랜드 문구 그대로) |

**props**
- `SocialLoginButton`: `provider` · `loading` · `disabled` · `sfx`(기본 `tap`) · `recent`(최근에 사용 이름표, P3-08) · `size`(`md` 54px / `lg` 60px, P3-09) · `pressed`·`hovered`(카탈로그 고정) + 나머지 `<button>` 속성. 모양만, 호출 없음.
- `SocialLoginButtons`: `providers`(기본 `NEXT_PUBLIC_LOGIN_PROVIDERS`로 켠 것, 비우면 카카오 → 네이버 → Google 모두, P3-09) · `lastUsed`(P3-08: 맨 위로 + 이름표) · `onBeforeLogin(provider)`(분석 이벤트) · `preview(provider)`(카탈로그용 가짜 로그인) · `browser`(인앱 판별 결과를 직접 줌, 카탈로그·테스트) · `portalClassName`(인앱 안내 대화 상자 글꼴 변수) · `className`. 순서는 `orderProviders(providers, [카카오톡 인앱이면 kakao, lastUsed])`. 하나를 누르면 그 버튼만 바쁨·나머지 비활성(두 번 눌림 막음), 결과 `redirecting`이면 바쁨 유지, `external-browser`·`browser-guide`면 되살림, `error`면 되살리고 오류 문구. bfcache로 돌아오면(`pageshow`) 바쁨을 푼다. 인앱 처리(P3-09)는 아래 "인앱 브라우저".
- `LoginSheet`: `open` · `onOpenChange` · `cta`(분석 스키마 `landing_cta_click.cta` 값, provider를 고를 때 보냄) · `context`(머리말, P4-09: `hero` "어떤 계정으로 모험을 시작할까?" · `header` "어떤 계정으로 들어갈까?" · `trial` "모험을 저장하려면 로그인!", 주지 않으면 `cta`로) · `heading`(제목 직접) · `providers`(카탈로그) · `preview` · `className` · `lastUsed`(주지 않으면 열 때마다 이 기기 저장값 `readLastLogin()`, P3-08, 지금 숨긴 수단이면 기록 없음으로 봄). 최근 기록이 있으면 한마디가 "지난번엔 ○○로 들어왔어. 같은 계정으로 들어와야 모험이 이어져!"(자동 계정 연결이 없어서, §2.8), 없으면 "어떤 걸로 들어가도 돼. 다음에도 같은 걸로 들어와 줘!"(X3). `Sheet`(`closeOnBack`) + 손 흔드는 파이뱀(`PybaemRig state="wave"`, 닫혀 있으면 `paused`) + 제목 + 한마디 + 버튼 + 안내 두 줄("이름·사진은 다른 친구에게 보이지 않아요" · "만 14세가 안 된 친구는 들어온 뒤 보호자님과 함께 동의해요", P3-15). 최근 이름표는 full에서 팝 뒤 한 번 살랑(`rotate`, 1회), lite는 짧은 팝만.
- `LoginSheetButton`: 게임 버튼 props + `cta` · `context` · `heading`. 누르면 시트를 연다. 시트 모듈은 `useLazyLoginSheet`로 올려놓기·포커스 때 미리 받고, 누르면 닫힌 채 그린 뒤 다음 프레임에 연다(첫 열림에도 등장 연출, 첫 화면 JS 밖). 체험 성공 CTA(P4-03)는 `cta="trial"`(스키마에 값이 들어간 뒤) 또는 `cta="hero" context="trial"`. 시트는 body로 포털되므로 **랜딩 서브셋 글꼴 변수**(`displayLanding`·`sansLanding`)를 시트 상자에 직접 넘긴다(안 넘기면 제목이 Jua가 아니라 시스템 글꼴).

```tsx
<LoginSheetButton cta="hero" size="lg" iconRight={<Rocket aria-hidden />}>모험 시작하기</LoginSheetButton>
<SocialLoginButtons onBeforeLogin={(provider) => track('landing_cta_click', { cta, provider }, { immediate: true })} />
```

**대표 상태**: 세 버튼 × {기본, 올려놓기, 눌림, 로딩(누른 버튼 + 나머지 비활성), 비활성} + 흰 면 위 + 최근에 사용(세 provider 바꿔 보기·다시 보기) + 카카오톡 인앱(카카오 크게 + Google 안내 한 줄) + 인앱 Google 안내 대화 상자 + 로그인 실패 사유 7종(시트 · `/auth/error` 패널) + 로그인 계정 연결 4가지(Google만 · 카카오만 · 둘 · 셋) + 눌러 보기(가짜 로그인 → 오류) + 로그인 시트(히어로 · 헤더 · 체험 성공 머리말, 기록 없음 · 최근 = 카카오, 세 provider, 360 아래 시트 · 768 이상 가운데). 카탈로그 `#social-login`. 반응형·포커스 복귀·Esc·뒤로 가기·단계별 등장은 e2e `login-modal.spec.ts`.

**인앱 브라우저 (P3-09)**: 판별은 `detectInAppBrowser(ua?)`(판별표 테스트 `src/lib/browser/__tests__/detectInAppBrowser.test.ts`: 카카오톡·네이버 앱 iOS/Android, 인스타그램, 페이스북, 라인, 밴드, 그 밖 웹뷰, 일반 브라우저).
- **카카오톡 인앱**: 외부로 보내지 않는다. 카카오 버튼을 맨 위에 크게(`lg`) — 카카오톡 안에서 바로 로그인된다. 최근에 쓴 수단은 그다음
- **Google**만 누를 때 외부 브라우저로 보낸다(`needsExternalBrowser`, `signInWithOAuth` **전에**: PKCE verifier 쿠키가 시작한 브라우저에 남으므로). 인앱이면 버튼 아래 "Google 로그인은 Chrome·Safari 같은 브라우저에서 열려요" 한 줄. 외부 브라우저를 열었으면 "브라우저를 열었어요. 거기서 Google 로그인을 한 번 더 눌러 줘!", 열 수 없는 인앱(iOS 인스타그램 등)이면 `InAppBrowserGuide`: provider별 문구("앗! 여기서는 Google 로그인이 안 돼요" + 앱 이름 + 막는 이유) · 브라우저에서 열기 · 주소 복사 · **이 앱 안에서 바로 되는 카카오·네이버 버튼**(누르면 안내를 닫고 그 수단으로 로그인). 안내도 body로 포털되므로 랜딩 서브셋 글꼴 변수를 `portalClassName`으로 받는다
- **네이버**는 인앱 WebView에서도 되므로 외부로 보내지 않는다. Android(크롬·인앱)에서는 `queryParams: { appscheme: 'true' }`로 "네이버 앱으로 자동로그인" 버튼을 켠다(`NAVER_APPSCHEME_ON_ANDROID`, iOS는 값 없이도 보임). 실 앱 스모크 N-8에서 확인하고 문제가 있으면 상수만 끈다
- **공용 기기 모드** (P4-09, §12-Q44): 로그인 시트 버튼 아래 체크 `SharedDeviceCheck` "학교·도서관 컴퓨터예요" + 한 줄 설명(진짜 체크박스, 이름은 제목만·설명은 `aria-describedby`, 줄 전체 48px). 기본 꺼짐, 이 기기 `localStorage` `pyroad.sharedDevice.v1`(`src/lib/auth/sharedDevice.ts`, 저장소가 막히면 이 페이지 안에서만). 켜면 `getOAuthCredentials(…, { sharedDevice })`가 카카오·네이버 `prompt=login`, Google `prompt=select_account`(`SHARED_DEVICE_PARAMS`, 근거는 그 주석), 네이버 `appscheme`은 빼고, 카카오 scope 덮어쓰기와 한 객체로 합친다. 카카오톡 인앱에서는 체크를 숨기고 카카오 `prompt`도 뺀다(미지원). 켜져 있으면 최근 로그인 기록을 쓰지도(시트) 남기지도(`LastLoginRecorder`) 않는다. 로그아웃(`LogoutButton`)하면 "○○ 사이트에서도 로그아웃해 줘" 안내 창(`sharedLogoutMessage`) → "알겠어"로 처음 화면. 분석 `landing_cta_click.shared`(불리언)
- **버튼 숨기기** `NEXT_PUBLIC_LOGIN_PROVIDERS=kakao,google`: 네이버 검수 전 배포용(docs/release/v0.4-phase3-providers.md §7)

**로그인 실패 안내 (P3-10)**: `/auth/callback`이 `error`·`error_code`·`error_description`(코드가 없는 콜백 포함)과 교환 오류(`exchangeCodeForSession`의 `code`·`name`)를 사유 enum 하나로 바꾼다(`src/lib/auth/loginError.ts`). 원문은 주소·화면·분석에 싣지 않고, 설정 오류·모르는 오류만 코드 이름으로 `reportServerError`(Sentry, area `auth` op `callback`).

| 사유 | 들어오는 값 | 파이뱀 | 제목 · 설명 (via = 시도한 provider. 로그인 버튼이 누르기 직전 sessionStorage `pyroad.loginAttempt.v1`에 적고 안내가 읽음 — `redirectTo`에는 싣지 않음, B43) |
|---|---|---|---|
| `cancelled` | `access_denied` (취소·동의 거부) | encourage | "[카카오 ]로그인을 그만뒀구나" · "괜찮아! 취소하거나 동의하지 않으면 들어갈 수 없어. 마음이 바뀌면 아래에서 다시 골라 줘." |
| `identity_taken` | `identity_already_exists` (계정 연결 P3-07) | think | "이미 다른 계정에 연결돼 있어" · "이 [Google ]계정은 다른 pyRoad 계정에서 쓰고 있어. 그 계정으로 로그인하면 거기 기록을 볼 수 있어." |
| `expired` | `bad_oauth_state`(Site URL `/`로 옴) · `bad_oauth_callback` · `flow_state_expired` | confused | "로그인 시간이 지났어" · "너무 오래 걸렸거나 주소가 바뀌었어. 처음부터 다시 해 볼까?" |
| `reused` | `flow_state_already_used` · `flow_state_not_found` | think | "이미 끝난 로그인이야" · "같은 로그인 화면을 두 번 열었어. 버튼을 한 번 더 눌러 줘." (첫 요청이 이미 로그인시켰으면 안내 없이 `next`로) |
| `other_browser` | PKCE verifier 없음 `pkce_code_verifier_not_found` · `bad_code_verifier` | confused | "처음 그 화면에서 다시 해 줘" · "로그인을 시작한 곳과 지금 화면이 달라. 처음 버튼을 누른 브라우저나 앱에서 다시 눌러 줘." |
| `unavailable` | `server_error`("Error getting user email") · `provider_disabled` · `oauth_provider_not_supported` · `unexpected_failure` · `manual_linking_disabled` | sad | "지금은 [네이버 ]로그인을 쓸 수 없어" · "다른 방법으로 들어가 볼래? 계속 안 되면 어른에게 알려 줘." |
| `unknown` | 그 밖 (code·error 모두 없음, 옛 `?error=auth`) | sad | "앗, 로그인이 잘 안 됐어" · "잠시 뒤에 다시 해 볼까? 다른 방법으로 들어가도 돼." |

- **redirectTo는 쿼리 없는 `/auth/callback`** (B43): Supabase Redirect URLs는 쿼리까지 비교하므로 `?via=`를 붙이면 정확한 주소만 등록된 운영에서 Site URL로 샜다. 시도한 수단은 sessionStorage로 옮김. `?next=`는 계정 연결·탈퇴 재인증만(Redirect URLs `https://pyroad.vercel.app/**` 필요)
- **어디로**: 랜딩에서 시작한 로그인(기본 `next`)은 `/?login_error=<사유>` → `LandingLoginError`가 로그인 시트를 저절로 열어(`LoginSheet notice`) 표정·제목·설명을 바꾸고 주소에서 그 키를 지운다. 버튼이 바로 아래라 "다시 해 볼까?"는 버튼을 누르는 것. GoTrue가 콜백을 거치지 않고 Site URL로 바로 보낸 `?error=…&error_code=bad_oauth_state`(조각으로 온 값 포함)도 같은 표로 읽는다. 랜딩 밖에서 시작한 흐름(설정의 계정 연결처럼 `next`가 있음)은 `/auth/error?reason=…&next=…` 화면(`AuthErrorView` → `LoginErrorPanel`: 정지 파이뱀 + 돌아가기 `next` + 처음 화면으로, `next`는 다시 `safeNext`)
- **다른 방법 한마디** `loginErrorHint` (금색 옅은 면 + 전구): 카카오톡 인앱에서 Google이 실패 → "카카오톡에서는 카카오 로그인이 가장 빨라! 노란 카카오 버튼을 눌러 봐." · 네이버가 다른 브라우저 문제 → "네이버 앱으로 넘어가지 말고, 이 화면에서 아이디로 로그인해 봐." · 설정 오류·모르는 오류 → "카카오·Google 계정이 있으면 그걸로 들어가 봐."(보이는 provider만). 취소·재전송에는 없음
- 연출: 시트는 기존 단계 규칙(리그 표정 전환, 동작 줄이기 = 정지 표정), `/auth/error`는 정지 그림이라 움직임이 없다
- Kakao KOE 오류(동의 화면 설정 문제)는 카카오 화면에서 멈추고 앱으로 돌아오지 않으므로 이 표로는 잡히지 않는다 → 설정·스모크 테스트로 예방(docs/release/v0.4-phase3-providers.md)
- 분석 이벤트 `login_error {reason}`은 아직 넣지 않았다(이벤트 정의 파일을 다른 작업이 고치는 중) → 후속

**로그인 계정 연결 (P3-07)**: 설정 → "로그인 계정 연결"(`src/components/settings/LinkedAccountsSection.tsx`, 모양만은 `LinkedAccountsList`). 줄마다 브랜드 로고 원(각 사 면 색, `.g-social-chip-*`) + 이름 + "연결됨 · 연결한 날"/"연결 안 됨" + 끊기·연결하기(sm). 이메일·이름·provider 식별자는 보이지 않는다. 규칙(`src/lib/auth/accountLinks.ts`): Google이 있는 계정에 카카오·네이버 붙이기(확인된 방향), 카카오·네이버만 있는 계정에 Google 붙이기(허용, 스모크 L-3), 이메일 없는 계정끼리(카카오 ↔ 네이버)는 막고 "Google을 먼저 연결하면 붙일 수 있어요". 마지막 로그인 수단은 끊기 막힘(화면·`POST /api/account/unlink` 둘 다). 연결은 `useLinkIdentity`(P1-14 헬퍼 인자로 `linkIdentity`, 돌아올 곳 `/settings?linked=<provider>`, 인앱 Google은 시작하지 않고 브라우저 안내), 실패(`identity_already_exists` = "이미 다른 계정에 연결돼 있어" + 합치기는 아직 안 됨 · 어른이 운영자에게 메일)는 P3-10 `/auth/error` → 설정으로. 끊기는 확인 창 → API(우리 쪽 `unlinkIdentity` 먼저, 그다음 Kakao provider unlink, 네이버는 직접 끊기 안내) → 끊은 수단이 "최근에 사용" 기록이면 지움(`forgetLastLoginIf`). 연결 흐름의 콜백은 `#lp=` 배지를 남기지 않는다(새로 붙인 수단은 최근 로그인이 아님).

**최근 로그인 기록 (P3-08)**: `/auth/callback`이 세션 사용자의 `user_metadata.iss`로 provider를 정해(`loginProviderFromUser`) 리다이렉트 주소에 `#lp=<provider>` 조각을 붙이고, 루트 레이아웃의 `LastLoginRecorder`가 `localStorage` `pyroad.lastLogin.v1` = `{ provider, at }`에 저장한 뒤 `history.replaceState`로 조각을 지운다(`src/lib/auth/lastLogin.ts`). 쿼리가 아니라 조각인 이유: 서버·로그·분석으로 가지 않고, 미들웨어가 다시 리다이렉트해도(/world → /onboarding) 브라우저가 조각을 이어 붙인다. 1년 지난 기록은 무시하고 로그아웃해도 지우지 않는다. 쿠키를 쓰지 않으므로 개인정보처리방침 10절 "인증 쿠키만"이 그대로 맞다. UI 힌트일 뿐 인가에 쓰지 않는다.

## 13. 첫 로그인 온보딩 "모험가 등록증" · 30초 튜토리얼 (P3-11)

**용도**: 처음 로그인한 아이가 약속(약관 동의) → 닉네임 → 파이뱀 색 → (선택) 학년을 정하면 등록증 칸이 하나씩 채워지고, 마지막에 금색 도장(도장 = 완료 기록)이 찍힌 뒤 쪽을 넘겨 30초 튜토리얼로 간다. 코드 `src/components/onboarding/`(스타일 `onboarding.css` — 랜딩 CSS 예산 밖이라 globals.css가 아니라 `src/app/onboarding/layout.tsx`·카탈로그가 불러옴), 연출 박자표 `src/lib/celebration/onboardingFx.ts`, 단계 목록 `src/lib/onboarding/steps.ts`. 화면 `/onboarding`(관문: `(protected)/layout.tsx`가 `users.onboarded_at` NULL이면 보냄), 다시 보기 `/onboarding/tutorial`(설정 "튜토리얼 다시 보기").

| 조각 | 모양 | 접근성 |
|---|---|---|
| `OnboardingFlow` | 넓은 화면(1024px~): 왼쪽 안내(파이뱀 + 말풍선 + 단계 판 + 버튼) 36rem · 오른쪽 등록증 21rem(따라 붙음). 좁은 화면: 위에 등록증 띠(compact). 위 막대 = 뒤로(48 원) + 진행 점 | 단계가 바뀌면 단계 제목(`h1`, tabIndex -1)으로 포커스, 파이뱀 대사는 `aria-live="polite"` |
| `RegistrationCard` | 흰 면 + 그림자 한 종류 + 반경 20. 머리 = 고른 색 파이뱀 정지 그림(72) + "파이썬 섬 모험단 / 모험가 등록증" + 도장 자리. 칸(이름·파이뱀 색·학년)은 옅은 선으로만 구분, 지금 단계 칸은 초록 틴트 면. 이름은 Jua 18px(10자도 360폭에서 안 잘림). `variant="compact"` = 좁은 화면 띠 | 정의 목록(`dl`), 도장이 찍히면 `role="img"` "등록 도장" |
| `OnboardingStamp` | 빈 자리 = 점선 고리 "도장"(장식) · 찍힘 = 금색 글자색 고리 2.5px + 금색 틴트 면 + 금색 별 + Jua "등록", -8° (md 64 · lg 84) | 금색 글자 on 금색 틴트 5.28 |
| `StepDots` | 지난 = 초록 점, 지금 = 초록 알약(scaleX 2.4, 칸 폭 그대로), 남은 = 옅은 점, 마지막(도장) = 금색 | "5단계 중 2단계: 이름" 한 줄 |
| `NicknameField` | 큰 입력칸(Jua 22px, 1px 입력 테두리, 오른쪽 글자 수) + 안내 한 줄(두 줄 높이 예약) + [추천 이름 쓰기(금색, 중복일 때)] [🎲 다른 이름 추천] | 안내는 `aria-describedby` + `aria-live`. **빨간색을 쓰지 않음**: 문제 = 금색 경고 글자 + 정보 아이콘, 통과 = 초록 체크. 한글 조합 중에는 판단하지 않음 |
| `SkinPicker` | 6칸(3×2) = 그 색 파이뱀 정지 그림 64 + 이름, 칸 높이 116px. 고른 칸 = 초록 고리 2px + 체크 + 초록 틴트 면, 그림이 기쁨 표정 | 라디오 묶음: ←→↑↓·Home·End로 옮기며 고름, 고른 칸만 Tab 순서. 색만이 아니라 고리·체크·이름으로 구분 |
| `GradePicker` | 1~6학년 칩 56px(360폭 3×2, 640~ 한 줄). 고른 칩 = 초록 면 + 흰 글자 5.12 | 라디오 묶음 (같은 키보드) |
| `GuideMascot` | 라이브 파이뱀(96 · 마지막 쪽 132) + 말풍선(타자 효과). **파이뱀이 아이가 고른 색으로 바뀜**(리그 `palette`, CSS fill 전환) | 리그는 장식, 대사는 글자로 |
| `OnboardingTutorial` | 위 = "30초 튜토리얼" · 점 4 · 건너뛰기, 장면(초록 틴트 16:10, 640~ 16:9) + 번호 원 + 제목 + 파이뱀 대사 + [이전] [다음/모험 시작!]. 장면 4종(`TutorialScenes`): 지도에서 반짝이는 스테이지 누르기 · `print("안녕!")` 쓰고 ▶ 실행 → 결과 · 힌트·질문 대화 · 별 3개 + "완료" 도장. Pyodide를 불러오지 않는 흉내 | 장면은 장식(`aria-hidden`), 같은 내용을 제목·대사가 글자로. ←→ 키로도 넘김 |

**기존 사용자 (P3-12)**: 온보딩 전에 학습한 아이(`onboardingVariant`: 경험치 > 0 · 진행 행 · 닉네임 — `src/lib/onboarding/returning.ts`)는 같은 단계를 반가운 말로 본다(문구는 `src/components/onboarding/copy.ts` 한 곳). 약속 단계 위 "바뀐 점" 한 줄(금색 틴트 면 `.ob-news`: 진짜 이름·사진 대신 별명과 파이뱀, 기록은 그대로), 예전 닉네임이 금칙어까지 통과하면 그대로 채우고 아니면 새로 추천 + "새로 정해야 해", 도장 쪽 "새 등록증을 받았어요!" + "지금까지 모은 경험치 N XP와 기록은 그대로예요" + [30초 튜토리얼 볼래요](보조) · [이미 알아요, 이어서 모험!](주, 바로 월드맵). 그 전까지 다른 친구에게는 공개 이름 `모험가NNNN`.

**나이 확인 · 보호자 동의 · 제한 모드 (P3-15, §12-Q5·Q35·Q36)**: 약속 다음에 **나이** 단계(`AgeCheck`: 태어난 해 칩 12개(올해-5 ~ 올해-16) + "○○년보다 전" + "잘 모르겠어요" → 경계 해(올해-14)면 달 칩 → 이번 달이면 "생일 지났어요?"; 모두 라디오 묶음, 결과 한 줄 — 만 14세 미만은 금색 틴트, 이상은 초록 틴트). 계산은 `src/lib/consent/age.ts`(KST, 모름 = 만 14세 미만), **서버도 다시 계산해 결과(`age_band`)만 저장**. 만 14세 미만이면 **보호자** 단계(`GuardianConsentPanel`: "보호자님께" 옅은 보조 면에 법 근거·처리 정보 요약(존댓말, 아이용 판과 말투를 구분) + 보호자 항목 2개(필수) + 관계 칩(엄마·아빠·그 밖의 보호자, 선택) + "이름·연락처는 받지 않습니다"; [보호자로서 동의합니다] / [나중에 보호자와 함께 할게요]). 나중이면 도장 쪽에 금색 틴트 안내. 제한 모드 화면 조각(`src/components/consent/`, 스타일 `consent.css`): 맨 위 띠 `ConsentBanner`(월드맵·게시판·프로필은 조용한 초록 틴트, 7일 이하 남으면 퀘스트 빼고 모든 화면에 금색 경고 "N일 남았어요", 오른쪽 [보호자 동의하기]), 게시판 글쓰기·댓글 자리 `RestrictedNotice`(금색 틴트 + 손잡은 하트, compact 한 줄), 나중에 동의 `/onboarding/guardian`(같은 판 + 금색 "동의" 도장 쾅), 설정 칸 `GuardianConsentStatus`. 모두 움직임 없음(새 질문만 한 번 8px 떠오름, minimal·동작 줄이기는 없음). 카탈로그 `#consent`.

**파이뱀 반응**: 약속 다 함 → 기쁨, 닉네임 확인 중 → 생각 · 통과 → 기쁨("“별빛코더”! 정말 멋진 이름이야!") · 규칙 → 갸우뚱 · 중복 → 놀람, 색 고름 → 그 색으로 바뀌며 기쁨 점프(`replay`), 학년 → 설명, 도장 → 놀람 → 쾅 순간 기쁨.

**연출 단계별** (모두 1회성, transform·opacity만. 반복은 튜토리얼 지도 "지금 여기" 고리 하나 `.m-loop`)

| 연출 | full | lite | minimal | 동작 줄이기 |
|---|---|---|---|---|
| 도장 (260ms 뒤) | 2.3배·-22°에서 가속 내려찍기 220ms(`stampIn`) → body 스프링 안착 + 종이 떨림(steps 3) + 금색 방울 7개 + 작은 컨페티 44(금색·초록) + `tap` | 154ms + 스프링, 떨림·방울 없음, 컨페티 30% | 페이드 150ms, 컨페티 없음 | 처음부터 제자리 (도장 색·글자, 파이뱀 표정·후광) |
| 쪽 넘김 → 튜토리얼 | 왼쪽 축으로 넘어가며 사라짐(page 700ms) → 새 쪽이 14°에서 펼쳐짐(slow 360ms) | 페이드 140ms | 즉시 | 즉시 |
| 주사위 | 데구르르 540ms + 이름 4번 바뀜(80ms) | 70% | 이름만 바로 | 이름만 바로 |
| 색 칸 톡 · 진행 점 | prop 스프링 0.9→1 · 알약 220ms | 같음 | 즉시 | 즉시 |
| 튜토리얼 장면 | 키프레임(손가락 탭·타자·실행 눌림·결과 팝·말풍선·별 하나씩·도장) | 길이·지연 70%(`--ob-k`) | 끝 상태 | 끝 상태 |

도장 연출 중 화면 어디든 누르거나 Enter·Space·Esc → 끝 상태(§12-Q28). 연출 길이·곡선은 토큰(`DURATION`·`EASING`·`springTiming`)만.

**대표 상태** (카탈로그 `#onboarding`): 등록증 빈 칸·칸 강조·10자 닉네임 + 학년 비밀 + 도장, 위 띠 빈/찍힘, 도장 빈 자리·md·lg + 다시 찍기, 진행 점 5단계, 색 고르기 + 안내 파이뱀, 학년 칩, 닉네임 처음·확인 중·통과·규칙·중복 + 추천, 튜토리얼 장면 4종 + 다시 재생.

## 13-1. 앱 아이콘 · 홈 화면에 추가 (P4-11)

- 아이콘: `src/lib/pwa/iconArt.tsx` 한 벌(브랜드 초록 면 + 파이뱀 리그 정지 그림 + 언덕·금색 반짝이, 글자 없음)을 `next/og`로 빌드 때 PNG 생성. 파비콘 `/icon`(32, 얼굴만) · `/apple-icon`(180, 불투명) · manifest `/pwa/icon-192.v1.png`·`icon-512.v1.png`·`maskable-512.v1.png`(그림은 가운데 80% 원 안). 그림을 바꾸면 `PWA_ICON_VERSION`을 올린다.
- 안내: 월드맵 쪽지 `InstallHint`(공통 토스트 + `action`, 서로 다른 날 3번째 방문부터, 닫으면 30일) · 설정 `InstallAppSection`(늘 있음). 안드로이드는 브라우저 설치 창(`beforeinstallprompt`, `InstallPromptCatcher`가 로그인 화면에서 잡음), iOS는 그림 안내 시트 `IosInstallGuide`(공유 → 홈 화면에 추가 → 추가). 데스크톱·이미 설치·앱 안 브라우저는 쪽지 없음. 판별은 `src/lib/pwa/install.ts`. 카탈로그 `#pwa`.

## 14. 지금 앱에 적용한 곳 (화면 개편은 Phase 4~6)

| 컴포넌트 | 사용처 |
|---|---|
| Button | 온보딩 단계 버튼·다른 이름 추천·튜토리얼(P3-11), 실행·멈추기·실행기 다시 불러오기·다음 퀘스트로(CodePanel·QuestWorkspace), 힌트·황금키(ConversationPanel), 축하 CTA(`celebration-cta`), 랜딩 로그인 CTA(`LoginSheetButton`: 헤더 "로그인"·히어로 "모험 시작하기"), 인앱 브라우저 안내, 설정 저장, 계정 관리, 신고·삭제 대화 상자, 게시판·공지·댓글 등록 |
| IconButton | HUD 소리 토글(`SoundToggle`), 시트·토스트 닫기 |
| Card | 월드맵 프로필 요약, 프로필 카드 4개, 계정 관리 |
| AlertDialog | 신고, 글·공지 삭제, 리셋·탈퇴(2단계) |
| Modal | 인앱 브라우저 안내(포커스 가두기·Esc 생김) |
| Sheet | 랜딩 로그인 시트(`LoginSheet`, P3-05) |
| Toast | 잠긴 스테이지 안내(B38) |
| SegmentedTabs | 퀘스트 모바일 이야기/코드/결과 |
| ProgressBar | XP 막대(`XPProgressBar`), 프로필 스테이지 진행률 |
| LevelSeal · useCountUp | 퀘스트 상태바 |
| SpeechBubble | 튜터 대사·스트리밍·생각 중 |
| RewardIcon | 황금키 버튼·남은 개수, 황금키 확인 카드 |
| Tooltip | 힌트·황금키 안내 |
