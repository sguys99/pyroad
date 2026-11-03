'use client';

import { useEffect, useState } from 'react';

// 퀘스트 화면에서 실제로 SAB + Atomics.wait 왕복이 되는지 (Pyodide 없이)
export default function SabCheck() {
  const [r, setR] = useState('checking');
  useEffect(() => {
    if (!self.crossOriginIsolated) return setR('no-coi');
    const sab = new SharedArrayBuffer(8);
    const a = new Int32Array(sab);
    const w = new Worker('/coi-worker.js');
    const t0 = performance.now();
    w.onmessage = (e) => {
      if (e.data === 'waiting') {
        Atomics.store(a, 0, 1);
        Atomics.notify(a, 0);
      } else {
        setR(`ok ${e.data} ${(performance.now() - t0).toFixed(1)}ms`);
        w.terminate();
      }
    };
    w.onerror = (e) => setR('worker-error ' + e.message);
    w.postMessage(sab);
    return () => w.terminate();
  }, []);
  return <p id="sab">SAB: {r}</p>;
}
