import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting } from '@codemirror/language';
import { tagHighlighter, tags as t } from '@lezer/highlight';
import { cssVar, type ColorName, type ContrastPair } from '@/lib/design/tokens';
import { CODE_LINE_HEIGHT, type CodeFontSize } from './fontSize';

/**
 * CodeMirror 키즈 테마 (P2-18, docs/design/editor.md). 승인된 최종 시안의 "주문 공책" 코드 상자를 따른다:
 * 흰 면 + 1px `lineStrong` 테두리, 줄 번호 `surface2`/`textMuted`, 구문색은 키워드 초록·문자열 금색 글자·주석 회색 3종,
 * 나머지(이름·숫자·함수·연산자)는 본문색. 굵게·기울임은 쓰지 않는다(아이에게 담백하게).
 *
 * - 색은 전부 디자인 토큰 CSS 변수(`cssVar`)와 그 틴트(`color-mix`)만 쓴다 → `tokens:check`·월드 테마·토큰 변경을 따라간다
 * - 글자 대비: 틴트 면(활성 줄·오류 줄·검색·같은 단어) 위에서는 주석 `codeComment`(흰 면 4.74)가 4.5 아래로 떨어지므로
 *   그 줄 안의 주석만 `textMuted`로 한 단계 진하게 바꾼다. 선택 영역 안 글자는 모두 `codeText`로 (수치는 문서 표)
 * - 글꼴 pyRoad Mono(`--font-mono`, D2Coding) + 리거처 끔. 글자 크기는 짝수 px만(`codeFontSizeTheme`)
 */

const tint = (name: ColorName, pct: number) =>
  `color-mix(in srgb, ${cssVar(name)} ${pct}%, transparent)`;

/** 반투명 틴트 진하기(%). 테마와 대비 표(`EDITOR_CONTRAST_PAIRS`)가 같이 쓴다 */
export const TINT = {
  /** 활성 줄 `primary` */
  activeLine: 6,
  /** 활성 줄 번호 칸 `primary` (surface2 위) */
  activeGutter: 10,
  /** 포커스 중 선택 영역 `primary` */
  selection: 16,
  /** 포커스가 없을 때 남은 선택 영역 `primary` (선택 글자색을 바꿀 수 없어 주석도 4.5를 넘는 진하기) */
  selectionBlur: 3,
  /** 오류 줄 `errorSoft` (선택 영역이 살짝 비치게) */
  errorLine: 85,
} as const;

/** 구문 토큰 클래스 (색은 아래 테마가 정한다. 클래스 이름이 고정이라 줄 상태별로 덮어쓸 수 있다) */
export const TOKEN_CLASS = {
  comment: 'pr-tok-comment',
  keyword: 'pr-tok-keyword',
  string: 'pr-tok-string',
  number: 'pr-tok-number',
  func: 'pr-tok-func',
} as const;

/**
 * 파이썬 구문 → 클래스. `t.keyword`는 하위 태그(if·for 같은 control, and·in 같은 operator, def·class 같은 definition,
 * import 같은 module)를 모두 덮는다. True·False·None도 키워드색
 */
export const kidsHighlighter = tagHighlighter([
  { tag: t.comment, class: TOKEN_CLASS.comment },
  { tag: [t.keyword, t.bool, t.null, t.self], class: TOKEN_CLASS.keyword },
  {
    tag: [t.string, t.special(t.string), t.escape],
    class: TOKEN_CLASS.string,
  },
  { tag: t.number, class: TOKEN_CLASS.number },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    class: TOKEN_CLASS.func,
  },
]);

/** 주석을 한 단계 진하게(`textMuted`) 그리는 틴트 면들 */
const TINTED = [
  '.cm-activeLine',
  '.cm-errorLine',
  '.cm-searchMatch',
  '.cm-selectionMatch',
];
const commentOnTint = TINTED.flatMap((s) => [
  `${s} .${TOKEN_CLASS.comment}`,
  `.${TOKEN_CLASS.comment} ${s}`,
]).join(', ');

