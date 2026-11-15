'use client';

import { useRef, useState } from 'react';
import {
  CodeEditor,
  type CodeEditorHandle,
} from '@/components/quest/CodeEditor';
import CodeKeyboard from '@/components/quest/CodeKeyboard';
import { SegmentedTabs } from '@/components/ui/tabs';
import { Demo, Section } from './ui';

const TURTLE_SAMPLE = [
  'import turtle',
  't = turtle.Turtle()',
  'for i in range(5):',
  '    t.forward(100)',
  '    t.left(72)',
  't.goto(-120, 40)',
].join('\n');

/** 숫자 손잡이 견본 (제안 L): 퀘스트 화면은 바꿀 때마다 잠깐 뒤 다시 그리고, 여기서는 그 부름 수만 센다 */
function NumberHandleDemo() {
  const [code, setCode] = useState(TURTLE_SAMPLE);
  const [nudges, setNudges] = useState(0);
  return (
    <div className="flex max-w-sm flex-col gap-2" data-testid="catalog-number-handle">
      <CodeEditor value={code} onChange={setCode} onNumberNudge={() => setNudges((n) => n + 1)} />
      <p className="text-small text-text-muted" data-testid="catalog-number-nudges">
        다시 그리기 부름 {nudges}번
      </p>
    </div>
  );
}

const W3_STAGES = ['1', '2', '3', '4', '5', '6', '7'];

/** 3월드 코드 키보드 견본 (제안 M): 스테이지를 바꾸면 맨 앞 세 칸이 바뀐다 */
function World3KeyboardDemo() {
  const editor = useRef<CodeEditorHandle>(null);
  const [code, setCode] = useState('import turtle\nt = turtle.Turtle()\n');
  const [stage, setStage] = useState('1');
  return (
    <div className="flex max-w-sm flex-col gap-2" data-testid="catalog-w3-keyboard">
      <SegmentedTabs
        aria-label="3월드 스테이지"
        items={W3_STAGES.map((v) => ({ value: v, label: v === '7' ? 'F' : v }))}
        value={stage}
        onValueChange={setStage}
      />
      <CodeEditor ref={editor} value={code} onChange={setCode} />
      <CodeKeyboard editor={editor} stage={Number(stage)} world="maker-city" />
    </div>
  );
}

export function EditorHandleSection() {
  return (
    <Section
      id="editor-handles"
      kicker="3월드 모바일 보강 (제안 L·M)"
      title="숫자 손잡이 · 3월드 키보드"
      description="휴대폰에서 타자 없이 숫자를 바꿔 보고, 스테이지마다 자주 쓰는 주문을 키보드 맨 앞에 둡니다."
    >
      <Demo
        label="숫자 손잡이 (제안 L)"
        note="turtle 코드에서 점선 밑줄 숫자를 누르면 위에 슬라이더. − / + 와 슬라이더는 44px, 이름은 자리에 따라 각도·길이·자리·횟수. 키보드는 숫자 위에서 Alt+Enter → 화살표, Esc로 돌아옴. 다른 데를 누르거나 타자를 치면 닫힘"
        surface="card"
      >
        <NumberHandleDemo />
      </Demo>
      <Demo
        label="3월드 코드 키보드 (제안 M)"
        note="맨 앞 묶음이 스테이지 키(360px에서 넘기지 않고 보임) → 기본 앞자리 → 이번 스테이지 주문 → 기호 → 주문"
        surface="card"
      >
        <World3KeyboardDemo />
      </Demo>
    </Section>
  );
}
