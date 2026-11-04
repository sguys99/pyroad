/**
 * 카드 장식용 SVG 문자열 생성기. 모두 결정적(seed 고정)이라 같은 카드는 항상 같은 그림이 나옵니다.
 *  - A(모험 섬): 클레이 느낌 도형(방사형 그라디언트 하이라이트), 섬·파도, 색종이
 *  - B(마법 그림책): 손으로 그린 듯 흔들리는 선(wobble), 수채 번짐(blur), 종이 결(feTurbulence)
 */

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const f = (n: number) => n.toFixed(1);

/** 점 목록을 부드러운 닫힌 곡선(Catmull-Rom → Bezier)으로 */
function smoothClosed(pts: [number, number][]): string {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** 흔들리는 원/덩어리 */
export function blobPath(cx: number, cy: number, r: number, wobble: number, seed: number, points = 9): string {
  return ellipseBlobPath(cx, cy, r, r, wobble, seed, points);
}

/** 흔들리는 타원 덩어리 */
export function ellipseBlobPath(cx: number, cy: number, rx: number, ry: number, wobble: number, seed: number, points = 9): string {
  const rnd = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + (rnd() - 0.5) * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smoothClosed(pts);
}

/** 손그림 사각 테두리 (모서리 둥글게, 변마다 살짝 흔들림) */
export function wobblyRectPath(x: number, y: number, w: number, h: number, amp: number, seed: number): string {
  const rnd = rng(seed);
  const j = () => (rnd() - 0.5) * amp;
  const seg = 6;
  const pts: [number, number][] = [];
  for (let i = 0; i < seg; i++) pts.push([x + (w * i) / seg + j(), y + j()]);
  for (let i = 0; i < seg; i++) pts.push([x + w + j(), y + (h * i) / seg + j()]);
  for (let i = 0; i < seg; i++) pts.push([x + w - (w * i) / seg + j(), y + h + j()]);
  for (let i = 0; i < seg; i++) pts.push([x + j(), y + h - (h * i) / seg + j()]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i <= pts.length; i++) {
    const p = pts[i % pts.length];
    const q = pts[(i - 1) % pts.length];
    d += ` Q${f(q[0] + (rnd() - 0.5) * amp)} ${f(q[1] + (rnd() - 0.5) * amp)} ${f((q[0] + p[0]) / 2)} ${f((q[1] + p[1]) / 2)}`;
  }
  return `${d}Z`;
}

/** 손그림 별 (5각, 꼭짓점이 살짝 둥글고 흔들림) */
export function wobblyStarPath(cx: number, cy: number, R: number, seed: number): string {
  const rnd = rng(seed);
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5 + (rnd() - 0.5) * 0.08;
    const r = (i % 2 === 0 ? R : R * 0.47) * (1 + (rnd() - 0.5) * 0.08);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i <= 10; i++) {
    const p = pts[i % 10];
    d += ` L${f(p[0])} ${f(p[1])}`;
  }
  return `${d}Z`;
}

/** 통통한 별 (A안, 둥근 꼭짓점: stroke-linejoin round 로 처리) */
export function starPoints(cx: number, cy: number, R: number, inner = 0.5): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? R : R * inner;
    pts.push(`${f(cx + Math.cos(a) * r)},${f(cy + Math.sin(a) * r)}`);
  }
  return pts.join(' ');
}

export function svg(w: number, h: number, body: string, defs = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
}

// ───────────────────────── A안: 모험 섬 ─────────────────────────

