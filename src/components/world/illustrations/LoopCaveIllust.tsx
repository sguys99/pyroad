import { memo } from 'react';

function LoopCaveIllustInner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Rocky ground */}
      <ellipse cx="40" cy="74" rx="48" ry="10" fill="#A1887F" />

      {/* Cave body (dark mountain) */}
      <path d="M 4 72 Q 10 20 40 8 Q 70 20 76 72 Z" fill="#6D4C41" />

      {/* Cave opening */}
      <ellipse cx="40" cy="62" rx="22" ry="16" fill="#3E2723" />

      {/* Inner glow */}
      <ellipse cx="40" cy="60" rx="14" ry="10" fill="#4E342E" />
      <ellipse cx="40" cy="58" rx="8" ry="6" fill="#5D4037" opacity="0.6" />

      {/* Gold glow from inside */}
      <ellipse cx="40" cy="56" rx="6" ry="4" fill="#FFD700" opacity="0.2" />

      {/* Stalactites */}
      <polygon points="24,46 26,46 25,54" fill="#8D6E63" />
      <polygon points="34,44 36.5,44 35.2,53" fill="#8D6E63" />
      <polygon points="44,44 46.5,44 45.2,52" fill="#7E5740" />
      <polygon points="54,46 56,46 55,53" fill="#8D6E63" />

      {/* Loop/cycle arrow symbol inside cave */}
      <g transform="translate(34, 52)">
        <path
          d="M 6 0 A 5 5 0 1 1 1 5"
          stroke="#FFD700"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          opacity="0.8"
        />
        <polygon points="0,3 1,6 3,4" fill="#FFD700" opacity="0.8" />
      </g>

      {/* Small rocks */}
      <ellipse cx="14" cy="70" rx="5" ry="3" fill="#8D6E63" />
      <ellipse cx="66" cy="71" rx="4" ry="2.5" fill="#8D6E63" />
      <ellipse cx="50" cy="73" rx="3" ry="2" fill="#795548" />

      {/* Tiny bats */}
      <path d="M 18 28 Q 20 26 22 28 Q 20 27 18 28" fill="#4E342E" />
      <path d="M 58 32 Q 60 30 62 32 Q 60 31 58 32" fill="#4E342E" />
    </svg>
  );
}

export const LoopCaveIllust = memo(LoopCaveIllustInner);
