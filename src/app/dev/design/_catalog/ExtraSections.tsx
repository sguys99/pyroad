'use client';

import { Code2, ExternalLink, Volume2 } from 'lucide-react';
import { useSfx } from '@/components/providers/SoundProvider';
import { useSoundSettings } from '@/components/providers/SoundProvider';
import { SFX_USES, STAR_RATES, type SfxId } from '@/lib/sound/manifest';
import { SHARE_CARD_SAMPLES } from '@/lib/share-card/samples';
import { Button } from '@/components/ui/button';
import { CodeSample, Demo, Section } from './ui';

export function EditorSection() {
  return (
    <Section
      id="editor"
      kicker="기타 (P2-18)"
      title="코드 에디터"
      description="CodeMirror 키즈 테마(D2Coding 16px · 14~20px 짝수만 · 행간 1.6 · 구문색 3종)는 같은 에디터를 그대로 띄우는 점검 페이지에서 봅니다. 커서 깜빡임은 입력 위치 신호라 minimal에서도 돌고, 동작 줄이기에서만 멈춰요."
    >
      <Demo label="점검 페이지 (개발 전용)" note="한글 주석 정렬 견본 · 글자 크기 · 오류 줄">
        <div className="flex flex-wrap gap-3">
          <Button href="/dev/editor" variant="secondary" sfx={false} icon={<Code2 aria-hidden />}>
            /dev/editor
          </Button>
          <Button
            href="/dev/editor?error=3"
            variant="secondary"
            sfx={false}
            icon={<Code2 aria-hidden />}
          >
            오류 줄 3 표시
          </Button>
        </div>
      </Demo>
    </Section>
  );
}

export function ShareCardSection() {
  return (
    <Section
      id="share-card"
      kicker="기타 (P2-19)"
      title="공유 카드 샘플"
      description="샘플 데이터(src/lib/share-card/samples.ts)를 운영과 같은 엔진(next/og)으로 요청 때 그립니다(/dev/design/share-card/<id>, 개발 전용). 커밋된 PNG는 docs/design/img/share-card/ (npm run share-card:render)."
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {SHARE_CARD_SAMPLES.map((s) => (
          <li key={s.id} className="space-y-2 rounded-2xl bg-card p-3 shadow-card">
            {/* 개발 전용 동적 PNG라 next/image 최적화를 거치지 않는다 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/dev/design/share-card/${s.id}`}
              alt={`공유 카드 샘플: ${s.note}`}
              width={1200}
              height={630}
              loading="lazy"
              className="h-auto w-full rounded-xl bg-surface-2"
            />
            <p className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
              <span>
                <b className="text-foreground">{s.id}</b> · {s.note}
              </span>
              <a
                href={`/dev/design/share-card/${s.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 shrink-0 items-center gap-1 px-1 font-semibold text-primary-text underline underline-offset-4"
              >
                원본 <ExternalLink aria-hidden className="size-4" />
              </a>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

const SFX_IDS = Object.keys(SFX_USES) as SfxId[];

export function SoundSection() {
  const play = useSfx();
  const [settings] = useSoundSettings();
  const off = settings.muted || !settings.sfx.enabled;
  return (
    <Section
      id="sound"
      kicker="기타 (P2-14)"
      title="효과음 12종"
      description="첫 탭 전에는 소리를 내지 않아요(브라우저 규칙). 아무 곳이나 한 번 누른 뒤 재생하세요. 효과음은 연출 단계와 무관하게 유지되고, 소리는 유일한 정보가 아니에요(같은 내용을 글자·색·모양으로도 보여 줌)."
    >
      {off && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-small text-warning">
          지금 소리가 꺼져 있어요 (설정 또는 HUD 음소거). 재화 HUD의 소리 버튼으로 켤 수 있어요.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SFX_IDS.map((id) => (
          <li key={id} className="flex items-start gap-3 rounded-2xl bg-card p-3 shadow-card" data-surface="raised">
            <Button
              variant="secondary"
              size="sm"
              sfx={false}
              icon={<Volume2 aria-hidden />}
              onClick={() => play(id)}
              data-testid={`sfx-${id}`}
            >
              {SFX_USES[id].name}
            </Button>
            <p className="min-w-0 text-caption text-muted-foreground">
              <b className="font-mono text-foreground">{id}</b> · {SFX_USES[id].when}
            </p>
          </li>
        ))}
      </ul>
      <Demo label="별 1 → 3 상승음" note="같은 소리를 도-미-솔 비율로 (STAR_RATES)">
        <Button
          variant="reward"
          size="sm"
          sfx={false}
          onClick={() =>
            STAR_RATES.forEach((rate, i) =>
              window.setTimeout(() => play('star', { rate }), i * 260),
            )
          }
        >
          별 세 개
        </Button>
      </Demo>
      <CodeSample code={`const play = useSfx();\nplay('correct');\nplay('star', { rate: STAR_RATES[2] });`} />
    </Section>
  );
}
