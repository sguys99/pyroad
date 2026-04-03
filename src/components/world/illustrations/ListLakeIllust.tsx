import { memo } from 'react';

function ListLakeIllustInner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden>
      {/* Sky reflection area */}
      <ellipse cx="40" cy="50" rx="38" ry="22" fill="#B3E5FC" />

      {/* Lake water */}
      <ellipse cx="40" cy="52" rx="36" ry="18" fill="#4FC3F7" />
      <ellipse cx="40" cy="54" rx="32" ry="14" fill="#29B6F6" opacity="0.6" />

      {/* Water ripples */}
      <ellipse cx="30" cy="50" rx="8" ry="2" fill="none" stroke="#E1F5FE" strokeWidth="0.8" opacity="0.7" />
      <ellipse cx="50" cy="54" rx="6" ry="1.5" fill="none" stroke="#E1F5FE" strokeWidth="0.8" opacity="0.6" />
      <ellipse cx="38" cy="58" rx="10" ry="2" fill="none" stroke="#E1F5FE" strokeWidth="0.6" opacity="0.5" />

      {/* Floating bracket symbols */}
      <text x="28" y="48" fontSize="8" fill="#01579B" opacity="0.5" fontFamily="monospace" fontWeight="bold">[</text>
      <text x="50" y="56" fontSize="8" fill="#01579B" opacity="0.5" fontFamily="monospace" fontWeight="bold">]</text>

      {/* Shore / grass edges */}
      <path d="M 2 50 Q 10 38 20 36 Q 30 34 40 32 Q 50 34 60 36 Q 70 38 78 50" fill="#81C784" />
      <ellipse cx="40" cy="70" rx="44" ry="14" fill="#A5D6A7" />

      {/* Lake overlapping shore */}
      <ellipse cx="40" cy="52" rx="36" ry="18" fill="#4FC3F7" />
      <ellipse cx="40" cy="54" rx="32" ry="14" fill="#29B6F6" opacity="0.5" />

      {/* Re-draw ripples on top */}
      <ellipse cx="30" cy="50" rx="8" ry="2" fill="none" stroke="#E1F5FE" strokeWidth="0.8" opacity="0.7" />
      <ellipse cx="50" cy="54" rx="6" ry="1.5" fill="none" stroke="#E1F5FE" strokeWidth="0.8" opacity="0.6" />

      {/* Reeds on left */}
      <line x1="8" y1="46" x2="8" y2="28" stroke="#558B2F" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="8" cy="27" rx="2.5" ry="4" fill="#795548" />
      <line x1="12" y1="44" x2="12" y2="30" stroke="#558B2F" strokeWidth="1" strokeLinecap="round" />
      <ellipse cx="12" cy="29" rx="2" ry="3.5" fill="#6D4C41" />

      {/* Reeds on right */}
      <line x1="70" y1="46" x2="70" y2="32" stroke="#558B2F" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="70" cy="31" rx="2.5" ry="4" fill="#795548" />

      {/* Small lily pad */}
      <ellipse cx="45" cy="48" rx="4" ry="2.5" fill="#66BB6A" opacity="0.7" />
      <circle cx="46" cy="47" r="1.2" fill="#F48FB1" opacity="0.8" />

      {/* Floating bracket text */}
      <text x="28" y="52" fontSize="7" fill="#01579B" opacity="0.4" fontFamily="monospace" fontWeight="bold">[</text>
      <text x="50" y="56" fontSize="7" fill="#01579B" opacity="0.4" fontFamily="monospace" fontWeight="bold">]</text>
    </svg>
  );
}

export const ListLakeIllust = memo(ListLakeIllustInner);
