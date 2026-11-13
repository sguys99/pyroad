'use client';

import { useRef, useState } from 'react';
import { MessageCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  BUGBUG,
  BugBugStatic,
  BYEOLTTONGI,
  ByeolttongiStatic,
  PYBAEM,
  PybaemStatic,
  rigPolicy,
  type BugBugState,
  type ByeolttongiState,
  type PybaemState,
} from '@/components/characters/rig';
import {
  BugBugRig,
  ByeolttongiRig,
  PybaemRig,
} from '@/components/characters/rig/MascotRig';
import type { RigHandle } from '@/components/characters/rig/LiveRig';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { PYBAEM_SKINS, skinPalette } from '@/lib/avatar/skins';
import { CodeSample, Demo, Section } from './ui';

export function StateButtons<S extends string>({
  states,
  labels,
  value,
  onChange,
  name,
}: {
  states: readonly S[];
  labels: Record<S, string>;
  value: S;
  onChange: (s: S) => void;
  name: string;
}) {
  return (
    <div role="group" aria-label={`${name} 상태`} className="flex flex-wrap gap-1.5">
      {states.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={cn(
            'min-h-10 rounded-full px-3 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value === s
              ? 'bg-primary text-on-primary'
              : 'bg-surface-2 text-foreground hover:text-primary-text',
          )}
        >
          {labels[s]}
        </button>
      ))}
    </div>
  );
}

function RigCard<S extends string>({
  name,
  states,
  labels,
  initial,
  render,
  testId,
}: {
  name: string;
  states: readonly S[];
  labels: Record<S, string>;
  initial: S;
  render: (
    state: S,
    ref: React.RefObject<RigHandle<S> | null>,
    talking: boolean,
  ) => React.ReactNode;
  testId: string;
}) {
  const [state, setState] = useState<S>(initial);
  const [talking, setTalking] = useState(false);
  const ref = useRef<RigHandle<S> | null>(null);
  const canTalk = name === PYBAEM.name;
  return (
    <Demo label={name} note={`${states.length}상태 · 탭하면 콕 찌르기`} surface="card" data-testid={testId}>
      <div className="flex justify-center rounded-xl bg-surface-2 py-2">
        {render(state, ref, talking)}
      </div>
      <StateButtons
        states={states}
        labels={labels}
        value={state}
        onChange={setState}
        name={name}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          sfx={false}
          icon={<RotateCcw aria-hidden />}
          onClick={() => ref.current?.replay()}
        >
          다시 보기
        </Button>
        {canTalk && (
          <Button
            variant="secondary"
            size="sm"
            sfx={false}
            pressed={talking}
            icon={<MessageCircle aria-hidden />}
            onClick={() => setTalking((t) => !t)}
          >
            말하기 레이어 {talking ? '끄기' : '켜기'}
          </Button>
        )}
      </div>
    </Demo>
  );
}

const STATIC_STATES: PybaemState[] = ['idle', 'happy', 'think', 'sad', 'proud'];

