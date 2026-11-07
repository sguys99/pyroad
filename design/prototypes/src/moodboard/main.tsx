// 무드보드 (P2-01) → dist/moodboard.html
// 디자인 리뷰 문서: 담백한 중립 레이아웃 위에 시안별 견본을 Scope(토큰 범위)로 얹는다.
import { mountPrototype } from '../shared/app';
import { CONCEPTS, CONCEPT_NAME } from '../shared/tokens';
import {
  CharacterSection,
  ChecklistSection,
  MotionSection,
  Overview,
  PaletteSection,
  RulesSection,
  TypeSection,
  WorldSection,
  tagOf,
} from './sections';
import './moodboard.css';
import './demos.css';

const SECTIONS = [
  { id: 'overview', label: '개요' },
  { id: 'palette', label: '팔레트' },
  { id: 'type', label: '타이포' },
  { id: 'characters', label: '캐릭터' },
  { id: 'motion', label: '모션' },
  { id: 'worlds', label: '월드' },
  { id: 'rules', label: '규칙' },
  { id: 'checklist', label: '체크리스트' },
] as const;
type Sec = (typeof SECTIONS)[number]['id'];

function Moodboard() {
  return (
    <div className="mb">
      <header className="mb-top">
        <div className="mb-wrap">
          <p className="mb-kicker">pyRoad Phase 2 · P2-01 디자인 무드보드 · 초안 2026-11-05</p>
          <h1>아이가 "해 보고 싶다"고 느끼는 세 가지 방향</h1>
          <p className="mb-lead">
            시안{' '}
            {CONCEPTS.map((c, i) => (
              <span key={c}>
                <b>
                  {tagOf(c)} {CONCEPT_NAME[c]}
                </b>
                {i < CONCEPTS.length - 1 ? ', ' : ''}
              </span>
            ))}
            의 색·글꼴·캐릭터·모션 규칙을 한 페이지에 모았습니다. 숫자(대비·스프링)는 모두 코드에서 계산한 값이고, 토큰 이름은 세 시안이 같습니다. 확정은 사용자 리뷰(P2-06·P2-08) 뒤 디자인 토큰(P2-09)에서 합니다.
          </p>
          <nav className="mb-toc" aria-label="절 목록">
            {SECTIONS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mb-wrap mb-main">
        <Overview />
        <PaletteSection />
        <TypeSection />
        <CharacterSection />
        <MotionSection />
        <WorldSection />
        <RulesSection />
        <ChecklistSection />
      </main>
      <footer className="mb-wrap mb-foot">
        <p>
          프로토타입이라 앱 코드가 아닙니다. 소스 <code>design/prototypes/src/moodboard</code>, 토큰 <code>src/shared/tokens.ts</code>, 문서{' '}
          <code>docs/design/P2-01-moodboard.md</code>. 특정 게임을 따라 그리지 않고 장르 분위기만 참고했습니다.
        </p>
      </footer>
    </div>
  );
}

mountPrototype<Sec>({
  concept: 'A',
  name: 'pyRoad 무드보드',
  subtitle: 'P2-01 · A · B · A×B 비교',
  screens: SECTIONS,
  defaultScreen: 'overview',
  mode: 'scroll',
  render: () => <Moodboard />,
});