/**
 * 테마 명세 (단위 테스트가 색 값이 토큰 변수뿐인지 검사한다).
 * 선택자의 `&`는 에디터 루트(`.cm-editor`)
 */
export const KIDS_THEME_SPEC: Record<string, Record<string, string>> = {
  '&': {
    color: cssVar('codeText'),
    backgroundColor: cssVar('codeBg'),
    border: `var(--line-w) solid ${cssVar('lineStrong')}`,
    borderRadius: 'var(--round-m)',
    overflow: 'hidden',
    // 짧은 시작 코드(2~3줄)에도 빈 칸이 크지 않게 약 6줄 (시안 f-editor, P6-05에서 200px → 11rem)
    minHeight: '11rem',
    maxHeight: '400px',
    fontFamily: 'var(--font-mono)',
    fontVariantLigatures: 'none',
    fontKerning: 'none',
    letterSpacing: '0',
  },
  // 키보드 포커스 링 (앱 공용 `focus-ring`과 같은 2px 짙은 중립 + 간격 2px)
  '&.cm-focused': {
    outline: `var(--focus-w) solid ${cssVar('secondary')}`,
    outlineOffset: 'var(--focus-offset)',
  },
  // CodeMirror 기본 테마가 `.cm-scroller`에 monospace·행간 1.4를 직접 넣으므로 덮는다
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: String(CODE_LINE_HEIGHT),
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '12px 0',
    caretColor: cssVar('codeText'),
  },
  '.cm-line': {
    padding: '0 14px 0 12px',
  },
  // 커서: 2px 본문색 (흰 면 14.2:1). 깜빡임은 CodeMirror 기본(1.2초 주기 opacity)을 그대로 둔다 — 문서 참고
  '.cm-cursor, .cm-dropCursor': {
    borderLeft: `2px solid ${cssVar('codeText')}`,
    marginLeft: '-1px',
  },

  // 줄 번호
  '.cm-gutters': {
    backgroundColor: cssVar('surface2'),
    color: cssVar('textMuted'),
    borderRight: `var(--line-w) solid ${cssVar('line')}`,
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 14px',
    minWidth: '2ch',
  },
  '.cm-activeLineGutter': {
    backgroundColor: tint('primary', TINT.activeGutter),
    color: cssVar('codeText'),
  },

  // 활성 줄: 아주 옅은 초록 (반투명이라 아래 선택 영역이 비친다)
  '.cm-activeLine': {
    backgroundColor: tint('primary', TINT.activeLine),
  },
  // 에디터를 떠나면(실행 버튼을 누른 뒤 등) 활성 줄 표시를 끈다: 커서가 없는데 줄만 칠해져 있으면 잡음 (P6-03)
  '&:not(.cm-focused) .cm-activeLine, &:not(.cm-focused) .cm-activeLineGutter':
    {
      backgroundColor: 'transparent',
    },

  // 선택 영역: 옅은 초록 틴트. 포커스 중에는 선택된 글자를 모두 본문색으로 (틴트 위 11.5:1)
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: `${tint('primary', TINT.selection)} !important`,
  },
  '.cm-selectionBackground': {
    backgroundColor: `${tint('primary', TINT.selectionBlur)} !important`,
  },
  '.cm-line ::selection, .cm-line::selection': {
    color: cssVar('codeText'),
  },
  // 커서 위치 단어와 같은 단어
  '.cm-selectionMatch': {
    backgroundColor: cssVar('primarySoft'),
  },

  // 괄호 짝: 형광펜 금색 면 (장식 면 + 본문색 글자)
  '&.cm-focused .cm-matchingBracket': {
    backgroundColor: cssVar('accentLight'),
    color: cssVar('codeText'),
    outline: `var(--line-w) solid ${cssVar('accentText')}`,
    borderRadius: '2px',
  },
  '&.cm-focused .cm-nonmatchingBracket': {
    backgroundColor: cssVar('errorSoft'),
    color: cssVar('error'),
  },

  // 찾기 (Ctrl+F)
  '.cm-searchMatch': {
    backgroundColor: cssVar('accentSoft'),
    outline: `var(--line-w) solid ${cssVar('accentText')}`,
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: cssVar('accentLight'),
  },
  '.cm-panels': {
    backgroundColor: cssVar('surface2'),
    color: cssVar('text'),
  },
  '.cm-panels.cm-panels-bottom': {
    borderTop: `var(--line-w) solid ${cssVar('line')}`,
  },
  '.cm-panels.cm-panels-top': {
    borderBottom: `var(--line-w) solid ${cssVar('line')}`,
  },
  '.cm-textfield': {
    backgroundColor: cssVar('surface'),
    border: `var(--line-w) solid ${cssVar('lineStrong')}`,
    borderRadius: 'var(--round-s)',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: cssVar('surface'),
    border: `var(--line-w) solid ${cssVar('lineStrong')}`,
    borderRadius: 'var(--round-s)',
    color: cssVar('text'),
  },

  // 오류 줄: 옅은 빨강 띠 + 아래 2px 빨강 선(색만으로 구분하지 않게). 선은 그림자라 줄 높이를 바꾸지 않는다
  '.cm-line.cm-errorLine': {
    backgroundColor: tint('errorSoft', TINT.errorLine),
    boxShadow: `inset 0 -2px 0 ${cssVar('error')}`,
  },
  '.cm-gutterElement.cm-errorLineGutter': {
    backgroundColor: cssVar('errorSoft'),
    color: cssVar('error'),
  },

  // 자동 완성 상자
  '.cm-tooltip': {
    backgroundColor: cssVar('surface'),
    color: cssVar('text'),
    border: `var(--line-w) solid ${cssVar('lineStrong')}`,
    borderRadius: 'var(--round-s)',
    boxShadow: 'var(--elev-pop)',
    overflow: 'hidden',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': {
    fontFamily: 'var(--font-mono)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
    padding: '4px 10px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: cssVar('primarySoft'),
    color: cssVar('text'),
  },
  '.cm-completionDetail': {
    color: cssVar('textMuted'),
    fontStyle: 'normal',
  },

  // 구문색 3종 + 본문색 (토큰 이름이 따로 있는 숫자·함수도 토큰을 가리켜 둔다)
  [`.${TOKEN_CLASS.comment}`]: { color: cssVar('codeComment') },
  [`.${TOKEN_CLASS.keyword}`]: { color: cssVar('codeKeyword') },
  [`.${TOKEN_CLASS.string}`]: { color: cssVar('codeString') },
  [`.${TOKEN_CLASS.number}`]: { color: cssVar('codeNumber') },
  [`.${TOKEN_CLASS.func}`]: { color: cssVar('codeFunc') },
  [commentOnTint]: { color: cssVar('textMuted') },
};

