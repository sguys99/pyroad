import type { PybaemExpression } from './expressions';

interface PybaemSvgProps {
  expression?: PybaemExpression;
  size?: number;
  className?: string;
}

/**
 * 파이뱀 선생님 SVG 캐릭터.
 * 귀여운 초록색 뱀 캐릭터로 다양한 표정을 지원합니다.
 */
export function PybaemSvg({
  expression = 'happy',
  size = 64,
  className,
}: PybaemSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`파이뱀 선생님 - ${expression}`}
    >
      {/* 몸통 (또아리 틀기) */}
      <g id="body">
        <ellipse cx="64" cy="80" rx="40" ry="28" fill="#66BB6A" />
        <ellipse cx="64" cy="80" rx="40" ry="28" fill="url(#bodyGradient)" />
        {/* 배 부분 */}
        <ellipse cx="64" cy="84" rx="28" ry="18" fill="#A5D6A7" />
        {/* 꼬리 */}
        <path
          d="M24 80 C16 72, 12 60, 20 52 C28 44, 36 48, 32 56"
          stroke="#66BB6A"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
        {/* 꼬리 끝 */}
        <circle cx="20" cy="52" r="5" fill="#4CAF50" />
      </g>

      {/* 머리 */}
      <g id="head">
        <ellipse cx="64" cy="44" rx="28" ry="24" fill="#66BB6A" />
        <ellipse cx="64" cy="44" rx="28" ry="24" fill="url(#headGradient)" />
        {/* 볼 터치 */}
        <ellipse cx="44" cy="50" rx="6" ry="4" fill="#FF8A80" opacity="0.4" />
        <ellipse cx="84" cy="50" rx="6" ry="4" fill="#FF8A80" opacity="0.4" />
      </g>

      {/* 얼굴 */}
      <g id="face">
        {expression === 'happy' && <HappyFace />}
        {expression === 'thinking' && <ThinkingFace />}
        {expression === 'celebrating' && <CelebratingFace />}
        {expression === 'encouraging' && <EncouragingFace />}
        {expression === 'surprised' && <SurprisedFace />}
        {expression === 'teaching' && <TeachingFace />}
        {expression === 'waving' && <WavingFace />}
        {expression === 'sleeping' && <SleepingFace />}
        {expression === 'confused' && <ConfusedFace />}
        {expression === 'proud' && <ProudFace />}
      </g>

      {/* 악세사리 (표정별) */}
      <g id="accessory">
        {expression === 'teaching' && <TeachingAccessory />}
        {expression === 'waving' && <WavingAccessory />}
        {expression === 'celebrating' && <CelebratingAccessory />}
        {expression === 'sleeping' && <SleepingAccessory />}
        {expression === 'confused' && <ConfusedAccessory />}
        {expression === 'proud' && <ProudAccessory />}
      </g>

      <defs>
        <radialGradient id="bodyGradient" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#81C784" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#66BB6A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="headGradient" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#81C784" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#66BB6A" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// === 표정 컴포넌트들 ===

function HappyFace() {
  return (
    <>
      {/* 눈 */}
      <g id="eyes">
        <ellipse cx="52" cy="40" rx="5" ry="5.5" fill="#2E7D32" />
        <ellipse cx="76" cy="40" rx="5" ry="5.5" fill="#2E7D32" />
        <circle cx="53.5" cy="38.5" r="2" fill="white" />
        <circle cx="77.5" cy="38.5" r="2" fill="white" />
      </g>
      {/* 입 - 미소 */}
      <g id="mouth">
        <path
          d="M56 52 Q64 60 72 52"
          stroke="#2E7D32"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </>
  );
}

function ThinkingFace() {
  return (
    <>
      <g id="eyes">
        {/* 왼쪽 눈 - 위를 봄 */}
        <ellipse cx="52" cy="38" rx="5" ry="5.5" fill="#2E7D32" />
        <circle cx="53" cy="36" r="2" fill="white" />
        {/* 오른쪽 눈 - 위를 봄 */}
        <ellipse cx="76" cy="38" rx="5" ry="5.5" fill="#2E7D32" />
        <circle cx="77" cy="36" r="2" fill="white" />
      </g>
      <g id="mouth">
        {/* 입 - 동그란 'o' */}
        <ellipse cx="64" cy="54" rx="4" ry="3.5" fill="#2E7D32" />
      </g>
    </>
  );
}

function CelebratingFace() {
  return (
    <>
      <g id="eyes">
        {/* 눈 - 행복하게 감은 눈 (^_^) */}
        <path d="M47 40 Q52 35 57 40" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M71 40 Q76 35 81 40" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
      <g id="mouth">
        {/* 입 - 크게 웃는 입 */}
        <path d="M52 50 Q64 62 76 50" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M54 50 Q64 58 74 50" fill="#FF8A80" opacity="0.3" />
      </g>
    </>
  );
}

function EncouragingFace() {
  return (
    <>
      <g id="eyes">
        {/* 부드러운 눈 */}
        <ellipse cx="52" cy="40" rx="5" ry="4.5" fill="#2E7D32" />
        <ellipse cx="76" cy="40" rx="5" ry="4.5" fill="#2E7D32" />
        <circle cx="53.5" cy="38.5" r="2" fill="white" />
        <circle cx="77.5" cy="38.5" r="2" fill="white" />
      </g>
      <g id="mouth">
        {/* 따뜻한 미소 */}
        <path d="M56 52 Q64 57 72 52" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </>
  );
}

