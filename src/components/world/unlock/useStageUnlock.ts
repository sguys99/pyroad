'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { PybaemState } from '@/components/characters/rig';
import { useSfx } from '@/components/providers/soundContext';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  playUnlock,
  samplePath,
  type UnlockScene,
} from '@/lib/celebration/unlockFx';
import { pickUnlockIndex, type UnlockPlan } from '@/lib/world/unlockSeen';
import type { WorldMapConfig } from '@/lib/content/schema';
import type { StageWithStatus } from '@/lib/types/database';
import { HERE_MARKER } from '@/lib/world/worlds';

/**
 * 잠금 해제 연출 흐름 (P5-05). WorldMap 이 부르고, 연출 박자는 `unlockFx.ts`.
 *
 * - 기록이 없는 사용자(plan.silent): 지금 열린 스테이지를 연출 없이 기록만 (기존 사용자에게 연출이 줄줄이 나오지 않게)
 * - 새로 열린 스테이지가 이 지도에 있으면 마지막 것 하나를 연출: before(연출 전 모습: 그 노드는 잠김, 파이뱀은 이전 노드)
 *   → (화면 밖이면 스크롤) → play → done(실제 상태). minimal·동작 줄이기는 before 없이 바로 done + 문구
 * - 끝나면(건너뛰어도) 문구 토스트 한 번(화면 낭독기도 읽음) + 기록 저장. 저장이 실패해도 화면은 그대로(다음 방문에 다시 나올 수 있음)
 * - 같은 세션에서 다시 오면(퀘스트 갔다 뒤로) 저장이 끝나기 전이어도 다시 틀지 않는다 (모듈 `handled`)
 * - 재생 중 화면 어디든 누르거나 Enter·Space·Esc → 끝 상태로 (시안 attachSkip, 첫 누름은 건너뛰기만 하고 삼킴)
 */

const handled = new Set<string>();

function record(ids: string[]) {
  if (!ids.length) return;
  void fetch('/api/world/unlocks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stageIds: ids }),
    keepalive: true,
  }).catch(() => {});
}

export type UnlockPhase = 'idle' | 'before' | 'play' | 'done';

interface Options {
  /** order 순 스테이지 (이 지도) */
  sorted: StageWithStatus[];
  map: WorldMapConfig;
  plan?: UnlockPlan | null;
  /** 카탈로그 데모: 기록하지 않고, 같은 세션에서도 다시 틂 */
  demo?: boolean;
  box: React.RefObject<HTMLDivElement | null>;
  /** 끝났을 때 문구 (토스트) */
  onOpened: (stage: StageWithStatus) => void;
}

