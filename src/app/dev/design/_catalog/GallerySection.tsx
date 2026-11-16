'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EmptyGallery,
  GalleryBanner,
  GalleryCard,
  type GalleryCardItem,
} from '@/components/gallery/GalleryParts';
import { StickerBoard } from '@/components/gallery/StickerBoard';
import {
  ConversationReplay,
  DrawingReplay,
} from '@/components/gallery/WorkReplay';
import {
  OwnerPanel,
  PublishSheet,
  type OwnWork,
} from '@/components/gallery/OwnerPanel';
import { avatarLook } from '@/lib/avatar/look';
import type { TurtleCommand } from '@/lib/turtle/scene';
import { CodeSample, Demo, Section } from './ui';
import samples from './turtleSamples.json';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const look = (skin: string) => avatarLook({ skin });
const STORY = [
  { text: '숲 입구에 도착했어요!' },
  { text: '모험가 별명은? ' },
  { text: '번개토끼', answer: true as const },
  { text: '번개토끼님, 왼쪽 길과 오른쪽 길 중 어디로 갈까요? ' },
  { text: '왼쪽', answer: true as const },
  { text: '반짝이는 호수에서 용 친구를 만났어요!' },
];
const ITEMS: GalleryCardItem[] = [
  { id: 'a', kind: 'drawing', title: '무지개 꽃', author: { name: '번개토끼', look: look('green') }, stickers: { love: 4, wow: 2, cheer: 1 } },
  { id: 'b', kind: 'conversation', title: '용 친구 모험', author: { name: '콩이', look: look('sky') }, stickers: { fun: 3 }, preview: STORY.slice(1, 4) },
  { id: 'c', kind: 'drawing', title: '별자리', author: { name: '나', look: look('berry') }, stickers: {}, isMine: true },
  { id: 'd', kind: 'conversation', title: '퀴즈쇼', author: { name: '달토끼', look: look('sunny') }, stickers: { smart: 5, wow: 1 } },
];
const OWN: OwnWork = {
  id: 'own',
  kind: 'conversation',
  title: '우리집 1203호 모험',
  code: 'name = input("별명? ")',
  transcript: STORY,
  visibility: 'private',
  hiddenAt: null,
  showCode: false,
  eligible: true,
  author: { name: '번개토끼', look: look('green') },
};

/** 작품 갤러리 (P11-07): 박람회 배너 · 액자 벽 · 다시 그리기·대화 재생 · 스티커 판 · 출품 시트(제안 J) · 작가 패널 · 빈 전시장 */
export function GallerySection() {
  const [sheet, setSheet] = useState(false);
  return (
    <Section
      id="gallery"
      kicker="갤러리 (P11-07)"
      title="작품 갤러리 · 메이커 박람회"
      description="로그인한 학생만 보는 전시장. 액자에는 썸네일(그림)이나 앞 세 줄(대화), 이름표는 닉네임·파이뱀만. 작품 보기는 저장된 명령을 다시 그리고(남의 코드 실행 없음) 대화는 채팅처럼 재생. 반응은 정해진 스티커 5종만, 신고·운영자 숨김."
    >
      <div className="grid gap-4">
        <Demo label="배너 + 액자 벽" note="벽에 건 듯 살짝씩 기울임(정지), 압정 · 내 작품 딱지">
          <div className="grid gap-4">
            <GalleryBanner />
            <ul className="gl-wall" data-world="3">
              {ITEMS.map((item) => (
                <li key={item.id}>
                  <GalleryCard item={item} thumbnailUrl={() => null} />
                </li>
              ))}
            </ul>
          </div>
        </Demo>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Demo label="그림 다시 그리기" note="명령 재생 · 다시 그리기 · 바로 완성 · 빠르기">
            <DrawingReplay
              id="demo"
              title="무지개 꽃"
              poster={null}
              load={async () => (await wait(400), samples.flower.commands as TurtleCommand[])}
            />
          </Demo>
          <Demo label="대화 재생" note="한 줄씩, 대답 전에 점 세 개 · 동작 줄이기는 한 번에">
            <ConversationReplay rows={STORY} />
          </Demo>
          <Demo label="스티커 판" note="누르면 톡 붙고 다시 누르면 떼요" surface="card">
            <StickerBoard
              id="demo"
              counts={{ love: 3, wow: 1 }}
              mine={['wow']}
              react={async (s, on) => (
                await wait(300),
                { ok: true, stickers: { love: 3 + (s === 'love' ? (on ? 1 : -1) : 0), wow: s === 'wow' && !on ? 0 : 1 } }
              )}
            />
          </Demo>
          <Demo label="스티커 판 · 내 작품" note="읽기만" surface="card">
            <StickerBoard id="demo" counts={{ fun: 2, smart: 1 }} mine={[]} readOnly />
          </Demo>
          <Demo label="작가 패널 · 출품 시트" note="숫자 4개 이상 → 한 번 더 보기, 확인해야 올리기" surface="card">
            <div className="grid gap-3">
              <OwnerPanel work={OWN} thumbnailUrl={null} patch={async () => (await wait(400), { ok: true })} />
              <Button size="sm" variant="secondary" sfx={false} icon={<Upload aria-hidden />} onClick={() => setSheet(true)}>
                출품 시트 열기
              </Button>
            </div>
          </Demo>
          <Demo label="작가 패널 · 전시 중 / 숨김" surface="card">
            <div className="grid gap-3">
              <OwnerPanel work={{ ...OWN, visibility: 'public' }} thumbnailUrl={null} patch={async () => ({ ok: true })} />
              <OwnerPanel work={{ ...OWN, visibility: 'public', hiddenAt: '2026-11-16' }} thumbnailUrl={null} />
            </div>
          </Demo>
          <Demo label="빈 전시장">
            <EmptyGallery />
          </Demo>
        </div>
      </div>
      {sheet && (
        <PublishSheet
          work={OWN}
          thumbnailUrl={null}
          onOpenChange={setSheet}
          submit={async () => (await wait(500), { ok: false, message: '대화 기록에 전화번호나 이메일 같은 개인정보가 있는 것 같아요. 이 부분을 지우고 다시 올려 줘요.' })}
        />
      )}
      <CodeSample
        code={`// /gallery (서버): listGallery() ← gallery_creations 뷰(service_role, 00055)\n// /gallery/[id]: loadWork() → DrawingReplay(명령 gzip → TurtleCanvas) | ConversationReplay(기록)\n// 스티커·신고·숨김: POST /api/gallery/{id} {action: 'react' | 'report' | 'moderate'}`}
      />
    </Section>
  );
}
