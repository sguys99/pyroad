import { memo } from 'react';

function FunctionTowerIllustInner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Ground with small hill */}
      <ellipse cx="40" cy="76" rx="44" ry="8" fill="#B0BEC5" />

      {/* Tower base (wider) */}
      <rect x="24" y="50" width="32" height="24" rx="2" fill="#78909C" />
      <rect x="26" y="50" width="28" height="24" rx="1" fill="#90A4AE" />

      {/* Tower middle */}
      <rect x="27" y="28" width="26" height="24" rx="1" fill="#78909C" />
      <rect x="29" y="28" width="22" height="24" rx="1" fill="#90A4AE" />

      {/* Tower top */}
      <rect x="30" y="14" width="20" height="16" rx="1" fill="#78909C" />
      <rect x="32" y="14" width="16" height="16" rx="1" fill="#90A4AE" />

      {/* Pointed roof */}
      <polygon points="28,14 40,2 52,14" fill="#7B1FA2" />
      <polygon points="32,14 40,5 48,14" fill="#9C27B0" opacity="0.6" />

      {/* Flag on top */}
      <line x1="40" y1="2" x2="40" y2="-4" stroke="#6D4C41" strokeWidth="1.5" strokeLinecap="round" />
      <polygon points="40,-4 50,-1 40,2" fill="#FFD700" />

      {/* Windows */}
      <rect x="35" y="18" width="5" height="6" rx="1" fill="#3E2723" />
      <rect x="36" y="19" width="3" height="4" rx="0.5" fill="#FFF9C4" opacity="0.4" />

      <rect x="33" y="34" width="5" height="5" rx="1" fill="#3E2723" />
      <rect x="42" y="34" width="5" height="5" rx="1" fill="#3E2723" />

      <rect x="33" y="42" width="5" height="5" rx="1" fill="#3E2723" />
      <rect x="42" y="42" width="5" height="5" rx="1" fill="#3E2723" />

      {/* Door with "def" text */}
      <rect x="35" y="58" width="10" height="14" rx="1.5" fill="#5D4037" />
      <rect x="36.5" y="59.5" width="7" height="11" rx="1" fill="#4E342E" />
      <text x="40" y="67" textAnchor="middle" fontSize="4.5" fill="#CE93D8" fontFamily="monospace" fontWeight="bold">
        def
      </text>

      {/* Battlements on top of base */}
      <rect x="22" y="48" width="4" height="4" rx="0.5" fill="#607D8B" />
      <rect x="29" y="48" width="4" height="4" rx="0.5" fill="#607D8B" />
      <rect x="47" y="48" width="4" height="4" rx="0.5" fill="#607D8B" />
      <rect x="54" y="48" width="4" height="4" rx="0.5" fill="#607D8B" />

      {/* Small sparkle near top */}
      <circle cx="50" cy="8" r="1.5" fill="#FFF9C4" opacity="0.7" />
      <circle cx="28" cy="12" r="1" fill="#FFF9C4" opacity="0.5" />
    </svg>
  );
}

export const FunctionTowerIllust = memo(FunctionTowerIllustInner);
