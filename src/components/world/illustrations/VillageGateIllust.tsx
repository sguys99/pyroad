import { memo } from 'react';

function VillageGateIllustInner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Rolling green hills */}
      <ellipse cx="40" cy="72" rx="50" ry="14" fill="#A5D6A7" />
      <ellipse cx="15" cy="74" rx="22" ry="10" fill="#81C784" />
      <ellipse cx="65" cy="73" rx="20" ry="11" fill="#81C784" />

      {/* Path leading to gate */}
      <path d="M 35 80 Q 38 65 40 55" stroke="#D7CCC8" strokeWidth="6" fill="none" strokeLinecap="round" />

      {/* Left house */}
      <rect x="6" y="42" width="16" height="14" rx="1" fill="#FFCC80" />
      <polygon points="4,42 14,30 24,42" fill="#E57373" />
      <rect x="11" y="48" width="5" height="8" rx="0.5" fill="#795548" />

      {/* Right house */}
      <rect x="56" y="44" width="14" height="12" rx="1" fill="#FFE0B2" />
      <polygon points="54,44 63,33 72,44" fill="#EF9A9A" />
      <rect x="61" y="49" width="4" height="7" rx="0.5" fill="#795548" />

      {/* Gate */}
      <rect x="30" y="34" width="4" height="22" rx="1" fill="#795548" />
      <rect x="46" y="34" width="4" height="22" rx="1" fill="#795548" />
      <path d="M 30 34 Q 40 24 50 34" stroke="#795548" strokeWidth="3.5" fill="none" strokeLinecap="round" />

      {/* Gate sign */}
      <rect x="34" y="28" width="12" height="7" rx="1.5" fill="#FFE082" />
      <text x="40" y="34" textAnchor="middle" fontSize="4.5" fill="#5D4037" fontWeight="bold">
        START
      </text>

      {/* Small tree beside gate */}
      <rect x="24" y="46" width="3" height="8" rx="0.5" fill="#6D4C41" />
      <circle cx="25.5" cy="42" r="6" fill="#66BB6A" />
      <circle cx="22" cy="44" r="4" fill="#4CAF50" />
    </svg>
  );
}

export const VillageGateIllust = memo(VillageGateIllustInner);
