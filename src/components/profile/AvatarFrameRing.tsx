import './avatarFrame.css';

/**
 * 아바타 테두리 (P9-05 프로필 프레임, 상점 300코인). `UserAvatar` 칩 가장자리에 겹쳐 그린다 — 바깥 크기는 칩과 같아 HUD·게시판 줄이 밀리지 않고,
 * 장식(잎·별·물방울)만 살짝 밖으로 나온다. 색은 토큰(avatarFrame.css), 좌표는 100×100.
 * 32px(HUD·게시판)에서도 읽히게 고리 두께 7(=2.2px)·장식은 2~3개만 크게. 공유 카드(P0-10)에서도 그릴 수 있게 `<text>`·`<image>`·SMIL 없음.
 *
 * - `sprout` 새싹: 연두 고리 + 초록 테두리선, 오른쪽 위 새싹 한 포기 · 왼쪽 아래 잎 하나
 * - `star` 별빛: 금빛 고리 + 금 테두리선, 오른쪽 위 큰 별 · 왼쪽 아래 작은 별 · 점 하나
 * - `wave` 파도: 물빛 물결 고리 + 물마루 거품 선, 왼쪽 위 물방울 두 개
 */
export const FRAME_ARTS = ['sprout', 'star', 'wave'] as const;

/** 4갈래 반짝임 (반지름 10) */
const SPARK =
  'M0 -10 C1 -3.2 3.2 -1 10 0 C3.2 1 1 3.2 0 10 C-1 3.2 -3.2 1 -10 0 C-3.2 -1 -1 -3.2 0 -10Z';

/** 물결 고리 (극좌표 사인) */
function wavePath(r: number, amp: number, waves: number, phase = 0) {
  const pts = Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * Math.PI * 2;
    const rr = r + Math.sin(t * waves + phase) * amp;
    return `${(50 + Math.cos(t) * rr).toFixed(2)} ${(50 + Math.sin(t) * rr).toFixed(2)}`;
  });
  return `M${pts.join('L')}Z`;
}
const WAVE = wavePath(46.2, 2.2, 10);
/** 고리 위 물마루 거품 (반 박자 늦은 물결) */
const FOAM = wavePath(47.2, 1.6, 10, 1.1);

/** 고리 위 각도(도, 0 = 오른쪽, 시계 방향)·반지름에 장식을 똑바로 세워 둔다 */
function at(deg: number, r = 46.5, scale = 1) {
  const t = (deg * Math.PI) / 180;
  return `translate(${(50 + Math.cos(t) * r).toFixed(2)} ${(50 + Math.sin(t) * r).toFixed(2)}) scale(${scale})`;
}

export function AvatarFrameRing({ art }: { art: string }) {
  if (!(FRAME_ARTS as readonly string[]).includes(art)) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      className="avatar-frame"
      data-art={art}
      aria-hidden
      focusable="false"
    >
      {art === 'wave' ? (
        <>
          <path d={WAVE} className="af-band" />
          <path d={FOAM} className="af-in" />
        </>
      ) : (
        <>
          <circle cx="50" cy="50" r="46.5" className="af-band" />
          <circle cx="50" cy="50" r="50" className="af-edge" />
          <circle cx="50" cy="50" r="43" className="af-edge" />
        </>
      )}
      {art === 'sprout' && (
        <>
          <g transform={at(-48, 47, 1.25)} className="af-deco">
            <path d="M0 2 C0 -2 0.5 -5 1 -7" className="af-stem" />
            <path d="M0.6 -5 C-2.5 -5.5 -7.5 -8.5 -8 -13 C-4 -13.5 -0.6 -10 0.6 -5Z" />
            <path d="M1 -7 C3 -9.5 7 -13 11 -12 C10.5 -7.5 5 -5.5 1 -7Z" />
          </g>
          <g transform={`${at(140, 47, 1)} rotate(-130)`} className="af-deco">
            <path d="M0 0 C-3 -2 -4 -8 0 -12 C4 -8 3 -2 0 0Z" />
          </g>
        </>
      )}
      {art === 'star' && (
        <g className="af-deco">
          <path d={SPARK} transform={at(-45, 47, 1.2)} />
          <path d={SPARK} transform={at(150, 47, 0.75)} />
          <circle r="2.6" transform={at(108, 47.5)} />
        </g>
      )}
      {art === 'wave' && (
        <g className="af-deco">
          <circle r="6" transform={at(-140, 49)} />
          <circle r="3.4" transform={at(-112, 52)} />
        </g>
      )}
    </svg>
  );
}
