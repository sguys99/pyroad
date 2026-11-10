'use client';

import { useState } from 'react';
import { CodeEditor } from '@/components/quest/CodeEditor';
import { NotebookTitle, ResetCodeButton } from '@/components/quest/CodePanel';
// 공책 머리 모양(.qw-notebook-t·좁은 쪽 규칙)은 퀘스트 화면 CSS
import '@/components/quest/questWorkspace.css';

/**
 * 한글 주석 정렬 표본. 1~7줄은 `#`이 21칸째, 8~10줄(주석 속 표)은 `|`가 11칸째에 선다(한글 1자 = 2칸으로 셈).
 * 한글이 정확히 영문 2칸 폭이면 같은 기호의 x 좌표가 줄마다 같다 (e2e/public/editor-alignment.spec.ts)
 */
export const ALIGNMENT_SAMPLE = [
  'name = "파이뱀"      # 이름',
  'age = 10             # 나이',
  'greeting = "안녕"    # 인사말',
  'for i in range(3):   # 세 번 반복',
  '    print(name, i)   # 이름과 숫자',
  'if age >= 10:        # 열 살 이상이면',
  '    print("형님!")   # 큰 소리로',
  '# 이름     | 나이',
  '# 파이뱀   | 10',
  '# abc      | 12',
].join('\n');

export function EditorLab({ errorLine }: { errorLine: number | null }) {
  const [code, setCode] = useState(ALIGNMENT_SAMPLE);
  return (
    <main className="@container mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 bg-bg p-4">
      <h1 className="text-h3 font-display">에디터 점검 (개발 전용)</h1>
      {/* 퀘스트 공책과 같은 머리 한 줄: 제목 · 처음 코드로 · 글자 크기 (P6-03) */}
      <CodeEditor
        value={code}
        onChange={setCode}
        errorLine={errorLine}
        title={<NotebookTitle />}
        actions={
          <ResetCodeButton
            changed={code !== ALIGNMENT_SAMPLE}
            onReset={() => setCode(ALIGNMENT_SAMPLE)}
          />
        }
      />
    </main>
  );
}
