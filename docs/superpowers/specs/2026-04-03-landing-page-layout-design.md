# 랜딩 페이지 레이아웃 디자인

## 배경

현재 랜딩 페이지(`/`)는 HeroSection 하나만 렌더링하는 최소 구조로, Header/Footer/네비게이션이 없다. 서비스 소개와 외부 링크(GitHub, About, Contact)를 제공하기 위해 Header, 기능 소개 섹션, Footer를 추가한다.

## 적용 범위

- 랜딩 페이지(`/`)에만 적용
- 보호 라우트(`/world`, `/quest`, `/profile`, `/settings`)는 변경 없음

## 디자인 결정

### 1. Header — 투명 + 스크롤 전환

- **초기 상태**: 투명 배경, 히어로 위에 겹침 (position: fixed)
- **스크롤 시**: `backdrop-filter: blur` + 반투명 white 배경으로 전환
- **전환 트리거**: `scroll > 50px` (IntersectionObserver 또는 scroll event)

**구성 요소:**
| 위치 | 요소 |
|------|------|
| 좌측 | pyRoad 로고 (텍스트) |
| 우측 | About 링크, GitHub 아이콘+링크, 로그인 버튼 |

**로그인 버튼**: Header의 로그인 버튼은 기존 `LoginButton` 컴포넌트와 별도로, 작은 pill 스타일 버튼. 클릭 시 동일하게 Google OAuth 실행.

### 2. Hero Section — 기존 유지

- 현재 `HeroSection.tsx` 코드 그대로 유지
- 파이뱀 캐릭터 Lottie 입장 애니메이션 → SVG waving
- 텍스트: "안녕! 나는 파이뱀 선생님이야~" / "함께 파이썬 모험을 떠나볼래?"
- `LoginButton` (Google로 시작하기) 유지
- Header 높이만큼 상단 패딩 조정 필요 (`pt-[20vh]` → 적절히 조정)

### 3. Feature Cards — 글래스모피즘

- **레이아웃**: 3열 그리드 (모바일: 1열 세로 스택)
- **카드 스타일**: `backdrop-filter: blur(10px)`, `background: rgba(255,255,255,0.6)`, `border: 1px solid rgba(255,255,255,0.8)`, `border-radius: 16px`
- **섹션 배경**: 반투명 그라디언트 (현재 프로젝트 색상 팔레트 활용)
- **섹션 타이틀**: "이렇게 배워요"

**카드 내용:**

| 카드 | 아이콘 배경 | 아이콘 (lucide-react) | 제목 | 설명 |
|------|-----------|---------------------|------|------|
| AI 튜터 | 녹색 그라디언트 (#a8d5a2 → #7bc67e) | `MessageCircle` | AI 튜터 | 파이뱀 선생님이 1:1로 도와줘요 |
| 코드 실행 | 파랑 그라디언트 (#8ecae6 → #5fa8d3) | `Code` | 코드 실행 | 브라우저에서 바로 파이썬을 실행해요 |
| 퀘스트 모험 | 주황 그라디언트 (#f4b860 → #e89b3e) | `Star` | 퀘스트 모험 | 7개 스테이지를 깨며 성장해요 |

**Framer Motion 애니메이션**: 스크롤 시 stagger fadeUp (현재 HeroSection과 동일 패턴)

### 4. Footer — 2줄 구성

**1줄**: pyRoad 로고(좌) + About, GitHub(아이콘), Contact 링크(우)
**2줄**: 구분선 + "© 2026 pyRoad. 초등학생을 위한 파이썬 학습 플랫폼" (중앙 정렬)

**스타일**: `border-top: 1px solid rgba(58,90,64,0.1)`, 폰트 크기 11-13px, muted 색상

## 컴포넌트 구조

```
src/app/page.tsx                    # Header + HeroSection + FeatureSection + Footer 조합
src/components/landing/
├── HeroSection.tsx                 # 기존 유지
├── LandingHeader.tsx               # 신규: 투명 Header
├── FeatureSection.tsx              # 신규: 글래스모피즘 기능 카드
└── LandingFooter.tsx               # 신규: 2줄 Footer
```

## 반응형 디자인

| 브레이크포인트 | Header | Feature Cards | Footer |
|-------------|--------|---------------|--------|
| Desktop (md+) | 가로 배치 그대로 | 3열 그리드 | 가로 배치 그대로 |
| Mobile (<md) | 로고 + 햄버거 메뉴 또는 최소 아이콘 | 1열 세로 스택 | 세로 스택 (로고 → 링크 → 저작권) |

**모바일 Header 처리**: 항목이 4개(로고, About, GitHub, 로그인)로 적으므로 햄버거 메뉴 없이 그대로 가로 배치 가능. 화면이 매우 좁을 때만 About 텍스트 숨김 처리.

## 기술 구현 참고

- **스크롤 Header 전환**: `useEffect` + `scroll` 이벤트 리스너, state로 `isScrolled` 관리
- **기능 카드 애니메이션**: Framer Motion `m.div` + `whileInView` + stagger variants
- **아이콘**: `lucide-react` (이미 설치됨)
- **Google OAuth**: 기존 `LoginButton` 컴포넌트의 `handleLogin` 로직 재사용
- **링크**: About → 별도 페이지 생성 필요 여부는 추후 결정 (일단 `#` 또는 스크롤 앵커)

## 접근성

- Header 링크: `<nav>` 시맨틱 태그, `aria-label="메인 네비게이션"`
- Footer 링크: `<footer>` 시맨틱 태그
- 모든 클릭 타겟: 최소 44px (PRD 기준)
- GitHub 링크: `target="_blank"`, `rel="noopener noreferrer"`
- `prefers-reduced-motion`: 스크롤 애니메이션 비활성화

## 검증 방법

1. `npm run dev`로 개발 서버 실행
2. `/` 접속 → Header, Hero, Feature Cards, Footer 순서대로 렌더링 확인
3. 스크롤 시 Header 배경 전환 확인
4. 로그인 버튼 클릭 → Google OAuth 정상 동작 확인
5. 모바일 뷰포트(375px)에서 반응형 레이아웃 확인
6. `prefers-reduced-motion` 설정 시 애니메이션 비활성화 확인
7. `npm run build` 빌드 성공 확인