/** 배경: 하늘 + 구름 + 섬 + 파도 (1200×630). 섬 윗면 중심 (islandX, 500) 근처에 캐릭터를 세웁니다. */
export function islandBackground(seed = 7, palette: 'sky' | 'sunset' = 'sky', islandX = 880): string {
  const rnd = rng(seed);
  const sky = palette === 'sky' ? ['#7ED6FF', '#C9F1FF'] : ['#C7B8FF', '#FFD9C2'];
  const sea = palette === 'sky' ? ['#5CCBEF', '#36AEDB', '#2A9CCB'] : ['#9AA8FF', '#7C8CF0', '#6A78E0'];
  const clouds = Array.from({ length: 4 }, (_, i) => {
    const x = 330 + i * 250 + rnd() * 60, y = 50 + rnd() * 60, s = 0.7 + rnd() * 0.45;
    return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(s)})" opacity="0.92">
      <ellipse cx="0" cy="0" rx="58" ry="26" fill="#fff"/><ellipse cx="-34" cy="8" rx="34" ry="20" fill="#fff"/>
      <ellipse cx="36" cy="10" rx="38" ry="20" fill="#fff"/><ellipse cx="0" cy="20" rx="72" ry="12" fill="#E3F6FF"/></g>`;
  }).join('');
  // 색종이: 왼쪽 글자 영역(x<640, y>110)은 비움
  const colors = ['#FF7A70', '#FFD23F', '#5ED6B0', '#FF9FD0', '#7C8CF0', '#FFFFFF'];
  const confetti: string[] = [];
  for (let i = 0; confetti.length < 22 && i < 200; i++) {
    const x = rnd() * 1200, y = 16 + rnd() * 420, c = colors[i % colors.length], r = rnd() * 360;
    if (x < 660 && y > 100) continue;
    const k = i % 3;
    confetti.push(k === 0
      ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(5 + rnd() * 6)}" fill="${c}"/>`
      : k === 1
        ? `<rect x="${f(x)}" y="${f(y)}" width="${f(10 + rnd() * 8)}" height="${f(6 + rnd() * 4)}" rx="3" fill="${c}" transform="rotate(${f(r)} ${f(x)} ${f(y)})"/>`
        : `<path d="M${f(x)} ${f(y)} q8 -10 16 0 t16 0" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none" transform="rotate(${f(r)} ${f(x)} ${f(y)})"/>`);
  }
  const X = islandX;
  const palm = `<g transform="translate(${X + 215} 470)">
      <path d="M0 40 Q-6 -30 10 -90" stroke="#B5794A" stroke-width="14" stroke-linecap="round" fill="none"/>
      <path d="M0 40 Q-6 -30 10 -90" stroke="#D39A63" stroke-width="5" stroke-linecap="round" fill="none" stroke-dasharray="2 12"/>
      <path d="M10 -90 Q-40 -120 -80 -86 Q-40 -98 10 -86Z" fill="#3FB97A"/><path d="M10 -90 Q60 -122 96 -80 Q56 -98 10 -86Z" fill="#46C487"/>
      <path d="M10 -92 Q-10 -150 -50 -150 Q-14 -128 6 -88Z" fill="#5ED69A"/><path d="M10 -92 Q40 -150 80 -140 Q44 -126 14 -88Z" fill="#59CF92"/>
      <circle cx="2" cy="-84" r="8" fill="#8D5A33"/><circle cx="16" cy="-82" r="7" fill="#7A4B2A"/></g>`;
  return svg(
    1200, 630,
    `<rect width="1200" height="630" fill="url(#sky)"/>
     <circle cx="1080" cy="96" r="120" fill="#FFF6B8" opacity="0.5"/><circle cx="1080" cy="96" r="72" fill="#FFF3A0" opacity="0.85"/>
     ${clouds}
     <path d="M0 500 Q150 478 300 498 T600 496 T900 498 T1200 490 L1200 630 L0 630Z" fill="${sea[0]}"/>
     <ellipse cx="${X}" cy="560" rx="330" ry="58" fill="${sea[2]}" opacity="0.5"/>
     <ellipse cx="${X}" cy="532" rx="300" ry="78" fill="url(#sand)"/>
     <ellipse cx="${X - 10}" cy="505" rx="262" ry="56" fill="url(#grass)"/>
     <path d="M${X - 250} 512 Q${X - 120} 548 ${X} 548 Q${X + 140} 548 ${X + 245} 508" stroke="#2FA56B" stroke-width="6" fill="none" opacity="0.5"/>
     <ellipse cx="${X - 90}" cy="486" rx="120" ry="18" fill="#ffffff" opacity="0.25"/>
     <circle cx="${X - 200}" cy="505" r="7" fill="#FF9FD0"/><circle cx="${X - 186}" cy="512" r="5" fill="#FFE36E"/><circle cx="${X + 170}" cy="520" r="6" fill="#FFFFFF"/>
     ${palm}
     <path d="M0 568 Q150 548 300 566 T600 562 T900 568 T1200 556 L1200 630 L0 630Z" fill="${sea[1]}"/>
     <path d="M40 546 q20 -10 40 0 M250 590 q20 -10 40 0 M520 552 q20 -10 40 0 M1100 590 q20 -10 40 0" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.75"/>
     ${confetti.join('')}`,
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient>
     <radialGradient id="grass" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#A6F2C2"/><stop offset="0.55" stop-color="#62D89E"/><stop offset="1" stop-color="#3DB879"/></radialGradient>
     <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A8"/><stop offset="1" stop-color="#F2C46B"/></linearGradient>`,
  );
}

