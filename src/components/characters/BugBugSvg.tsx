import type { BugBugExpression } from './expressions';

interface BugBugSvgProps {
  expression?: BugBugExpression;
  size?: number;
  className?: string;
}

/**
 * 버그버그 SVG 캐릭터.
 * 귀여운 무당벌레 디버깅 도우미로 3가지 표정을 지원합니다.
 */
export function BugBugSvg({
  expression = 'searching',
  size = 64,
  className,
}: BugBugSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`버그버그 - ${expression}`}
    >
      {/* 다리 (6개) */}
      <g id="legs">
        {/* 왼쪽 다리 */}
        <line x1="38" y1="68" x2="24" y2="60" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" />
        <line x1="36" y1="80" x2="20" y2="80" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" />
        <line x1="38" y1="92" x2="24" y2="100" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" />
        {/* 오른쪽 다리 */}
        <line x1="90" y1="68" x2="104" y2="60" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" />
        <line x1="92" y1="80" x2="108" y2="80" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" />
        <line x1="90" y1="92" x2="104" y2="100" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* 몸통 (빨간 등딱지) */}
      <g id="body">
        <ellipse cx="64" cy="80" rx="32" ry="28" fill="#EF5350" />
        <ellipse cx="64" cy="80" rx="32" ry="28" fill="url(#bugBodyGradient)" />
        {/* 등딱지 중앙선 */}
        <line x1="64" y1="56" x2="64" y2="108" stroke="#C62828" strokeWidth="2" />
        {/* 검정 점 */}
        <circle cx="50" cy="70" r="5" fill="#4E342E" />
        <circle cx="78" cy="70" r="5" fill="#4E342E" />
        <circle cx="48" cy="88" r="4" fill="#4E342E" />
        <circle cx="80" cy="88" r="4" fill="#4E342E" />
        <circle cx="64" cy="96" r="3.5" fill="#4E342E" />
      </g>

      {/* 머리 */}
      <g id="head">
        <ellipse cx="64" cy="46" rx="22" ry="18" fill="#4E342E" />
        {/* 더듬이 */}
        <path d="M52 32 Q48 18 42 14" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="41" cy="13" r="4" fill="#FF8A65" />
        <path d="M76 32 Q80 18 86 14" stroke="#4E342E" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="87" cy="13" r="4" fill="#FF8A65" />
        {/* 볼 터치 */}
        <ellipse cx="50" cy="50" rx="5" ry="3" fill="#FF8A80" opacity="0.5" />
        <ellipse cx="78" cy="50" rx="5" ry="3" fill="#FF8A80" opacity="0.5" />
      </g>

      {/* 얼굴 */}
      <g id="face">
        {expression === 'searching' && <SearchingFace />}
        {expression === 'found' && <FoundFace />}
        {expression === 'fixed' && <FixedFace />}
      </g>

      {/* 악세사리 */}
      <g id="accessory">
        {expression === 'searching' && <SearchingAccessory />}
        {expression === 'found' && <FoundAccessory />}
        {expression === 'fixed' && <FixedAccessory />}
      </g>

      <defs>
        <radialGradient id="bugBodyGradient" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#EF9A9A" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#EF5350" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// === 표정 컴포넌트들 ===

function SearchingFace() {
  return (
    <>
      <g id="eyes">
        {/* 왼쪽 눈 - 찡긋 (감은 눈) */}
        <path d="M53 42 Q57 38 61 42" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* 오른쪽 눈 - 크게 뜸 (집중) */}
        <ellipse cx="74" cy="42" rx="5" ry="5.5" fill="white">
          <animate
            attributeName="ry"
            values="5.5;0.5;5.5"
            dur="0.15s"
            begin="4s;searchBlink.end+5s"
            id="searchBlink"
          />
        </ellipse>
        <circle cx="75" cy="41" r="2" fill="#4E342E">
          <animate
            attributeName="opacity"
            values="1;0;1"
            dur="0.15s"
            begin="4s;searchBlinkH.end+5s"
            id="searchBlinkH"
          />
        </circle>
      </g>
      <g id="mouth">
        {/* 살짝 벌린 입 - 집중 */}
        <ellipse cx="64" cy="52" rx="3" ry="2.5" fill="#3E2723" />
      </g>
    </>
  );
}

function FoundFace() {
  return (
    <>
      <g id="eyes">
        {/* 양쪽 큰 눈 - 놀란 표정 */}
        <ellipse cx="56" cy="42" rx="6" ry="6.5" fill="white" />
        <circle cx="57" cy="41" r="2.5" fill="#4E342E" />
        <ellipse cx="74" cy="42" rx="6" ry="6.5" fill="white" />
        <circle cx="75" cy="41" r="2.5" fill="#4E342E" />
      </g>
      <g id="mouth">
        {/* 놀란 O 입 */}
        <ellipse cx="64" cy="53" rx="5" ry="4" fill="#3E2723" />
        <ellipse cx="64" cy="53" rx="3.5" ry="2.5" fill="#5D4037" />
      </g>
    </>
  );
}

function FixedFace() {
  return (
    <>
      <g id="eyes">
        {/* 행복하게 감은 눈 (^_^) */}
        <path d="M51 42 Q56 37 61 42" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M69 42 Q74 37 79 42" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
      <g id="mouth">
        {/* 크게 웃는 입 */}
        <path d="M56 50 Q64 58 72 50" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    </>
  );
}

// === 악세사리 컴포넌트들 ===

function SearchingAccessory() {
  return (
    <>
      {/* 돋보기 */}
      <circle cx="106" cy="38" r="10" stroke="#FFB300" strokeWidth="3" fill="none" />
      <circle cx="106" cy="38" r="10" fill="#FFECB3" opacity="0.3" />
      <line x1="99" y1="45" x2="90" y2="54" stroke="#795548" strokeWidth="4" strokeLinecap="round" />
      {/* 돋보기 반짝임 */}
      <path d="M102 32 L104 30" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    </>
  );
}

function FoundAccessory() {
  return (
    <>
      {/* 느낌표 */}
      <rect x="96" y="16" width="5" height="16" rx="2.5" fill="#FF9800" />
      <circle cx="98.5" cy="38" r="3" fill="#FF9800" />
    </>
  );
}

function FixedAccessory() {
  return (
    <>
      {/* 체크마크 */}
      <circle cx="100" cy="28" r="12" fill="#4CAF50" />
      <path d="M93 28 L98 33 L107 23" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  );
}