const over = (bg: ColorName, pct: number, base: ColorName = 'codeBg') => ({
  bg,
  over: base,
  alpha: pct / 100,
});

/**
 * 에디터 안 글자·UI 대비 (`kidsTheme.test.ts`가 AA 미달이면 실패, docs/design/editor.md 표).
 * 틴트 면 위 주석은 테마가 `textMuted`로 바꾸므로 그 조합을 검사한다. 선택 영역(포커스) 안 글자는 모두 `codeText`
 */
export const EDITOR_CONTRAST_PAIRS: ContrastPair[] = [
  // 기본 면
  { fg: 'codeText', bg: 'codeBg', kind: 'text', use: '코드 글자·숫자·함수' },
  { fg: 'codeComment', bg: 'codeBg', kind: 'text', use: '주석' },
  { fg: 'codeKeyword', bg: 'codeBg', kind: 'text', use: '키워드' },
  { fg: 'codeString', bg: 'codeBg', kind: 'text', use: '문자열' },
  // 활성 줄
  ...(['codeText', 'textMuted', 'codeKeyword', 'codeString'] as const).map(
    (fg) => ({
      fg,
      ...over('primary', TINT.activeLine),
      kind: 'text' as const,
      use: '활성 줄',
    }),
  ),
  // 선택 영역
  {
    fg: 'codeText',
    ...over('primary', TINT.selection),
    kind: 'text',
    use: '선택 영역(포커스, 글자 모두 본문색)',
  },
  ...(['codeText', 'codeComment', 'codeKeyword', 'codeString'] as const).map(
    (fg) => ({
      fg,
      ...over('primary', TINT.selectionBlur),
      kind: 'text' as const,
      use: '선택 영역(포커스 없음)',
    }),
  ),
  // 같은 단어·오류 줄·찾기 (주석은 textMuted)
  ...(
    [
      ['primarySoft', 100, '같은 단어'],
      ['errorSoft', TINT.errorLine, '오류 줄'],
      ['accentSoft', 100, '찾은 곳'],
      ['accentLight', 100, '지금 찾은 곳·괄호 짝'],
    ] as const
  ).flatMap(([bg, pct, use]) =>
    (['codeText', 'textMuted', 'codeKeyword', 'codeString'] as const).map(
      (fg) => ({ fg, ...over(bg, pct), kind: 'text' as const, use }),
    ),
  ),
  { fg: 'error', bg: 'errorSoft', kind: 'text', use: '짝 없는 괄호' },
  // 줄 번호
  { fg: 'textMuted', bg: 'surface2', kind: 'text', use: '줄 번호' },
  {
    fg: 'codeText',
    ...over('primary', TINT.activeGutter, 'surface2'),
    kind: 'text',
    use: '활성 줄 번호',
  },
  { fg: 'error', bg: 'errorSoft', kind: 'text', use: '오류 줄 번호' },
  // UI
  { fg: 'codeText', bg: 'codeBg', kind: 'ui', use: '커서 2px' },
  {
    fg: 'error',
    ...over('errorSoft', TINT.errorLine),
    kind: 'ui',
    use: '오류 줄 밑줄 2px',
  },
  { fg: 'lineStrong', bg: 'codeBg', kind: 'ui', use: '코드 상자 테두리(안쪽)' },
  { fg: 'lineStrong', bg: 'bg', kind: 'ui', use: '코드 상자 테두리(바깥)' },
  { fg: 'secondary', bg: 'bg', kind: 'ui', use: '포커스 링' },
  { fg: 'accentText', bg: 'accentSoft', kind: 'ui', use: '찾은 곳 테두리' },
  {
    fg: 'text',
    bg: 'surface2',
    kind: 'text',
    use: '글자 크기 숫자·버튼 아이콘',
  },
];

