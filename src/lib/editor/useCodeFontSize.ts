'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CODE_FONT_SIZE_STORAGE_KEY,
  DEFAULT_CODE_FONT_SIZE,
  normalizeCodeFontSize,
  stepCodeFontSize,
  type CodeFontSize,
} from './fontSize';

function readStored(): CodeFontSize {
  try {
    return normalizeCodeFontSize(
      window.localStorage.getItem(CODE_FONT_SIZE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_CODE_FONT_SIZE; // 사생활 보호 모드·저장소 차단
  }
}

function writeStored(size: CodeFontSize) {
  try {
    window.localStorage.setItem(CODE_FONT_SIZE_STORAGE_KEY, String(size));
  } catch {
    // 저장하지 못해도 이번 화면에서는 바뀐 크기로 보인다
  }
}

/**
 * 코드 글자 크기 상태. 서버 렌더·첫 렌더는 기본값이고 마운트 뒤 기기 저장소 값으로 맞춘다(하이드레이션 불일치 없음).
 * CodeMirror는 마운트 effect에서 만들어지므로 저장된 크기가 첫 페인트 직후 바로 적용된다
 */
export function useCodeFontSize() {
  const [size, setSize] = useState<CodeFontSize>(DEFAULT_CODE_FONT_SIZE);

  useEffect(() => {
    setSize(readStored());
  }, []);

  const change = useCallback(
    (dir: 1 | -1) => {
      const next = stepCodeFontSize(size, dir);
      if (next === size) return;
      setSize(next);
      writeStored(next);
    },
    [size],
  );

  return { size, change } as const;
}
