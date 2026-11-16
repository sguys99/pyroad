'use client';

import { useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SaveCreationBar,
  SaveCreationSheet,
  type CreationSource,
} from '@/components/quest/SaveCreation';
import { MyCreations } from '@/components/creations/MyCreations';
import { createLiveOutputStore } from '@/lib/pyodide/liveOutput';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { SaveResult } from '@/lib/creations/client';
import type { TurtleCommand } from '@/lib/turtle/scene';
import { CodeSample, Demo, Section } from './ui';
import samples from './turtleSamples.json';

const OK: RunResult = { stdout: '', stderr: '', success: true, outcome: 'ok' };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fakeSave = async (): Promise<SaveResult> => (await wait(700), { ok: true, id: 'demo' });
const blockedSave = async (): Promise<SaveResult> => (
  await wait(500),
  {
    ok: false,
    code: 'moderation',
    message: '작품 이름: 친구가 속상할 수 있는 말이 들어 있어요. 다른 말로 바꿔 볼까요?',
  }
);

const STORY: CreationSource = {
  questId: null,
  questTitle: '모험 이야기 극장',
  code: 'name = input("모험가 별명은? ")',
  commands: [],
  transcript: [
    { text: '숲 입구에 도착했어요!' },
    { text: '모험가 별명은? ' },
    { text: '번개토끼', answer: true },
    { text: '번개토끼님, 왼쪽 길과 오른쪽 길 중 어디로 갈까요? ' },
    { text: '왼쪽', answer: true },
    { text: '반짝이는 호수에서 용 친구를 만났어요! 🐉' },
  ],
};

function drawingStore() {
  const store = createLiveOutputStore();
  store.turtle(JSON.stringify(samples.flower.commands));
  return store;
}

function talkStore() {
  const store = createLiveOutputStore();
  store.append('모험가 별명은? ');
  store.ask({ answer: () => {}, stop: () => {} });
  store.answer('번개토끼');
  store.append('번개토끼님, 반가워요!\n');
  return store;
}

/** 작품으로 저장 (P11-06): 결과 쪽지 아래 띠 → 저장 시트 → 내 작품함 */
export function CreationSection() {
  const [drawing] = useState(drawingStore);
  const [talk] = useState(talkStore);
  const [sheet, setSheet] = useState<null | 'drawing' | 'story' | 'blocked'>(null);
  const flower: CreationSource = {
    questId: null,
    questTitle: '거북이 화가 공방',
    code: samples.flower.code,
    commands: samples.flower.commands as TurtleCommand[],
    transcript: [],
  };
  return (
    <Section
      id="save-creation"
      kicker="퀘스트 (P11-06)"
      title="작품으로 저장 · 내 작품함"
      description="그림(turtle)이나 대화(input)가 나온 실행이 끝나면 결과 쪽지 아래에 띠가 나와요. 시트에서 미리보기(400×400 그림 맞춤 썸네일 · 대화 말풍선)를 보고 이름(20자)을 지어 비공개로 저장해요. 갤러리 올리기는 P11-07."
    >
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Demo label="띠 · 그림" note="저장하면 초록 띠 + 작품함 보기" surface="card">
          <SaveCreationBar
            liveOutput={drawing}
            runResult={OK}
            lastRunCode={samples.flower.code}
            isRunning={false}
            questId={null}
            questTitle="거북이 화가 공방"
            save={fakeSave}
          />
        </Demo>
        <Demo label="띠 · 대화" note="input()에 답한 실행이면" surface="card">
          <SaveCreationBar
            liveOutput={talk}
            runResult={OK}
            lastRunCode="name = input()"
            isRunning={false}
            questId={null}
            questTitle="모험 이야기 극장"
            save={fakeSave}
          />
        </Demo>
        <Demo label="저장 시트" note="그림 · 대화 · 금칙어에 걸림" surface="card">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['drawing', '그림 시트'],
                ['story', '대화 시트'],
                ['blocked', '걸린 이름'],
              ] as const
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant="secondary"
                sfx={false}
                icon={<BookmarkPlus aria-hidden />}
                onClick={() => setSheet(k)}
                data-testid={`creation-sheet-${k}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </Demo>
        <Demo label="내 작품함 · 비었을 때" surface="card">
          <MyCreations creations={[]} />
        </Demo>
      </div>
      <div className="mt-4">
        <Demo label="내 작품함" note="그림은 썸네일(본인만), 대화는 말풍선 그림 · 지우기는 확인 뒤">
          <MyCreations
            creations={[
              { id: 'a', kind: 'drawing', title: '무지개 꽃', isPublic: false, createdAt: '2026-11-16T03:00:00Z' },
              { id: 'b', kind: 'conversation', title: '용 친구 모험', isPublic: false, createdAt: '2026-11-15T03:00:00Z' },
              { id: 'c', kind: 'drawing', title: '별자리', isPublic: false, createdAt: '2026-11-14T03:00:00Z' },
            ]}
            thumbnailUrl={() => null}
            remove={async () => (await wait(400), true)}
          />
        </Demo>
      </div>
      {sheet && (
        <SaveCreationSheet
          key={sheet}
          open
          onOpenChange={(o) => !o && setSheet(null)}
          source={sheet === 'drawing' ? flower : STORY}
          save={sheet === 'blocked' ? blockedSave : fakeSave}
        />
      )}
      <CodeSample
        code={`// QuestWorkspace: 결과 쪽지 아래 (데스크톱·모바일 결과 쪽)\n<SaveCreationBar liveOutput={liveOutput} runResult={runResult} lastRunCode={session.lastRunCode}\n  isRunning={runner.isRunning} questId={quest.id} questTitle={quest.title} />\n// 저장: renderThumbnail(commands) → exportPNG({ width: 400, height: 400, fit: 'content' })\n//       POST /api/creations (multipart meta + commands.json.gz + thumbnail.png) → 늘 비공개`}
      />
    </Section>
  );
}
