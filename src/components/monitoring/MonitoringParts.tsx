import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, CircleSlash } from 'lucide-react';

import { cn } from '@/lib/utils';
import './monitoring.css';

/**
 * 운영 지표 화면 조각 (P12-09, `/admin`). 서버 컴포넌트만 — 브라우저 JS 없음.
 * 차트 라이브러리 없이 숫자 타일 + 인라인 SVG(스파크라인)·막대. 색은 한 가지(primary)만 크기에, 상태색은 아이콘 + 글자와 함께만.
 * 막대·선은 장식(aria-hidden)이고 같은 값이 글자로 옆에 있음. 스파크라인은 낭독 이름에 최솟값·최댓값·마지막 값
 */

export type Status = 'ok' | 'warn' | 'off';

const STATUS_ICON = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  off: CircleSlash,
} as const;

/** 상태 딱지: 아이콘 + 글자 (색만으로 알리지 않음) */
export function StatusChip({
  status,
  children,
}: {
  status: Status;
  children: ReactNode;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <span className="mon-chip" data-status={status}>
      <Icon aria-hidden />
      {children}
    </span>
  );
}

/** 카드 한 묶음 (h2 + 설명) */
export function MonSection({
  title,
  note,
  wide,
  tail,
  children,
  id,
}: {
  title: string;
  note?: ReactNode;
  wide?: boolean;
  /** 세 열 줄의 마지막 칸: 두 열(768~)에서는 혼자 남지 않게 한 줄 전체 */
  tail?: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      className={cn('mon-card', wide && 'mon-wide', tail && 'mon-tail')}
      aria-labelledby={id}
    >
      <header className="mon-card-h">
        <h2 id={id} className="font-display">
          {title}
        </h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}

/** 숫자 타일. off = 수집 안 함 (값 대신 이유) */
export function StatTile({
  label,
  value,
  sub,
  status,
  spark,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  status?: { status: Status; text: string };
  spark?: { values: number[]; label: string };
}) {
  return (
    <div className="mon-tile" data-off={status?.status === 'off' || undefined}>
      <span className="mon-tile-label">{label}</span>
      <span className="mon-tile-value font-display">{value}</span>
      {spark && <Sparkline values={spark.values} label={spark.label} />}
      {sub && <span className="mon-tile-sub">{sub}</span>}
      {status && <StatusChip status={status.status}>{status.text}</StatusChip>}
    </div>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="mon-tiles">{children}</div>;
}

const W = 120;
const H = 32;

/** 스파크라인 (선 하나 + 마지막 점). 값이 모두 0이면 바닥선만 */
export function Sparkline({
  values,
  label,
}: {
  values: number[];
  label: string;
}) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  const pts = values.map(
    (v, i) => [i * step, H - 3 - (v / max) * (H - 6)] as const,
  );
  const last = pts[pts.length - 1];
  const min = values.length ? Math.min(...values) : 0;
  return (
    <svg
      className="mon-spark"
      viewBox={`-3 0 ${W + 6} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: 최소 ${min}, 최대 ${Math.max(0, ...values)}, 마지막 날 ${values.at(-1) ?? 0}`}
    >
      <line className="mon-spark-base" x1="0" x2={W} y1={H - 3} y2={H - 3} />
      {pts.length > 1 && (
        <polyline
          className="mon-spark-line"
          points={pts.map(([x, y]) => `${x},${y}`).join(' ')}
        />
      )}
      {last && (
        <circle className="mon-spark-dot" cx={last[0]} cy={last[1]} r="2.5" />
      )}
    </svg>
  );
}

export interface BarRow {
  label: string;
  /** null = 수집 안 함·계산할 수 없음 */
  value: number | null;
  /** 오른쪽 글자 (기본: 값) */
  text?: ReactNode;
  /** 값 대신 보일 이유 (value가 null일 때) */
  off?: string;
}

/**
 * 가로 막대 목록 (퍼널·분포). 막대 길이는 목록의 가장 큰 값 기준. 글자가 주 정보, 막대는 aria-hidden.
 * 표 의미가 있으므로 `<dl>` 대신 목록 + 각 줄 낭독 = "이름 값"
 */
export function BarList({
  rows,
  caption,
}: {
  rows: BarRow[];
  caption?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <ol className="mon-bars" aria-label={caption}>
      {rows.map((r) => (
        <li key={r.label} data-off={r.value === null || undefined}>
          <span className="mon-bar-label">{r.label}</span>
          <span className="mon-bar-text">
            {r.value === null ? (
              <StatusChip status="off">{r.off ?? '수집 안 함'}</StatusChip>
            ) : (
              (r.text ?? r.value.toLocaleString('ko-KR'))
            )}
          </span>
          <span className="mon-bar-track" aria-hidden>
            {r.value !== null && r.value > 0 && (
              <span
                className="mon-bar-fill"
                style={{ inlineSize: `${(r.value / max) * 100}%` }}
              />
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** 기간 고르기 (링크라 JS 없음). 지금 고른 것은 aria-current */
export function RangeLinks({
  current,
  options,
  basePath,
}: {
  current: number;
  options: { days: number; label: string }[];
  basePath: string;
}) {
  return (
    <nav className="mon-range" aria-label="기간">
      {options.map((o) => (
        <Link
          key={o.days}
          href={`${basePath}?d=${o.days}`}
          aria-current={o.days === current ? 'page' : undefined}
          prefetch={false}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
