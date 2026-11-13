'use client';

import { useState } from 'react';
import { PYBAEM, PybaemStatic, type PybaemState } from '@/components/characters/rig';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import type { Costume } from '@/components/characters/rig/costumes';
import { PYBAEM_SKINS, skinPalette, type SkinId } from '@/lib/avatar/skins';
import { SHOP_ITEMS, costumeFromAvatarConfig } from '@/lib/shop/catalog';
import { cn } from '@/lib/utils';
import { StateButtons } from './RigSection';
import { Demo, Section } from './ui';

const ALL_ON = { hat: 'hat_wizard', glasses: 'glasses_round', cape: 'cape_hero', bg: 'bg_island' };
/** 행 = 코스튬 조각 하나씩 + 다 입기 (P9-01 카탈로그 그대로) */
const ROWS: { id: string; name: string; costume: Costume }[] = [
  ...SHOP_ITEMS.filter((i) => i.kind === 'costume').map((i) => ({
    id: i.id,
    name: i.name,
    costume: costumeFromAvatarConfig({ [i.kind === 'costume' ? i.slot : '']: i.id }),
  })),
  { id: 'all', name: '다 입기', costume: costumeFromAvatarConfig(ALL_ON) },
];

function SkinPicker({ value, onChange }: { value: SkinId; onChange: (s: SkinId) => void }) {
  return (
    <div role="group" aria-label="스킨" className="flex flex-wrap gap-1.5">
      {PYBAEM_SKINS.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={value === s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            'inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value === s.id
              ? 'bg-primary text-on-primary'
              : 'bg-surface-2 text-foreground hover:text-primary-text',
          )}
        >
          <span aria-hidden className="size-3 rounded-full" style={{ background: s.palette.body }} />
          {s.name}
        </button>
      ))}
    </div>
  );
}

/**
 * 꾸미기 렌더러 견본 (P9-04): 코스튬 × 포즈 × 스킨 격자. 모자는 머리 그룹, 안경은 얼굴 그룹, 망토는 몸 뒤,
 * 배경은 리그 밖이라 포즈마다 따로 맞추지 않아도 붙는다 — 어긋나는 칸이 있으면 조각(costumes.tsx)을 고친다.
 */
export function CostumeSection() {
  const [skin, setSkin] = useState<SkinId>('green');
  const [state, setState] = useState<PybaemState>('idle');
  const palette = skinPalette(skin);
  return (
    <Section
      id="costume"
      kicker="P9-04"
      title="캐릭터 꾸미기 렌더러"
      description="코스튬 조각은 src/components/characters/rig/costumes.tsx 하나를 라이브(PybaemRig)와 정지(PybaemStatic·공유 카드)가 함께 씁니다. 모자 = 머리 그룹, 안경 = 얼굴 그룹, 망토 = 몸 뒤, 배경 = 리그 밖, 스킨 = 팔레트 덮어쓰기. 표정 소품(별 눈·물음표·Zzz·눈물)은 다른 슬롯이라 겹쳐 그려집니다. 모두 128×128 좌표, <text>·<foreignObject>·<image>·SMIL 없음(테스트)."
    >
      <Demo
        label="코스튬 × 포즈 격자"
        note="행 = 조각 하나씩 + 다 입기, 열 = 파이뱀 14상태(정지 포즈). 스킨을 바꿔 보세요. 칸 테두리 = 아바타 128×128 상자(모자 끝은 상자 위로 나감)"
        data-testid="costume-grid"
      >
        <SkinPicker value={skin} onChange={setSkin} />
        <div className="overflow-x-auto rounded-xl bg-surface-2 p-2" tabIndex={0} aria-label="코스튬 × 포즈 격자 (가로로 밀어 보기)">
          <table className="border-separate border-spacing-1" data-skin={skin}>
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  조각
                </th>
                {PYBAEM.states.map((s) => (
                  <th key={s} scope="col" className="text-caption font-semibold text-muted-foreground">
                    {PYBAEM.stateLabel[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.id} data-costume={row.id}>
                  <th scope="row" className="pr-2 text-left text-caption font-semibold whitespace-nowrap">
                    {row.name}
                  </th>
                  {PYBAEM.states.map((s) => (
                    <td key={s} className="rounded-lg bg-card p-0">
                      <PybaemStatic
                        state={s}
                        size={72}
                        framing="stage"
                        palette={palette}
                        costume={row.costume}
                        filters={false}
                        idPrefix={`cg-${row.id}-${s}-`}
                        label=""
                        className="block"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Demo>
      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="스킨 6색 × 다 입기" note="외곽선·볼은 스킨, 코스튬은 제 색 (몸색 톤 외곽선 B)" data-testid="costume-skins">
          <div className="flex flex-wrap gap-2">
            {PYBAEM_SKINS.map((s) => (
              <PybaemStatic
                key={s.id}
                state="happy"
                size={88}
                framing="stage"
                palette={skinPalette(s.id)}
                costume={ROWS[ROWS.length - 1].costume}
                filters={false}
                idPrefix={`cs-${s.id}-`}
                label={`파이뱀 - ${s.name}, 다 입기`}
              />
            ))}
          </div>
        </Demo>
        <Demo label="라이브 (다 입기)" note="숨쉬기·점프·머리 기울임·콕 찌르기를 모자·안경·망토가 따라감" surface="card" data-testid="costume-live">
          <div className="flex justify-center rounded-xl bg-surface-2 py-2">
            <PybaemRig state={state} size={200} palette={palette} costume={ROWS[ROWS.length - 1].costume} />
          </div>
          <StateButtons states={PYBAEM.states} labels={PYBAEM.stateLabel} value={state} onChange={setState} name="꾸민 파이뱀" />
        </Demo>
      </div>
    </Section>
  );
}
