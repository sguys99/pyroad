'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { useSfx } from '@/components/providers/soundContext';
import {
  STICKERS,
  STICKER_LABELS,
  type StickerCounts,
  type StickerId,
} from '@/lib/gallery/stickers';
import { StickerFace } from './GalleryParts';

type React = (
  sticker: StickerId,
  on: boolean,
) => Promise<
  { ok: true; stickers: StickerCounts } | { ok: false; message: string }
>;

const FAILED = '지금은 스티커를 붙이지 못했어요. 잠시 뒤에 다시 해 줘요.';

async function sendReaction(
  id: string,
  sticker: StickerId,
  on: boolean,
): ReturnType<React> {
  try {
    const res = await fetch(`/api/gallery/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'react', sticker, on }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.stickers) return { ok: true, stickers: body.stickers };
    if (body?.code === 'guardian_consent')
      return {
        ok: false,
        message:
          '보호자 동의 전에는 스티커를 붙일 수 없어요. 보호자와 함께 동의하면 바로 붙일 수 있어요!',
      };
    return {
      ok: false,
      message:
        typeof body?.error === 'string' && res.status < 500
          ? body.error
          : FAILED,
    };
  } catch {
    return { ok: false, message: FAILED };
  }
}

/**
 * 스티커 판 (P11-07, F13): 정해진 스티커 5종만, 누르면 붙이고 다시 누르면 뗀다(사람·스티커마다 1개).
 * 바로 바뀐 모습을 보여 주고(낙관적) 서버 합계로 맞춘다. 내 작품(readOnly)은 친구들이 붙여 준 수만
 */
export function StickerBoard({
  id,
  counts: initialCounts,
  mine: initialMine,
  readOnly = false,
  react,
}: {
  id: string;
  counts: StickerCounts;
  mine: StickerId[];
  readOnly?: boolean;
  /** 카탈로그·테스트가 요청 없이 흉내 낼 때 */
  react?: React;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState(() => new Set(initialMine));
  const [busy, setBusy] = useState<StickerId | null>(null);
  const [pop, setPop] = useState<StickerId | null>(null);
  const [message, setMessage] = useState('');
  const sfx = useSfx();

  async function toggle(s: StickerId) {
    if (busy) return;
    const on = !mine.has(s);
    const before = { counts, mine };
    setBusy(s);
    setMessage('');
    setMine((m) => {
      const next = new Set(m);
      if (on) next.add(s);
      else next.delete(s);
      return next;
    });
    setCounts((c) => ({ ...c, [s]: Math.max(0, (c[s] ?? 0) + (on ? 1 : -1)) }));
    if (on) {
      setPop(s);
      sfx('blip');
    }
    const res = await (react ?? ((st, o) => sendReaction(id, st, o)))(s, on);
    setBusy(null);
    if (res.ok) {
      setCounts(res.stickers);
      setMessage(
        on ? `「${STICKER_LABELS[s]}」 스티커를 붙였어요!` : '스티커를 뗐어요.',
      );
    } else {
      setCounts(before.counts);
      setMine(before.mine);
      setPop(null);
      setMessage(res.message);
    }
  }

  return (
    <div className="grid gap-2">
      <ul className="gl-stickers" data-testid="sticker-board">
        {STICKERS.map((s) => {
          const pressed = mine.has(s);
          const n = counts[s] ?? 0;
          return (
            <li key={s}>
              <button
                type="button"
                className="gl-sticker"
                aria-pressed={readOnly ? undefined : pressed}
                data-sticker={s}
                data-pop={pop === s || undefined}
                disabled={readOnly || busy !== null}
                onClick={() => toggle(s)}
                onAnimationEnd={() => setPop(null)}
                aria-label={`${STICKER_LABELS[s]} 스티커 ${n}개${readOnly ? '' : pressed ? ', 붙였어요. 누르면 떼요' : ', 누르면 붙여요'}`}
                data-testid={`sticker-${s}`}
              >
                <StickerFace sticker={s} />
                {pressed && (
                  <span className="gl-sticker-check" aria-hidden>
                    <Check strokeWidth={3} />
                  </span>
                )}
                <span className="gl-sticker-name" aria-hidden>
                  {STICKER_LABELS[s]}
                </span>
                <span className="gl-sticker-n" aria-hidden>
                  {n}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p
        role="status"
        className="gl-hint text-center empty:hidden"
        data-testid="sticker-status"
      >
        {message}
      </p>
    </div>
  );
}
