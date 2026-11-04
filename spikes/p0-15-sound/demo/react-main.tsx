import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { installInstrumentation } from './instrument';
import { DemoApp } from './ReactDemo';

// React 19 StrictMode(이펙트 이중 실행)에서도 AudioContext가 1개만 생기는지 확인
installInstrumentation('react');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoApp />
  </StrictMode>,
);