/** 코드 글자 크기 (짝수 px 단계만 받는다). Compartment로 바꿔 끼운다 */
export function codeFontSizeTheme(size: CodeFontSize): Extension {
  return [
    EditorView.theme({ '&': { fontSize: `${size}px` } }),
    EditorView.editorAttributes.of({ 'data-code-font-size': String(size) }),
  ];
}

/** 찾기·자동 완성·줄 이동 창의 영어 문구 → 쉬운 한국어 */
export const KO_PHRASES: Record<string, string> = {
  Find: '찾기',
  Replace: '바꾸기',
  next: '다음',
  previous: '이전',
  all: '모두',
  'match case': '대소문자 구분',
  regexp: '정규식',
  'by word': '단어 단위',
  replace: '바꾸기',
  'replace all': '모두 바꾸기',
  close: '닫기',
  'current match': '지금 찾은 곳',
  'on line': '줄',
  'replaced match on line $': '$번째 줄에서 바꿨어요',
  'replaced $ matches': '$곳을 바꿨어요',
  'Go to line': '줄로 가기',
  go: '가기',
  Completions: '추천 단어',
};

/** 키즈 테마 전부: 화면 테마 + 구문 클래스 + 한국어 문구 */
export function kidsTheme(): Extension {
  return [
    EditorView.theme(KIDS_THEME_SPEC),
    syntaxHighlighting(kidsHighlighter),
    EditorState.phrases.of(KO_PHRASES),
  ];
}
