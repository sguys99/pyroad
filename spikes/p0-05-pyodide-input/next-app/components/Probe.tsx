'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    __boot?: number;
    __probe?: { path: string; coi: boolean; sab: boolean; boot: number };
  }
}

// 문서가 새로 로드될 때만 바뀌는 값. 소프트 내비게이션이면 유지된다.
if (typeof window !== 'undefined') window.__boot ??= Date.now() + Math.random();

export default function Probe() {
  const path = usePathname();
  const [s, setS] = useState('');
  useEffect(() => {
    const p = {
      path,
      coi: self.crossOriginIsolated === true,
      sab: typeof SharedArrayBuffer === 'function',
      boot: window.__boot!,
    };
    window.__probe = p;
    setS(JSON.stringify(p));
  }, [path]);
  return <pre id="probe">{s}</pre>;
}
