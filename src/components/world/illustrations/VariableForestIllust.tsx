import { memo } from 'react';

function VariableForestIllustInner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Ground */}
      <ellipse cx="40" cy="74" rx="48" ry="10" fill="#81C784" />

      {/* Back tree (large) */}
      <rect x="36" y="36" width="4" height="30" rx="1" fill="#6D4C41" />
      <ellipse cx="38" cy="30" rx="14" ry="16" fill="#388E3C" />
      <ellipse cx="32" cy="34" rx="8" ry="10" fill="#43A047" />
      <ellipse cx="44" cy="32" rx="9" ry="11" fill="#2E7D32" />

      {/* Left tree (medium) */}
      <rect x="10" y="42" width="3" height="24" rx="1" fill="#795548" />
      <ellipse cx="11.5" cy="38" rx="10" ry="12" fill="#4CAF50" />
      <ellipse cx="7" cy="41" rx="6" ry="8" fill="#66BB6A" />

      {/* Right tree (small) */}
      <rect x="62" y="48" width="3" height="18" rx="1" fill="#795548" />
      <polygon points="54,48 63.5,28 73,48" fill="#4CAF50" />
      <polygon points="56,42 63.5,24 71,42" fill="#66BB6A" />

      {/* "x = 5" carved text */}
      <rect x="33" y="46" width="14" height="8" rx="2" fill="#5D4037" opacity="0.7" />
      <text x="40" y="52" textAnchor="middle" fontSize="5" fill="#A5D6A7" fontFamily="monospace" fontWeight="bold">
        x=5
      </text>

      {/* Bushes */}
      <circle cx="22" cy="68" r="5" fill="#66BB6A" />
      <circle cx="55" cy="69" r="4" fill="#81C784" />
      <circle cx="50" cy="67" r="3.5" fill="#66BB6A" />

      {/* Fireflies / sparkles */}
      <circle cx="20" cy="35" r="1.2" fill="#FFF9C4" opacity="0.8" />
      <circle cx="52" cy="40" r="1" fill="#FFF9C4" opacity="0.6" />
    </svg>
  );
}

export const VariableForestIllust = memo(VariableForestIllustInner);
