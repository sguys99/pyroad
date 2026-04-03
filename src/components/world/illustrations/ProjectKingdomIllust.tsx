import { memo } from 'react';

function ProjectKingdomIllustInner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Golden ground */}
      <ellipse cx="40" cy="76" rx="44" ry="8" fill="#FFE082" />

      {/* Castle main body */}
      <rect x="18" y="32" width="44" height="40" rx="2" fill="#FFC107" />
      <rect x="20" y="32" width="40" height="40" rx="1" fill="#FFD54F" />

      {/* Left turret */}
      <rect x="10" y="22" width="14" height="50" rx="1" fill="#FFA000" />
      <rect x="12" y="22" width="10" height="50" rx="1" fill="#FFB300" />
      <polygon points="8,22 17,8 26,22" fill="#E91E63" />
      <polygon points="11,22 17,12 23,22" fill="#F06292" opacity="0.5" />
      {/* Turret top ball */}
      <circle cx="17" cy="8" r="2" fill="#FFD700" />

      {/* Right turret */}
      <rect x="56" y="22" width="14" height="50" rx="1" fill="#FFA000" />
      <rect x="58" y="22" width="10" height="50" rx="1" fill="#FFB300" />
      <polygon points="54,22 63,8 72,22" fill="#E91E63" />
      <polygon points="57,22 63,12 69,22" fill="#F06292" opacity="0.5" />
      <circle cx="63" cy="8" r="2" fill="#FFD700" />

      {/* Castle center tower */}
      <rect x="32" y="18" width="16" height="22" rx="1" fill="#FFA000" />
      <rect x="34" y="18" width="12" height="22" rx="1" fill="#FFB300" />
      <polygon points="30,18 40,4 50,18" fill="#E91E63" />

      {/* Crown symbol */}
      <g transform="translate(34, 6)">
        <polygon points="6,0 8,4 12,2 10,7 2,7 0,2 4,4" fill="#FFD700" />
        <circle cx="2" cy="2" r="1" fill="#FFD700" />
        <circle cx="6" cy="0" r="1" fill="#FFD700" />
        <circle cx="10" cy="2" r="1" fill="#FFD700" />
      </g>

      {/* Windows */}
      <rect x="35" y="24" width="4" height="5" rx="1" fill="#5D4037" />
      <rect x="41" y="24" width="4" height="5" rx="1" fill="#5D4037" />
      <rect x="14" y="30" width="4" height="4" rx="1" fill="#5D4037" />
      <rect x="62" y="30" width="4" height="4" rx="1" fill="#5D4037" />

      {/* Main gate */}
      <path d="M 33 72 L 33 54 Q 40 48 47 54 L 47 72 Z" fill="#5D4037" />
      <path d="M 34.5 72 L 34.5 55 Q 40 50 45.5 55 L 45.5 72 Z" fill="#4E342E" />

      {/* Battlements */}
      <rect x="18" y="30" width="3" height="4" rx="0.5" fill="#FFA000" />
      <rect x="24" y="30" width="3" height="4" rx="0.5" fill="#FFA000" />
      <rect x="53" y="30" width="3" height="4" rx="0.5" fill="#FFA000" />
      <rect x="59" y="30" width="3" height="4" rx="0.5" fill="#FFA000" />

      {/* Banner */}
      <line x1="40" y1="4" x2="40" y2="-2" stroke="#6D4C41" strokeWidth="1" />
      <polygon points="40,-2 48,1 40,4" fill="#E91E63" />

      {/* Sparkles */}
      <circle cx="8" cy="16" r="1.5" fill="#FFF9C4" opacity="0.8" />
      <circle cx="72" cy="14" r="1.2" fill="#FFF9C4" opacity="0.7" />
      <circle cx="40" cy="0" r="1.8" fill="#FFF9C4" opacity="0.9" />
    </svg>
  );
}

export const ProjectKingdomIllust = memo(ProjectKingdomIllustInner);