function SurprisedFace() {
  return (
    <>
      <g id="eyes">
        {/* 큰 눈 */}
        <ellipse cx="52" cy="39" rx="6" ry="7" fill="#2E7D32" />
        <ellipse cx="76" cy="39" rx="6" ry="7" fill="#2E7D32" />
        <circle cx="53.5" cy="37" r="2.5" fill="white" />
        <circle cx="77.5" cy="37" r="2.5" fill="white" />
      </g>
      <g id="mouth">
        {/* 놀란 O 입 */}
        <ellipse cx="64" cy="54" rx="6" ry="5" fill="#2E7D32" />
        <ellipse cx="64" cy="54" rx="4" ry="3.5" fill="#E8F5E9" />
      </g>
    </>
  );
}

function TeachingFace() {
  return (
    <>
      <g id="eyes">
        {/* 한쪽 눈 윙크 */}
        <ellipse cx="52" cy="40" rx="5" ry="5.5" fill="#2E7D32" />
        <circle cx="53.5" cy="38.5" r="2" fill="white" />
        <path d="M71 40 Q76 36 81 40" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
      <g id="mouth">
        <path d="M56 52 Q64 58 72 52" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </>
  );
}

function WavingFace() {
  return (
    <>
      <g id="eyes">
        <ellipse cx="52" cy="40" rx="5" ry="5.5" fill="#2E7D32" />
        <ellipse cx="76" cy="40" rx="5" ry="5.5" fill="#2E7D32" />
        <circle cx="53.5" cy="38.5" r="2" fill="white" />
        <circle cx="77.5" cy="38.5" r="2" fill="white" />
      </g>
      <g id="mouth">
        {/* 활짝 웃는 입 */}
        <path d="M54 50 Q64 60 74 50" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </>
  );
}

function SleepingFace() {
  return (
    <>
      <g id="eyes">
        {/* 감은 눈 */}
        <path d="M47 42 Q52 38 57 42" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M71 42 Q76 38 81 42" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
      <g id="mouth">
        {/* 편안한 입 */}
        <path d="M58 52 Q64 55 70 52" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    </>
  );
}

function ConfusedFace() {
  return (
    <>
      <g id="eyes">
        {/* 한쪽 눈이 더 큰 비대칭 */}
        <ellipse cx="52" cy="40" rx="5" ry="6" fill="#2E7D32" />
        <circle cx="53" cy="38" r="2" fill="white" />
        <ellipse cx="76" cy="40" rx="4" ry="4.5" fill="#2E7D32" />
        <circle cx="77" cy="38.5" r="1.5" fill="white" />
      </g>
      <g id="mouth">
        {/* 삐뚤 입 */}
        <path d="M56 54 Q62 50 70 54" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </>
  );
}

function ProudFace() {
  return (
    <>
      <g id="eyes">
        {/* 별 눈 */}
        <polygon points="52,35 54,39 58,40 55,43 56,47 52,45 48,47 49,43 46,40 50,39" fill="#FFD700" />
        <polygon points="76,35 78,39 82,40 79,43 80,47 76,45 72,47 73,43 70,40 74,39" fill="#FFD700" />
      </g>
      <g id="mouth">
        {/* 당당한 미소 */}
        <path d="M54 50 Q64 60 74 50" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M56 50 Q64 56 72 50" fill="#FF8A80" opacity="0.3" />
      </g>
    </>
  );
}

// === 악세사리 컴포넌트들 ===

function TeachingAccessory() {
  return (
    <>
      {/* 지팡이/포인터 */}
      <line x1="96" y1="30" x2="106" y2="16" stroke="#795548" strokeWidth="3" strokeLinecap="round" />
      <circle cx="107" cy="14" r="3" fill="#FF5722" />
    </>
  );
}

function WavingAccessory() {
  return (
    <>
      {/* 손 (꼬리 쪽에서 흔드는 제스처) */}
      <path
        d="M100 44 Q108 38 104 30"
        stroke="#66BB6A"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="104" cy="28" r="4" fill="#81C784" />
    </>
  );
}

function CelebratingAccessory() {
  return (
    <>
      {/* 반짝이 효과 */}
      <circle cx="30" cy="24" r="3" fill="#FFD700" opacity="0.8" />
      <circle cx="98" cy="20" r="2.5" fill="#FFD700" opacity="0.7" />
      <circle cx="20" cy="44" r="2" fill="#FFD700" opacity="0.6" />
      <circle cx="108" cy="48" r="2" fill="#FFD700" opacity="0.6" />
    </>
  );
}

function SleepingAccessory() {
  return (
    <>
      {/* Zzz */}
      <text x="88" y="28" fontSize="14" fill="#7986CB" fontWeight="bold" opacity="0.7">Z</text>
      <text x="96" y="20" fontSize="11" fill="#7986CB" fontWeight="bold" opacity="0.5">z</text>
      <text x="102" y="14" fontSize="8" fill="#7986CB" fontWeight="bold" opacity="0.3">z</text>
    </>
  );
}

function ConfusedAccessory() {
  return (
    <>
      {/* 물음표 */}
      <text x="86" y="26" fontSize="18" fill="#FF9800" fontWeight="bold" opacity="0.8">?</text>
    </>
  );
}

function ProudAccessory() {
  return (
    <>
      {/* 왕관 */}
      <polygon points="50,22 54,14 58,20 64,10 70,20 74,14 78,22" fill="#FFD700" />
      <rect x="50" y="22" width="28" height="4" rx="1" fill="#FFD700" />
      <circle cx="58" cy="16" r="1.5" fill="#E91E63" />
      <circle cx="64" cy="12" r="1.5" fill="#2196F3" />
      <circle cx="70" cy="16" r="1.5" fill="#E91E63" />
    </>
  );
}
