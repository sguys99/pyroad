import { memo } from 'react';
import type { ByeolttongiExpression } from './expressions';

interface ByeolttongiSvgProps {
  expression?: ByeolttongiExpression;
  size?: number;
  className?: string;
}

/**
 * 별똥이 SVG 캐릭터.
 * 반짝이는 별똥별 보상/XP 캐릭터로 3가지 표정을 지원합니다.
 */
export const ByeolttongiSvg = memo(function ByeolttongiSvg({
  expression = 'sparkling',
  size = 64,
  className,
}: ByeolttongiSvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`별똥이 - ${expression}`}
    >
      {/* 꼬리 트레일 (flying 시 강조) */}
      {expression === 'flying' && <FlyingTrail />}

      {/* 별 몸체 */}
      <g id="body">
        <polygon
          points="64,16 72,48 104,48 78,66 88,98 64,80 40,98 50,66 24,48 56,48"
          fill="#FFD54F"
        />
        <polygon
          points="64,16 72,48 104,48 78,66 88,98 64,80 40,98 50,66 24,48 56,48"
          fill="url(#starGradient)"
        />
        {/* 내부 밝은 영역 */}
        <polygon
          points="64,30 69,48 86,48 72,58 77,76 64,66 51,76 56,58 42,48 59,48"
          fill="#FFF9C4"
          opacity="0.6"
        />
      </g>

      {/* 얼굴 */}
      <g id="face">
        {expression === 'flying' && <FlyingFace />}
        {expression === 'landing' && <LandingFace />}
        {expression === 'sparkling' && <SparklingFace />}
      </g>

      {/* 악세사리 */}
      <g id="accessory">
        {expression === 'landing' && <LandingAccessory />}
        {expression === 'sparkling' && <SparklingAccessory />}
      </g>

      <defs>
        <radialGradient id="starGradient" cx="0.5" cy="0.4">
          <stop offset="0%" stopColor="#FFEE58" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#FFD54F" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
});

// === 표정 컴포넌트들 ===

function FlyingFace() {
  return (
    <>
      <g id="eyes">
        {/* 집중하는 눈 - 약간 가늘게 */}
        <ellipse cx="56" cy="52" rx="4" ry="3.5" fill="#F57F17" />
        <circle cx="57" cy="51" r="1.5" fill="white" />
        <ellipse cx="72" cy="52" rx="4" ry="3.5" fill="#F57F17" />
        <circle cx="73" cy="51" r="1.5" fill="white" />
      </g>
      <g id="mouth">
        {/* 결의에 찬 입 */}
        <path d="M59 60 Q64 63 69 60" stroke="#F57F17" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    </>
  );
}

function LandingFace() {
  return (
    <>
      <g id="eyes">
        {/* 밝은 눈 */}
        <ellipse cx="56" cy="52" rx="5" ry="5.5" fill="#F57F17">
          <animate
            attributeName="ry"
            values="5.5;0.5;5.5"
            dur="0.15s"
            begin="3s;landBlinkL.end+4s"
            id="landBlinkL"
          />
        </ellipse>
        <circle cx="57.5" cy="50.5" r="2" fill="white">
          <animate
            attributeName="opacity"
            values="1;0;1"
            dur="0.15s"
            begin="3s;landBlinkLH.end+4s"
            id="landBlinkLH"
          />
        </circle>
        <ellipse cx="72" cy="52" rx="5" ry="5.5" fill="#F57F17">
          <animate
            attributeName="ry"
            values="5.5;0.5;5.5"
            dur="0.15s"
            begin="3s;landBlinkR.end+4s"
            id="landBlinkR"
          />
        </ellipse>
        <circle cx="73.5" cy="50.5" r="2" fill="white">
          <animate
            attributeName="opacity"
            values="1;0;1"
            dur="0.15s"
            begin="3s;landBlinkRH.end+4s"
            id="landBlinkRH"
          />
        </circle>
      </g>
      <g id="mouth">
        {/* 미소 */}
        <path d="M58 60 Q64 66 70 60" stroke="#F57F17" strokeWidth="2" strokeLinecap="round" fill="none" />
      </g>
    </>
  );
}

function SparklingFace() {
  return (
    <>
      <g id="eyes">
        {/* 반짝 눈 (^_^) */}
        <path d="M51 52 Q56 47 61 52" stroke="#F57F17" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M67 52 Q72 47 77 52" stroke="#F57F17" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
      <g id="mouth">
        {/* 활짝 웃는 입 */}
        <path d="M56 58 Q64 66 72 58" stroke="#F57F17" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M58 58 Q64 63 70 58" fill="#FFB300" opacity="0.3" />
      </g>
    </>
  );
}

// === 트레일/악세사리 컴포넌트들 ===

function FlyingTrail() {
  return (
    <g id="trail">
      {/* 비행 꼬리 트레일 */}
      <path
        d="M40 98 Q20 110 10 118"
        stroke="#FFD54F"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      >
        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1s" repeatCount="indefinite" />
      </path>
      <path
        d="M36 96 Q14 112 6 122"
        stroke="#FFE082"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.4"
      >
        <animate attributeName="opacity" values="0.4;0.1;0.4" dur="1.2s" repeatCount="indefinite" />
      </path>
      {/* 작은 파티클 */}
      <circle cx="22" cy="108" r="2" fill="#FFD54F" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0;0.5" dur="0.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="14" cy="116" r="1.5" fill="#FFE082" opacity="0.3">
        <animate attributeName="opacity" values="0.3;0;0.3" dur="1s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function LandingAccessory() {
  return (
    <>
      {/* 착지 이펙트 라인 */}
      <line x1="42" y1="104" x2="34" y2="110" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <line x1="64" y1="106" x2="64" y2="114" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <line x1="86" y1="104" x2="94" y2="110" stroke="#FFB300" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </>
  );
}

function SparklingAccessory() {
  return (
    <>
      {/* 주변 작은 별 4개 - 깜빡 애니메이션 */}
      <g>
        <polygon points="18,30 20,26 22,30 20,34" fill="#FFD54F">
          <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
        </polygon>
      </g>
      <g>
        <polygon points="108,24 110,20 112,24 110,28" fill="#FFE082">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
        </polygon>
      </g>
      <g>
        <polygon points="14,76 16,72 18,76 16,80" fill="#FFE082">
          <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.8s" repeatCount="indefinite" />
        </polygon>
      </g>
      <g>
        <polygon points="112,70 114,66 116,70 114,74" fill="#FFD54F">
          <animate attributeName="opacity" values="0.2;0.9;0.2" dur="1.3s" repeatCount="indefinite" />
        </polygon>
      </g>
    </>
  );
}
