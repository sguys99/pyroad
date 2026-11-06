'use client';

import { useId } from 'react';
import { useSfx } from '@/components/providers/soundContext';
import {
  ageBand,
  ageYearOptions,
  type AgeAnswer,
  type AgeResult,
} from '@/lib/consent/age';
import { useRovingRadio } from './useRovingRadio';

type YearValue = AgeAnswer['year'];

export interface AgeCheckProps {
  value: Partial<AgeAnswer>;
  onChange: (next: Partial<AgeAnswer>) => void;
  /** KST 오늘 계산 기준 (테스트·카탈로그) */
  now?: number;
}

/** 지금 답의 결과 (태어난 해를 아직 안 골랐으면 null) */
export function ageResultOf(
  value: Partial<AgeAnswer>,
  now?: number,
): AgeResult | null {
  if (value.year === undefined) return null;
  return ageBand(value as AgeAnswer, now);
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * 나이 확인 (P3-15). 태어난 해 칩(최근 12해 + "그보다 전" + "잘 모르겠어요") → 경계 해면 달 칩 → 이번 달이면 "생일 지났어요?".
 * 모두 라디오 묶음(←→↑↓). 태어난 해·달은 화면 상태로만 두고, 서버도 결과만 저장한다(최소 수집).
 * 질문이 더 생기면 아래로 이어 붙고(위 답은 그대로 보임), 위 답을 바꾸면 아래 답은 지운다.
 */
export function AgeCheck({ value, onChange, now }: AgeCheckProps) {
  const play = useSfx();
  const id = useId();
  const years: YearValue[] = [...ageYearOptions(now), 'older', 'unknown'];
  const result = ageResultOf(value, now);
  const needMonth =
    value.month !== undefined ||
    (result !== null && 'need' in result && result.need === 'month') ||
    (result !== null && 'need' in result && result.need === 'birthday');
  const needBirthday =
    value.birthdayPassed !== undefined ||
    (result !== null && 'need' in result && result.need === 'birthday');

  const pickYear = (year: YearValue) => {
    if (year === value.year) return;
    play('tap');
    onChange({ year });
  };
  const pickMonth = (month: number) => {
    if (month === value.month) return;
    play('tap');
    onChange({ year: value.year, month });
  };
  const pickBirthday = (passed: boolean) => {
    play('tap');
    onChange({ ...value, birthdayPassed: passed });
  };

  const yearRadio = useRovingRadio(years, value.year ?? null, pickYear);
  const monthRadio = useRovingRadio(
    MONTHS,
    (value.month ?? null) as 1 | null,
    pickMonth,
  );
  const bdValues = [true, false] as const;
  const bdRadio = useRovingRadio(
    bdValues,
    value.birthdayPassed ?? null,
    pickBirthday,
  );

  return (
    <div className="space-y-5" data-testid="age-check">
      <div className="space-y-2">
        <p id={`${id}-year`} className="ob-label">
          태어난 해
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-year`}
          className="ob-years"
          data-testid="age-years"
        >
          {years.map((y, i) => (
            <button
              key={String(y)}
              type="button"
              {...yearRadio.itemProps(i)}
              className="ob-year focus-ring"
              data-selected={y === value.year || undefined}
              data-wide={typeof y === 'string' || undefined}
              data-year={String(y)}
              onClick={() => pickYear(y)}
            >
              {y === 'older' ? (
                `${years[years.length - 3]}년보다 전`
              ) : y === 'unknown' ? (
                '잘 모르겠어요'
              ) : (
                <>
                  <span className="font-display">{y}</span>년
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {needMonth && (
        <div className="space-y-2 ob-follow" data-testid="age-months">
          <p id={`${id}-month`} className="ob-label">
            {value.year}년 몇 월에 태어났어요?
          </p>
          <div
            role="radiogroup"
            aria-labelledby={`${id}-month`}
            className="ob-months"
          >
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                {...monthRadio.itemProps(i)}
                className="ob-month focus-ring font-display"
                data-selected={m === value.month || undefined}
                onClick={() => pickMonth(m)}
              >
                {m}월
              </button>
            ))}
          </div>
        </div>
      )}

      {needBirthday && (
        <div className="space-y-2 ob-follow" data-testid="age-birthday">
          <p id={`${id}-bd`} className="ob-label">
            이번 달 생일이 지났어요?
          </p>
          <div role="radiogroup" aria-labelledby={`${id}-bd`} className="ob-bd">
            {bdValues.map((v, i) => (
              <button
                key={String(v)}
                type="button"
                {...bdRadio.itemProps(i)}
                className="ob-month focus-ring"
                data-selected={value.birthdayPassed === v || undefined}
                onClick={() => pickBirthday(v)}
              >
                {v ? '지났어요' : '아직이에요'}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && 'band' in result && (
        <p
          className="ob-age-result"
          data-band={result.band}
          data-testid="age-result"
        >
          {result.band === 'under14'
            ? '만 14세가 안 됐어요. 다음 단계에서 보호자와 함께 동의해요.'
            : '확인했어요! 바로 이름을 정하러 가요.'}
        </p>
      )}
    </div>
  );
}
