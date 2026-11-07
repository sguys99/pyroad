import { forwardRef, type Ref } from 'react';
import { PybaemStatic } from '@/components/characters/rig';
import { getSkin, type SkinId } from '@/lib/avatar/skins';
import { cn } from '@/lib/utils';
import { OnboardingStamp } from './OnboardingStamp';

/** 등록증에서 강조할 칸 (지금 단계) */
export type CardField = 'nickname' | 'skin' | 'grade';

export interface RegistrationCardProps {
  /** 입력 중인 닉네임 (빈 값이면 빈 칸) */
  nickname: string;
  skin: SkinId;
  /** 색을 이미 골랐는지 (아니면 색 칸은 비어 보임. 기본 숲초록이라도 "고른 것"과 구분) */
  skinChosen: boolean;
  /** 학년: 숫자 · null(건너뜀 = "비밀") · undefined(아직) */
  grade: number | null | undefined;
  /** 강조할 칸 */
  focus?: CardField | null;
  stamped?: boolean;
  /** 발급일 (화면 표시 문자열, 서버에서 KST로 만들어 넘김 → 하이드레이션 일치) */
  issuedOn: string;
  /** compact: 좁은 화면 위 띠 (모험가 그림 + 이름 + 도장 자리) */
  variant?: 'full' | 'compact';
  /** 도장 요소 (찍는 연출) */
  stampRef?: Ref<HTMLSpanElement>;
  className?: string;
}

/**
 * 모험가 등록증 (P3-11). 온보딩이 진행되면 칸이 하나씩 채워지고, 마지막에 금색 도장이 찍힌다.
 * 흰 면 + 그림자 한 종류 + 반경 20(테두리 없음), 칸 구분은 옅은 선(`line`)만. 제목·값은 Jua, 칸 이름은 본문 글꼴.
 * 그림은 고른 색의 파이뱀 정지 그림(색이 바뀌면 몸 색이 부드럽게 바뀜, CSS fill 전환).
 * 낭독기: 등록증 전체를 한 덩어리 글(`aria-live` 아님 — 입력칸이 이미 읽힘)로, 도장이 찍히면 "등록 도장".
 */
export const RegistrationCard = forwardRef<
  HTMLDivElement,
  RegistrationCardProps
>(function RegistrationCard(
  {
    nickname,
    skin,
    skinChosen,
    grade,
    focus = null,
    stamped = false,
    issuedOn,
    variant = 'full',
    stampRef,
    className,
  },
  ref,
) {
  const s = getSkin(skin);
  const name = nickname.trim();
  const gradeText =
    grade === undefined ? '' : grade === null ? '비밀' : `${grade}학년`;

  if (variant === 'compact') {
    return (
      <div
        ref={ref}
        className={cn('ob-card ob-card-compact', className)}
        data-stamped={stamped || undefined}
        data-testid="registration-card-compact"
      >
        <span className="ob-card-portrait" data-size="sm" aria-hidden>
          <PybaemStatic
            state="idle"
            size={44}
            palette={s.palette}
            framing="avatar"
            label=""
            filters={false}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-primary-text">
            모험가 등록증
          </p>
          <p
            className="ob-card-name truncate font-display"
            data-empty={!name || undefined}
          >
            {name || '이름을 지어 줘'}
          </p>
        </div>
        <OnboardingStamp ref={stampRef} stamped={stamped} />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn('ob-card', className)}
      data-stamped={stamped || undefined}
      data-testid="registration-card"
    >
      <div className="ob-card-head">
        <span className="ob-card-portrait" aria-hidden>
          <PybaemStatic
            state={stamped ? 'proud' : 'idle'}
            size={72}
            palette={s.palette}
            framing="avatar"
            label=""
            filters={false}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-kicker text-primary-text">파이썬 섬 모험단</p>
          <h2 className="font-display text-h3 text-foreground">
            모험가 등록증
          </h2>
        </div>
        <OnboardingStamp ref={stampRef} stamped={stamped} size="lg" />
      </div>

      <dl className="ob-card-fields">
        <div
          className="ob-field"
          data-focus={focus === 'nickname' || undefined}
        >
          <dt>이름</dt>
          <dd
            className="ob-card-name font-display"
            data-empty={!name || undefined}
            data-testid="registration-card-name"
          >
            {name || '—'}
          </dd>
        </div>
        <div className="ob-field" data-focus={focus === 'skin' || undefined}>
          <dt>파이뱀 색</dt>
          <dd data-empty={!skinChosen || undefined}>
            {skinChosen ? (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="ob-swatch-dot"
                  style={{
                    background: s.palette.body,
                    boxShadow: `inset 0 0 0 2px ${s.palette.outline}`,
                  }}
                />
                {s.name}
              </span>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="ob-field" data-focus={focus === 'grade' || undefined}>
          <dt>학년</dt>
          <dd data-empty={!gradeText || undefined}>{gradeText || '—'}</dd>
        </div>
      </dl>

      <p className="ob-card-foot">발급일 {issuedOn}</p>
    </div>
  );
});
