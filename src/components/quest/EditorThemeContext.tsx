'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { EditorThemeId } from '@/lib/design/tokens';

/**
 * 장착한 에디터 테마 (상점 "공책", P9-06). 퀘스트 레이아웃이 서버에서 `users.settings.editor_theme`을 읽어 넣고,
 * `CodeEditor`가 코드 상자에 `data-editor-theme`으로 붙인다 → 서버 HTML부터 그 색 (깜빡임 없음). null = 기본 공책
 */
const EditorThemeContext = createContext<EditorThemeId | null>(null);

export function EditorThemeProvider({
  theme,
  children,
}: {
  theme: EditorThemeId | null;
  children: ReactNode;
}) {
  return <EditorThemeContext value={theme}>{children}</EditorThemeContext>;
}

export const useEditorTheme = () => useContext(EditorThemeContext);