export function useStageUnlock({
  sorted,
  map,
  plan,
  demo,
  box,
  onOpened,
}: Options) {
  const { budget } = useMotionTier();
  const sfx = useSfx();
  // 처음 그릴 때 한 번 정한다 (기록을 보낸 뒤 서버 데이터가 바뀌어도 이번 방문의 연출은 그대로)
  const [target] = useState(() => {
    if (!plan || plan.silent) return -1;
    const fresh = demo
      ? plan.stageIds
      : plan.stageIds.filter((id) => !handled.has(id));
    return pickUnlockIndex(sorted, fresh);
  });
  const from = target > 0 ? target - 1 : -1;
  const [phase, setPhase] = useState<UnlockPhase>(
    target >= 0 ? 'before' : 'idle',
  );
  const [open, setOpen] = useState(false);
  const [rig, setRig] = useState<PybaemState>('happy');
  const scene = useRef<UnlockScene | null>(null);
  const ended = useRef(false);

  // 기록할 것: 이 지도에서 새로 열린 스테이지 (다른 월드 것은 그 지도를 열 때)
  const mine = useRef<string[]>([]);
  if (plan && !plan.silent && !mine.current.length) {
    const here = new Set(sorted.map((s) => s.id));
    mine.current = plan.stageIds.filter((id) => here.has(id));
  }

  // 렌더마다 새로 만들어지는 값은 ref 로 (효과·타이머가 렌더마다 다시 걸리지 않게)
  const latest = useRef({ sorted, onOpened });
  latest.current = { sorted, onOpened };
  const finishAll = useCallback(() => {
    if (ended.current || target < 0) return;
    ended.current = true;
    setOpen(true);
    setPhase('done');
    latest.current.onOpened(latest.current.sorted[target]);
    if (!demo) record(mine.current);
  }, [demo, target]);

  // 조용한 기록 (기록이 하나도 없는 사용자)
  useEffect(() => {
    if (demo || !plan?.silent) return;
    const ids = plan.stageIds.filter((id) => !handled.has(id));
    ids.forEach((id) => handled.add(id));
    record(ids);
  }, [demo, plan]);

  // 시작: minimal·동작 줄이기는 바로 끝 상태, 아니면 그 노드가 보이게 스크롤한 뒤 재생
  const springs = budget.springs;
  useEffect(() => {
    if (target < 0 || phase !== 'before') return;
    if (!demo) mine.current.forEach((id) => handled.add(id));
    if (!springs) {
      finishAll();
      return;
    }
    const node = box.current?.querySelector(
      `[data-unlock='to']`,
    ) as HTMLElement | null;
    let wait = 350;
    if (node) {
      const r = node.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 40) {
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        wait = 650;
      }
    }
    const t = window.setTimeout(() => setPhase('play'), wait);
    return () => window.clearTimeout(t);
  }, [box, demo, finishAll, phase, springs, target]);

  // 재생: 노드·길·겹 요소를 모아 박자표에 넘김
  useLayoutEffect(() => {
    if (phase !== 'play' || !box.current) return;
    const root = box.current;
    const q = <T extends Element>(sel: string) => root.querySelector<T>(sel);
    const qa = <T extends Element>(sel: string) => [
      ...root.querySelectorAll<T>(sel),
    ];
    const visible = <T extends Element>(els: T[]) =>
      els.find((el) => el.getBoundingClientRect().width > 0) ?? null;

    const roads = qa<SVGGeometryElement>('.wu-road');
    const road = visible(roads);
    const layoutName = (road?.closest('.wm-art') as HTMLElement | null)?.dataset
      .layout as 'wide' | 'tall' | undefined;
    const ink = visible(qa<HTMLElement>('.wu-ink'));
    const layout =
      map.layouts[
        layoutName ?? (ink?.dataset.layout as 'wide' | 'tall') ?? 'tall'
      ];
    const k = root.clientWidth / layout.width;

    // 파이뱀은 노드 옆(--dx 쪽)에 선다: 이전 노드와 새 노드에서 서는 쪽이 다르면 이동 중에 같이 옮긴다
    const dx = (sel: string) =>
      Number(getComputedStyle(q(sel) ?? root).getPropertyValue('--dx')) || 0;
    let walk: { x: number; y: number }[] = [];
    if (road && from >= 0) {
      walk = samplePath(road, k);
      const shift =
        (dx("[data-unlock='to']") - dx("[data-unlock='from']")) *
        HERE_MARKER.offset *
        k;
      walk.forEach((p, i) => (p.x += (shift * i) / (walk.length - 1)));
    }
    const [x, y] = layout.nodes[target];
    const ns = layout.node_scale;

    scene.current = playUnlock(
      {
        map: root,
        stamp: q<HTMLElement>(`[data-unlock='from'] .wn-stamp`),
        splats: qa<HTMLElement>('.wu-splat'),
        roads,
        stitches: qa<SVGElement>('.wu-stitch'),
        lock: q<HTMLElement>('.wu-lock'),
        halves: qa<HTMLElement>('.wu-lock-half'),
        shards: qa<HTMLElement>('.wu-shard'),
        drop: q<HTMLElement>('.wu-drop'),
        ink,
        // 번짐 중심 = 랜드마크 가운데 (바닥에서 약 50단위 위), 크기 = 랜드마크를 넉넉히 덮게
        inkAt: { x: x * k, y: (y - 44 * ns) * k, size: 300 * ns * k },
        walker: q<HTMLElement>('.wu-walker'),
        walk,
        plate: q<HTMLElement>(`[data-unlock='to'] .wn-plate`),
        banner: q<HTMLElement>('.wu-banner'),
      },
      budget,
      {
        lock: () => sfx('unlock'), // 효과음 자리 (P5-11 이 소리·타이밍을 정리)
        walk: () => setRig('happy'),
        land: () => setRig('cheer'),
        open: () => setOpen(true),
      },
    );
    void scene.current.done.then(finishAll);
    // budget·sfx 가 바뀌어도 재생 중인 연출은 그대로 둔다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 끝 상태를 React 가 그렸으면 연출 효과를 걷는다 (fill 이 남아 있으면 실제 자리와 겹침)
  useLayoutEffect(() => {
    if (phase === 'done') scene.current?.cancel();
  }, [phase]);
  useEffect(() => () => scene.current?.cancel(), []);

  // 건너뛰기: 재생 중 어디든 누르거나 Enter·Space·Esc
  useEffect(() => {
    if (phase !== 'before' && phase !== 'play') return;
    const skip = () => {
      if (scene.current?.playing()) scene.current.finish();
      else finishAll();
    };
    const onDown = (e: PointerEvent) => {
      skip();
      e.preventDefault();
      // 건너뛴 누름의 click 은 삼킨다 (밑의 노드가 같이 눌려 시트가 열리지 않게). 끝나면서 이 효과가 걷혀도 남도록 따로 단다
      const swallow = (c: MouseEvent) => {
        c.stopPropagation();
        c.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(
        () => window.removeEventListener('click', swallow, true),
        800,
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== ' ') return;
      skip();
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [finishAll, phase]);

  const active = phase === 'before' || phase === 'play';
  return { target, from, phase, active, open, rig };
}