/** 방사형 햇살 (업적 카드 메달 뒤) */
export function sunburst(size: number, rays: number, color: string, opacity = 0.35): string {
  const c = size / 2;
  const body = Array.from({ length: rays }, (_, i) => {
    const a0 = (i / rays) * Math.PI * 2, a1 = a0 + Math.PI / rays;
    return `<path d="M${c} ${c} L${f(c + Math.cos(a0) * c)} ${f(c + Math.sin(a0) * c)} L${f(c + Math.cos(a1) * c)} ${f(c + Math.sin(a1) * c)}Z" fill="${color}"/>`;
  }).join('');
  return svg(size, size, `<g opacity="${opacity}">${body}</g><circle cx="${c}" cy="${c}" r="${c * 0.42}" fill="url(#glow)"/>`,
    `<radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
}

/** 메달 (티어별 색) + 아이콘 path(24×24 Lucide 좌표계) */
export function medal(size: number, tier: 'bronze' | 'silver' | 'gold', iconPaths: string): string {
  const tiers = {
    bronze: ['#F3B37A', '#C9773A', '#8E4F22'],
    silver: ['#F4F7FB', '#B9C4D2', '#7A8797'],
    gold: ['#FFF0A0', '#FFC93C', '#C98A0B'],
  }[tier];
  const s = size;
  return svg(s, s,
    `<path d="M${s * 0.3} ${s * 0.55} L${s * 0.18} ${s * 0.98} L${s * 0.33} ${s * 0.9} L${s * 0.42} ${s * 1.0} L${s * 0.5} ${s * 0.6}Z" fill="#FF7A70"/>
     <path d="M${s * 0.7} ${s * 0.55} L${s * 0.82} ${s * 0.98} L${s * 0.67} ${s * 0.9} L${s * 0.58} ${s * 1.0} L${s * 0.5} ${s * 0.6}Z" fill="#E85D55"/>
     <circle cx="${s / 2}" cy="${s * 0.44}" r="${s * 0.38}" fill="${tiers[2]}"/>
     <circle cx="${s / 2}" cy="${s * 0.42}" r="${s * 0.38}" fill="url(#m)"/>
     <circle cx="${s / 2}" cy="${s * 0.42}" r="${s * 0.3}" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="${s * 0.012}" stroke-dasharray="${s * 0.03} ${s * 0.025}"/>
     <ellipse cx="${s * 0.4}" cy="${s * 0.25}" rx="${s * 0.12}" ry="${s * 0.06}" fill="#fff" opacity="0.55" transform="rotate(-30 ${s * 0.4} ${s * 0.25})"/>
     <g transform="translate(${s * 0.5 - s * 0.17} ${s * 0.42 - s * 0.17}) scale(${(s * 0.34) / 24})" fill="none" stroke="${tiers[2]}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${iconPaths}</g>`,
    `<radialGradient id="m" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${tiers[0]}"/><stop offset="0.65" stop-color="${tiers[1]}"/><stop offset="1" stop-color="${tiers[2]}"/></radialGradient>`);
}

// ───────────────────────── B안: 마법 그림책 ─────────────────────────

/** 종이 배경 (크림 + 결 + 가장자리 번짐 + 손그림 테두리) */
export function paperBackground(seed = 11, { grain = false }: { grain?: boolean } = {}): string {
  return svg(
    1200, 630,
    `<rect width="1200" height="630" fill="#FBF3E2"/>
     ${grain ? '<rect width="1200" height="630" filter="url(#grain)" opacity="0.18"/>' : ''}
     <rect width="1200" height="630" fill="url(#vig)"/>
     <path d="${blobPath(110, 560, 170, 0.35, seed, 10)}" fill="#A8C686" opacity="0.28" filter="url(#soft)"/>
     <path d="${blobPath(1120, 70, 150, 0.35, seed + 1, 10)}" fill="#8EC5E8" opacity="0.30" filter="url(#soft)"/>
     <path d="${wobblyRectPath(26, 26, 1148, 578, 6, seed + 2)}" fill="none" stroke="#7A5C3E" stroke-width="3" stroke-linejoin="round" opacity="0.75"/>
     <path d="${wobblyRectPath(38, 38, 1124, 554, 5, seed + 3)}" fill="none" stroke="#7A5C3E" stroke-width="1.5" stroke-dasharray="2 9" stroke-linecap="round" opacity="0.5"/>`,
    `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}" result="n"/>
       <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.2  0 0 0 0.9 0"/></filter>
     <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
     <radialGradient id="vig" cx="0.5" cy="0.45" r="0.75"><stop offset="0.7" stop-color="#E9D6AE" stop-opacity="0"/><stop offset="1" stop-color="#D9BF8C" stop-opacity="0.45"/></radialGradient>`,
  );
}