export function RigSection() {
  const { tier, reduced } = useMotionTier();
  const policy = rigPolicy(tier, reduced);
  return (
    <Section
      id="rig"
      kicker="캐릭터 (P2-13)"
      title="마스코트 리그"
      description={`라이브 리그는 지금 연출 단계를 따릅니다: 지금 모드 ${policy.mode}${policy.fps ? ` · ${policy.fps}fps 상한` : ''}${policy.halo ? ' · 상태 후광 색' : ''}. full은 모든 레이어 · lite 30fps·2차 움직임 끔 · minimal 상태 전환만(대기 CPU 0) · 동작 줄이기는 위치·크기 변화 0 + 표정 즉시 + 느린 깜빡임. 상태 표는 docs/design/rig.md §3.`}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <RigCard<PybaemState>
          name={PYBAEM.name}
          states={PYBAEM.states}
          labels={PYBAEM.stateLabel}
          initial="idle"
          testId="rig-pybaem"
          render={(state, ref, talking) => (
            <PybaemRig ref={ref} state={state} talking={talking} size={200} />
          )}
        />
        <RigCard<BugBugState>
          name={BUGBUG.name}
          states={BUGBUG.states}
          labels={BUGBUG.stateLabel}
          initial="idle"
          testId="rig-bugbug"
          render={(state, ref) => <BugBugRig ref={ref} state={state} size={180} />}
        />
        <RigCard<ByeolttongiState>
          name={BYEOLTTONGI.name}
          states={BYEOLTTONGI.states}
          labels={BYEOLTTONGI.stateLabel}
          initial="idle"
          testId="rig-byeolttongi"
          render={(state, ref) => (
            <ByeolttongiRig ref={ref} state={state} size={180} />
          )}
        />
      </div>
      <Demo
        label="정지 그림 (서버 렌더 · 공유 카드 · 첫 화면)"
        note="PybaemStatic · BugBugStatic · ByeolttongiStatic. halo는 minimal·동작 줄이기 모양"
      >
        <div className="flex flex-wrap items-end gap-4">
          {STATIC_STATES.map((s) => (
            <figure key={s} className="flex flex-col items-center gap-1">
              <PybaemStatic state={s} size={96} />
              <figcaption className="text-caption text-muted-foreground">
                {PYBAEM.stateLabel[s]}
              </figcaption>
            </figure>
          ))}
          <figure className="flex flex-col items-center gap-1">
            <PybaemStatic state="happy" size={96} halo />
            <figcaption className="text-caption text-muted-foreground">
              기쁨 + 후광
            </figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-1">
            <BugBugStatic state="attack" size={96} />
            <figcaption className="text-caption text-muted-foreground">
              버그버그 공격
            </figcaption>
          </figure>
          <figure className="flex flex-col items-center gap-1">
            <ByeolttongiStatic state="give" size={96} />
            <figcaption className="text-caption text-muted-foreground">
              별똥이 건네기
            </figcaption>
          </figure>
        </div>
      </Demo>
      <Demo
        label="파이뱀 스킨 (공개 아바타, P3-13)"
        note="users.avatar_config.skin → user_public_profiles.avatar_skin. 팔레트 덮어쓰기(src/lib/avatar/skins.ts), NULL·모르는 값은 숲초록"
        data-testid="rig-skins"
      >
        <div className="flex flex-wrap items-end gap-4">
          {PYBAEM_SKINS.map((skin) => (
            <figure
              key={skin.id}
              className="flex flex-col items-center gap-1"
              data-skin={skin.id}
            >
              <PybaemStatic
                state="happy"
                size={96}
                palette={skinPalette(skin.id)}
                label={`파이뱀 - ${skin.name}`}
              />
              <figcaption className="text-caption text-muted-foreground">
                {skin.name} · {skin.id}
              </figcaption>
            </figure>
          ))}
        </div>
      </Demo>
      <Demo
        label="UserAvatar (게시판 32 · 월드맵 48 · 프로필 96)"
        note="장식(aria-hidden), 이름은 옆에 글자로. provider 프로필 사진은 쓰지 않음 (§2.6)"
        data-testid="user-avatar-demo"
      >
        <div className="flex flex-col gap-3">
          {PYBAEM_SKINS.map((skin, i) => (
            <div key={skin.id} className="flex items-center gap-3">
              <UserAvatar skin={skin.id} size={96} />
              <UserAvatar skin={skin.id} size={48} />
              <span className="flex items-center gap-2 text-body">
                <UserAvatar skin={skin.id} size={32} />
                {i === 0 ? '모험가0448' : `코딩친구${i}`}
              </span>
            </div>
          ))}
          <span className="flex items-center gap-2 text-body">
            <UserAvatar skin={null} size={32} />
            스킨 없음(NULL) → 숲초록
          </span>
        </div>
      </Demo>
      <CodeSample
        code={`const PybaemRig = dynamic(() => import('@/components/characters/rig/MascotRig').then((m) => m.PybaemRig),\n  { ssr: false, loading: () => <PybaemStatic state="idle" size={200} framing="stage" /> });\n<PybaemRig state="happy" talking={speaking} size={200} />`}
      />
    </Section>
  );
}
