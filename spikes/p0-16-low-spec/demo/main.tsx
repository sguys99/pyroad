// P0-16 데모: 장면이 연출 단계에 반응 → 감지기가 실제 부하를 보고 하향
// ?force=full|lite|minimal (감지 끔, 기준선 측정) ?jank=1 (긴 작업 주입) ?log=1
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import confetti from 'canvas-confetti';
import { MotionTierProvider, useMotionTier } from '../src/useMotionTier';
import { readStaticSignals } from '../src/browser';
import type { MotionTier } from '../src/motionTier';
import { PybaemRig } from '../../p0-07-mascot-animation/src/rig/PybaemRig';

const q = new URLSearchParams(location.search);
const FORCE = q.get('force') as MotionTier | null;
/** light=1: 흐림·유리 효과 없는 가벼운 full 장면 (1×에서 60fps) */
const LIGHT = q.get('light') === '1';
const T0 = performance.now();
const log: { t: number; tier: MotionTier; why: string }[] = [];
(window as unknown as { __p016: unknown }).__p016 = { log, signals: readStaticSignals(), t0: T0 };

function Scene() {
  const m = useMotionTier();
  const tier = m.tier;
  useEffect(() => {
    log.push({ t: Math.round(performance.now() - T0), tier, why: m.reasons[m.reasons.length - 1] ?? '' });
  }, [tier]); // eslint-disable-line react-hooks/exhaustive-deps
  // 파티클: full 100% / lite 30% / minimal 0
  useEffect(() => {
    if (m.reduced || m.budget.particles === 0) return;
    const n = Math.max(1, Math.round((LIGHT ? 3 : 8) * m.budget.particles));
    const id = setInterval(() => confetti({ particleCount: n, spread: 70, startVelocity: 30, ticks: 160, origin: { x: Math.random(), y: 0.75 }, disableForReducedMotion: true }), 120);
    return () => clearInterval(id);
  }, [m.budget.particles, m.reduced]);
  // 긴 작업 주입 (Pyodide 로딩 흉내): 3초에 400ms, 6·7·8초에 150ms
  useEffect(() => {
    if (q.get('jank') !== '1') return;
    const busy = (ms: number) => {
      const e = performance.now() + ms;
      while (performance.now() < e);
    };
    const ids = [setTimeout(() => busy(400), 3000), ...[6000, 7000, 8000].map((t) => setTimeout(() => busy(150), t))];
    return () => ids.forEach(clearTimeout);
  }, []);
  const states = ['dance', 'cheer', 'happy'] as const;
  const [st, setSt] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSt((s) => s + 1), 2500);
    return () => clearInterval(id);
  }, []);
  const rigTier: MotionTier = tier;
  return (
    <div className={`scene tier-${tier}${m.reduced ? ' reduced' : ''}${LIGHT ? ' light' : ''}`}>
      {m.budget.ambient && !m.reduced && !LIGHT && (
        <div className="ambient" aria-hidden>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="cloud" style={{ top: `${8 + (i * 9) % 70}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${12 + (i % 4) * 3}s` }} />
          ))}
        </div>
      )}
      <div className="rigs">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card">
            <PybaemRig
              state={states[(st + i) % 3]}
              tier={rigTier}
              reducedMotion={m.reduced}
              size={i === 0 ? 220 : 170}
              lookAt={false}
              costume={i === 0 ? { hat: 'party', cape: '#E53935' } : i === 1 ? { hat: 'crown' } : { glasses: 'round' }}
              seed={i + 1}
            />
          </div>
        ))}
      </div>
      <Panel />
    </div>
  );
}

function Panel() {
  const m = useMotionTier();
  const [fps, setFps] = useState(0);
  const sig = useRef(readStaticSignals()).current;
  useEffect(() => {
    let n = 0;
    let t0 = performance.now();
    let id = 0;
    const f = (t: number) => {
      n++;
      if (t - t0 >= 1000) {
        setFps(Math.round((n * 1000) / (t - t0)));
        n = 0;
        t0 = t;
      }
      id = requestAnimationFrame(f);
    };
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, []);
  const label: Record<MotionTier, string> = { full: 'full · 모든 연출', lite: 'lite · 가벼운 연출', minimal: 'minimal · 정지 포즈' };
  return (
    <div className="panel">
      <div className="tier">
        <span className={`dot ${m.tier}`} /> {label[m.tier]} {m.reduced && <em>+ 동작 줄이기</em>}
      </div>
      <div className="row">출처: {m.source === 'user' ? '사용자 설정' : m.source === 'measured' ? '실측' : m.source === 'stored' ? '지난 측정' : '정적 추정'} · {fps} fps</div>
      <div className="row small">
        cores {sig.hardwareConcurrency ?? '-'} · memory {sig.deviceMemory ?? '-'}GB · saveData {String(sig.saveData ?? '-')} · reduced {String(sig.reducedMotion)}
      </div>
      <ol className="small">
        {m.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ol>
      <div className="row btns">
        {(['auto', 'full', 'lite', 'minimal'] as const).map((t) => (
          <button key={t} className={m.settings.tier === t ? 'on' : ''} onClick={() => m.setSettings({ ...m.settings, tier: t })}>
            {t === 'auto' ? '자동' : t}
          </button>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <MotionTierProvider initialSettings={FORCE ? { tier: FORCE, reduced: 'system' } : undefined}>
    <Scene />
  </MotionTierProvider>,
);