/** 수채 번짐 덩어리 (제목 밑 물감 자국). 흐림 가장자리가 잘리지 않게 도형을 상자 안쪽에만 둡니다. */
export function watercolorWash(w: number, h: number, color: string, seed: number): string {
  const rnd = rng(seed);
  const blur = Math.min(w, h) * 0.07;
  const blobs = Array.from({ length: 4 }, (_, i) =>
    `<path d="${ellipseBlobPath(w * (0.46 + rnd() * 0.08), h * (0.48 + rnd() * 0.04), w * (0.3 + rnd() * 0.06), h * (0.24 + rnd() * 0.06), 0.3, seed + i, 10)}" fill="${color}" opacity="${f(0.24 + rnd() * 0.12)}"/>`,
  ).join('');
  return svg(w, h, `<g filter="url(#b)">${blobs}</g>`,
    `<filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${f(blur)}"/></filter>`);
}

/** 손그림 별 줄 (n개 중 got개 칠함) */
export function handStars(got: number, total: number, size: number, seed: number): string {
  const gap = size * 1.12;
  const body = Array.from({ length: total }, (_, i) => {
    const cx = size / 2 + i * gap + 4, cy = size / 2 + 4, R = size * 0.48;
    const d = wobblyStarPath(cx, cy, R, seed + i);
    return i < got
      ? `<path d="${wobblyStarPath(cx + 3, cy + 4, R, seed + i + 50)}" fill="#E8A93A" opacity="0.45"/>
         <path d="${d}" fill="#F7C948"/>
         <path d="${d}" fill="none" stroke="#5B4321" stroke-width="${f(size * 0.045)}" stroke-linejoin="round"/>
         <path d="M${f(cx - R * 0.25)} ${f(cy - R * 0.2)} q${f(R * 0.12)} -${f(R * 0.18)} ${f(R * 0.28)} -${f(R * 0.12)}" stroke="#fff" stroke-width="${f(size * 0.05)}" stroke-linecap="round" fill="none" opacity="0.8"/>`
      : `<path d="${d}" fill="none" stroke="#9C8566" stroke-width="${f(size * 0.04)}" stroke-dasharray="${f(size * 0.08)} ${f(size * 0.06)}" stroke-linejoin="round"/>`;
  }).join('');
  return svg(Math.ceil(size + (total - 1) * gap + 12), Math.ceil(size + 12), body);
}

/** 도장 "참 잘했어요" 링 (글자는 satori 텍스트로 위에 얹음) */
export function stampRing(size: number, color: string, seed: number): string {
  const c = size / 2;
  return svg(size, size,
    `<g opacity="0.88" filter="url(#rough)">
       <path d="${blobPath(c, c, c * 0.9, 0.04, seed, 16)}" fill="none" stroke="${color}" stroke-width="${f(size * 0.05)}"/>
       <path d="${blobPath(c, c, c * 0.76, 0.04, seed + 1, 16)}" fill="none" stroke="${color}" stroke-width="${f(size * 0.018)}"/>
     </g>`,
    `<filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="${f(size * 0.03)}"/></filter>`);
}

/** 손그림 막대 그래프 (주간 카드) */
export function handBars(values: number[], w: number, h: number, seed: number): string {
  const max = Math.max(1, ...values);
  const bw = (w / values.length) * 0.56;
  const rnd = rng(seed);
  const colors = ['#8EC5E8', '#A8C686', '#F2C14E', '#E99A7A', '#B9A3E3', '#8EC5E8', '#A8C686'];
  const body = values.map((v, i) => {
    const x = (w / values.length) * i + (w / values.length - bw) / 2;
    const bh = Math.max(6, (v / max) * (h - 16));
    const y = h - bh;
    return `<path d="${wobblyRectPath(x, y, bw, bh, 3, seed + i)}" fill="${colors[i % colors.length]}" opacity="${f(0.75 + rnd() * 0.2)}"/>
            <path d="${wobblyRectPath(x, y, bw, bh, 3, seed + i + 20)}" fill="none" stroke="#5B4321" stroke-width="2.2" stroke-linejoin="round" opacity="0.8"/>`;
  }).join('');
  return svg(w, h + 4, `${body}<path d="M0 ${h + 1} Q${w / 2} ${h + 4} ${w} ${h}" stroke="#5B4321" stroke-width="2.5" fill="none" stroke-linecap="round"/>`);
}

/** 손그림 밑줄 */
export function scribbleUnderline(w: number, color: string, seed: number): string {
  const rnd = rng(seed);
  const y = 14;
  const d = `M6 ${y + (rnd() - 0.5) * 4} C${w * 0.3} ${y - 6 + rnd() * 4}, ${w * 0.6} ${y + 6 - rnd() * 4}, ${w - 6} ${y - 2 + rnd() * 4}`;
  return svg(w, 28, `<path d="${d}" stroke="${color}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.85"/>`);
}

export const LUCIDE = {
  // Lucide (ISC) 아이콘 path, 24×24
  bug: '<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
};
