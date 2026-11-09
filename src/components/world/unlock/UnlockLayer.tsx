import { Lock } from 'lucide-react';
import { Landmark } from '../map/MapArt';
import type { WorldMapConfig } from '@/lib/content/schema';
import './unlock.css';

/**
 * 잠금 해제 연출에 잠깐 쓰는 겹 (P5-05, 시안 `Signature.tsx` UnlockLayer). 모두 장식이라 `aria-hidden`, 누름은 통과.
 * 움직임은 `unlockFx.ts`가 WAAPI로 걸고, 여기 CSS 는 연출 전 모습(숨김)과 위치만. 연출이 끝나면 WorldMap 이 걷는다
 */

/** 새로 긋는 길 한 조각 (MapArt 길 레이어 안, 레이아웃마다). pathLength 1 이라 dashoffset 1 = 안 보임 */
export function UnlockRoad({ d, width }: { d: string; width: number }) {
  if (!d) return null;
  return (
    <>
      <path
        className="wm-road-ink wu-road"
        d={d}
        strokeWidth={width}
        pathLength={1}
      />
      <path className="wm-road-stitch wu-stitch" d={d} />
    </>
  );
}

/**
 * 스케치였던 랜드마크가 컬러로 깨어나는 겹: 레이아웃마다 지도와 같은 viewBox 에 컬러 랜드마크 하나.
 * 지도 폭에 맞지 않는 쪽은 `.wm-art[data-layout]` 규칙이 숨김
 */
export function UnlockInk({
  map,
  index,
  theme,
  boss,
}: {
  map: WorldMapConfig;
  index: number;
  theme: string;
  boss?: boolean;
}) {
  return (['tall', 'wide'] as const).map((name) => {
    const layout = map.layouts[name];
    const [x, y] = layout.nodes[index];
    return (
      <div key={name} className="wm-art wu-ink" data-layout={name} aria-hidden>
        <svg
          className="wm-layer"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          focusable="false"
        >
          <g transform={`translate(${x} ${y + 6}) scale(${layout.node_scale})`}>
            <Landmark theme={theme} boss={boss} />
          </g>
        </svg>
      </div>
    );
  });
}

/** 이전 노드의 잉크 튐 (도장 둘레) */
export function UnlockSplats({ style }: { style: React.CSSProperties }) {
  return (
    <div className="world-node wu-fx absolute z-30" style={style} aria-hidden>
      <span className="wu-splats">
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} className="wu-splat" />
        ))}
      </span>
    </div>
  );
}

/** 새 노드 위: 자물쇠(두 반쪽 + 조각) · 잉크 방울 · "열렸어요!" 도장 */
export function UnlockMarks({
  style,
  done,
}: {
  style: React.CSSProperties;
  /** 끝: 자물쇠는 사라지고 도장만 잠깐 남았다 흐려짐 */
  done?: boolean;
}) {
  const badge = (
    <span className="wu-lock-face">
      <Lock strokeWidth={2.6} />
    </span>
  );
  return (
    <div
      className={`world-node wu-fx absolute z-30${done ? ' is-done' : ''}`}
      style={style}
      aria-hidden
    >
      <span className="wu-drop" />
      <span className="wu-lock">
        <span className="wu-lock-half" data-side="l">
          {badge}
        </span>
        <span className="wu-lock-half" data-side="r">
          {badge}
        </span>
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className="wu-shard" />
        ))}
      </span>
      <span className="wu-banner font-display">열렸어요!</span>
    </div>
  );
}
