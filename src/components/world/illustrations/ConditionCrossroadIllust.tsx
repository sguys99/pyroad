import { memo } from 'react';

function ConditionCrossroadIllustInner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Ground */}
      <ellipse cx="40" cy="74" rx="48" ry="10" fill="#C8E6C9" />

      {/* Y-shaped path */}
      <path d="M 40 78 L 40 50" stroke="#D7CCC8" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M 40 50 Q 30 40 18 28" stroke="#D7CCC8" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M 40 50 Q 50 40 62 28" stroke="#D7CCC8" strokeWidth="6" fill="none" strokeLinecap="round" />

      {/* Signpost pole */}
      <rect x="38" y="30" width="4" height="28" rx="1" fill="#795548" />

      {/* Left arrow sign - "if" */}
      <g transform="translate(18, 30)">
        <polygon points="0,6 22,0 22,12" fill="#FFB74D" />
        <text x="13" y="9" textAnchor="middle" fontSize="5" fill="#5D4037" fontWeight="bold">if</text>
      </g>

      {/* Right arrow sign - "else" */}
      <g transform="translate(40, 36)">
        <polygon points="22,6 0,0 0,12" fill="#87CEEB" />
        <text x="9" y="9" textAnchor="middle" fontSize="4.5" fill="#37474F" fontWeight="bold">else</text>
      </g>

      {/* Question mark on top */}
      <circle cx="40" cy="24" r="6" fill="#FFF9C4" />
      <text x="40" y="27.5" textAnchor="middle" fontSize="9" fill="#F57F17" fontWeight="bold">?</text>

      {/* Small flowers */}
      <circle cx="12" cy="62" r="2.5" fill="#F48FB1" />
      <circle cx="12" cy="62" r="1" fill="#FFF9C4" />
      <circle cx="68" cy="60" r="2.5" fill="#CE93D8" />
      <circle cx="68" cy="60" r="1" fill="#FFF9C4" />
      <circle cx="28" cy="70" r="2" fill="#F48FB1" />
      <circle cx="28" cy="70" r="0.8" fill="#FFF9C4" />
    </svg>
  );
}

export const ConditionCrossroadIllust = memo(ConditionCrossroadIllustInner);
