// 실제 흐름의 축하: celebrate('quest-clear' | 'quiz-clear')가 열고, 시그니처 모션 시퀀스(signature.tsx)를 재생한다.
// 경험치가 넘치면 카드 위로 레벨업 연출이 이어진다 (P2-05). #motion 무대와 같은 build 함수.
import { useEffect, useRef, useState } from 'react';
import { goScreen } from '../shared/app';
import { getMotion } from '../shared/motion';
import { CELEBRATE_EVENT, layer, type CelebrateDetail } from './celebrate';
import { Seq, type Mode } from './seq';
import { ClearCard, LevelUpOverlay, buildClear, buildLevelUp, hudRefs } from './signature';
import { TITLES, getStore, setStore, xpNeed } from './store';

type RigS = 'idle' | 'talk' | 'think' | 'happy' | 'sad' | 'cheer' | 'dance';

const modeNow = (): Mode => {
  const m = getMotion();
  return m.reduced ? 'reduced' : m.tier;
};

export function CelebrationLayer({ onNext }: { onNext?: () => void }) {
  const [d, setD] = useState<CelebrateDetail | null>(null);
  const [lv, setLv] = useState<{ from: number; to: number; rest: number } | null>(null);
  const [rig, setRig] = useState<RigS>('happy');
  const [lvRig, setLvRig] = useState<RigS>('happy');
  const card = useRef<HTMLDivElement | null>(null);
  const lvRef = useRef<HTMLDivElement | null>(null);
  const seqs = useRef<Seq[]>([]);
  const pending = useRef<(() => void)[]>([]);

  useEffect(() => {
    const on = (e: Event) => setD((e as CustomEvent<CelebrateDetail>).detail);
    window.addEventListener(CELEBRATE_EVENT, on);
    return () => window.removeEventListener(CELEBRATE_EVENT, on);
  }, []);

  useEffect(() => {
    setStore({ celebrating: !!d });
    document.documentElement.classList.toggle('a-cel-open', !!d);
    return () => document.documentElement.classList.remove('a-cel-open');
  }, [d]);

  // 퀘스트 성공 시퀀스
  useEffect(() => {
    if (!d || !card.current) return;
    const st = getStore();
    const hud = document.querySelector('.a-hud');
    if (!hud) return;
    const xpTo = st.xp + d.xp;
    const over = xpTo >= st.xpNext;
    const seq = new Seq(modeNow());
    buildClear(seq, card.current, hudRefs(hud, layer()), {
      at0: 0,
      stars: d.stars,
      coins: d.coins,
      coinFrom: st.coins,
      xpFrom: st.xp,
      xpTo: Math.min(xpTo, st.xpNext),
      xpMax: st.xpNext,
      setRig,
    });
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      setStore((s) => ({ coins: s.coins + d.coins, stars: s.stars + d.stars, xp: over ? s.xpNext : xpTo }));
      if (over) setLv({ from: st.level, to: st.level + 1, rest: xpTo - st.xpNext });
      requestAnimationFrame(() => requestAnimationFrame(() => seq.cancel()));
    };
    seq.onEnd = finalize;
    seqs.current.push(seq);
    pending.current.push(finalize);
    seq.play();
    return () => {
      finalize();
    };
  }, [d]);

  // 레벨업 시퀀스 (카드 위로 이어짐)
  useEffect(() => {
    if (!lv || !lvRef.current) return;
    const hud = document.querySelector('.a-hud');
    if (!hud) return;
    const seq = new Seq(modeNow());
    const nextMax = xpNeed(lv.to);
    buildLevelUp(seq, lvRef.current, hudRefs(hud, layer()), { at0: 200, from: lv.from, to: lv.to, xpAfter: lv.rest, xpMaxAfter: nextMax, setRig: setLvRig });
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      setStore({ level: lv.to, xp: lv.rest, xpNext: nextMax });
      requestAnimationFrame(() => requestAnimationFrame(() => seq.cancel()));
    };
    seq.onEnd = finalize;
    seqs.current.push(seq);
    seq.play();
    return () => finalize();
  }, [lv]);

  const close = (then?: () => void) => {
    pending.current.forEach((f) => f());
    pending.current = [];
    seqs.current.forEach((s) => s.cancel());
    seqs.current = [];
    setLv(null);
    setD(null);
    setRig('happy');
    then?.();
  };

  if (!d) return null;
  return (
    <>
      <ClearCard
        ref={card}
        stars={d.stars}
        xp={d.xp}
        coins={d.coins}
        title={d.title ?? (d.kind === 'quiz-clear' ? '퀴즈 정답!' : undefined)}
        rig={rig}
        frozen={!!lv}
        onMap={() => close(() => goScreen('world'))}
        onNext={() => close(onNext)}
      />
      {lv && (
        <div ref={lvRef} className="a-lv-host">
          <LevelUpOverlay level={lv.to} title={TITLES[lv.to] ?? '모험가'} unlockText="파이뱀 모자 꾸미기가 열렸어요" rig={lvRig} onClose={() => setLv(null)} />
        </div>
      )}
    </>
  );
}
