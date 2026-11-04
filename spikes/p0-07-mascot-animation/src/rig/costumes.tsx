// 코스튬 레이어 (Phase 9 F6 미리보기). 모두 같은 128×128 좌표계, 리그 그룹 안에 들어간다.
// - 모자: 머리 그룹 안 (머리 회전·흔들림을 같이 받음 + 자체 출렁임 hatRot)
// - 안경: 얼굴 그룹 안 (시선 시차를 같이 받음, 눈동자는 안경 안에서 움직임)
// - 망토: 몸 뒤 (자락이 capeSwing으로 출렁)
// - 배경: 리그 밖 (정적)
export type HatKind = 'party' | 'explorer' | 'crown' | 'wizard';
export type GlassesKind = 'round' | 'sun';
export type BackdropKind = 'island' | 'paper';
export interface Costume {
  hat?: HatKind;
  glasses?: GlassesKind;
  cape?: string; // 망토 색
  bg?: BackdropKind;
}

export function Hat({ kind, outline }: { kind: HatKind; outline?: string }) {
  const ol = outline ? { stroke: outline, strokeWidth: 1.6, strokeLinejoin: 'round' as const } : {};
  switch (kind) {
    case 'party':
      return (
        <g transform="rotate(-12 64 24)">
          <path d="M50 25 L64 -6 L78 25 Z" fill="#FF7043" {...ol} />
          <path d="M54.5 15 L73.5 15 L75.6 20 L52.4 20 Z" fill="#FFF176" opacity="0.95" />
          <path d="M59 5 L69 5 L70.8 9.5 L57.2 9.5 Z" fill="#4FC3F7" opacity="0.95" />
          <ellipse cx="64" cy="25" rx="14.5" ry="3" fill="#E64A19" {...ol} />
          <circle cx="64" cy="-7" r="4.2" fill="#FFF59D" {...ol} />
        </g>
      );
    case 'explorer':
      return (
        <g>
          <ellipse cx="64" cy="24" rx="33" ry="5.5" fill="#C9A66B" {...ol} />
          <path d="M41 24 Q42 3 64 1 Q86 3 87 24 Z" fill="#DDBF86" {...ol} />
          <path d="M42 19 Q64 14 86 19 L86.6 23 Q64 18 41.4 23 Z" fill="#8D6E63" />
          <ellipse cx="57" cy="8" rx="6" ry="2.6" fill="#fff" opacity="0.35" transform="rotate(-15 57 8)" />
        </g>
      );
    case 'crown':
      return (
        <g transform="translate(0 2)">
          <polygon points="48,22 52,8 58,17 64,4 70,17 76,8 80,22" fill="#FFCA28" {...ol} />
          <rect x="48" y="20" width="32" height="5" rx="1.5" fill="#FFB300" {...ol} />
          <circle cx="58" cy="13" r="1.8" fill="#EC407A" />
          <circle cx="64" cy="9" r="1.8" fill="#42A5F5" />
          <circle cx="70" cy="13" r="1.8" fill="#EC407A" />
        </g>
      );
    case 'wizard':
      return (
        <g transform="rotate(8 64 24)">
          <ellipse cx="64" cy="24" rx="26" ry="5" fill="#5E35B1" {...ol} />
          <path d="M48 24 Q58 8 60 -2 Q66 -14 80 -12 Q70 -6 72 4 Q74 14 80 24 Z" fill="#7E57C2" {...ol} />
          <path d="M61 10 l1.4 3 3.2 .4 -2.4 2.2 .7 3.2 -2.9 -1.6 -2.9 1.6 .7 -3.2 -2.4 -2.2 3.2 -.4Z" fill="#FFF176" />
          <circle cx="71" cy="2" r="1.4" fill="#FFF176" />
        </g>
      );
  }
}

export function Glasses({ kind }: { kind: GlassesKind }) {
  const lens = kind === 'sun' ? { fill: '#263238', opacity: 0.88 } : { fill: '#E3F2FD', opacity: 0.22 };
  return (
    <g>
      <circle cx="52" cy="40" r="8.4" {...lens} />
      <circle cx="76" cy="40" r="8.4" {...lens} />
      <circle cx="52" cy="40" r="8.4" fill="none" stroke="#37474F" strokeWidth="2.2" />
      <circle cx="76" cy="40" r="8.4" fill="none" stroke="#37474F" strokeWidth="2.2" />
      <path d="M60.3 38.6 Q64 35.8 67.7 38.6" stroke="#37474F" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M43.7 38 L37 35.5 M84.3 38 L91 35.5" stroke="#37474F" strokeWidth="2" strokeLinecap="round" />
      {kind === 'sun' && <path d="M47 36 l3 -2 M71 36 l3 -2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />}
    </g>
  );
}

export function Cape({
  refCb,
  d,
  color,
  outline,
}: {
  refCb?: (el: Element | null) => void;
  d?: string;
  color: string;
  outline?: string;
}) {
  return (
    <path
      ref={refCb}
      d={d}
      fill={color}
      stroke={outline ?? 'rgba(0,0,0,0.15)'}
      strokeWidth={outline ? 2 : 1}
      strokeLinejoin="round"
    />
  );
}

export function Backdrop({ kind }: { kind: BackdropKind }) {
  if (kind === 'paper') {
    return (
      <g>
        <circle cx="64" cy="62" r="66" fill="#FBF3E0" />
        <circle cx="64" cy="62" r="62" fill="none" stroke="#C9B48A" strokeWidth="1.6" strokeDasharray="5 3 9 4" />
        <path d="M14 104 Q40 96 64 104 T114 102" stroke="#A9C7D9" strokeWidth="5" fill="none" opacity="0.6" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <defs>
        <linearGradient id="pyBgSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B3E5FC" />
          <stop offset="1" stopColor="#E1F5FE" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="62" r="66" fill="url(#pyBgSky)" />
      <ellipse cx="64" cy="118" rx="70" ry="14" fill="#4FC3F7" opacity="0.55" />
      <ellipse cx="64" cy="112" rx="52" ry="9" fill="#FFE082" />
      <circle cx="104" cy="14" r="10" fill="#FFF59D" opacity="0.9" />
      <path d="M8 30 q8 -8 16 0 q8 -6 14 2 h-30Z" fill="#fff" opacity="0.9" />
    </g>
  );
}
