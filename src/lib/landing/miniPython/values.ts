/**
 * 미니 파이썬 값과 출력 모양 (P4-03). 정수는 BigInt라 `2 ** 100`도 진짜 파이썬과 같은 글자로 나온다.
 */
export type Value =
  | { t: 'str'; v: string }
  | { t: 'int'; v: bigint }
  | { t: 'float'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'none' };

export const str = (v: string): Value => ({ t: 'str', v });
export const int = (v: bigint): Value => ({ t: 'int', v });
export const float = (v: number): Value => ({ t: 'float', v });
export const NONE: Value = { t: 'none' };

/** 파이썬 타입 이름 (오류 문장용) */
export function typeName(x: Value): string {
  switch (x.t) {
    case 'str':
      return 'str';
    case 'int':
      return 'int';
    case 'float':
      return 'float';
    case 'bool':
      return 'bool';
    default:
      return 'NoneType';
  }
}

/**
 * 파이썬 `repr(float)`과 같은 글자: 가장 짧게 되돌아오는 자릿수 + 지수가 -4 미만이거나 16 이상이면 `1e+16`·`1e-05` 꼴,
 * 아니면 고정 소수점이고 정수면 `.0`을 붙인다. JS `toExponential()`(인자 없음)이 가장 짧은 자릿수를 준다.
 */
export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return 'nan';
  if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
  const sign = x < 0 ? '-' : '';
  const [mant, expText] = Math.abs(x).toExponential().split('e');
  const exp = Number(expText);
  const digits = mant.replace('.', '');
  if (exp < -4 || exp >= 16) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    const e = Math.abs(exp).toString().padStart(2, '0');
    return `${sign}${m}e${exp < 0 ? '-' : '+'}${e}`;
  }
  if (exp < 0) return `${sign}0.${'0'.repeat(-exp - 1)}${digits}`;
  const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, '0');
  const frac = digits.slice(exp + 1);
  return `${sign}${intPart}.${frac || '0'}`;
}

/** `print`가 찍는 글자 (`str(x)`) */
export function toText(x: Value): string {
  switch (x.t) {
    case 'str':
      return x.v;
    case 'int':
      return x.v.toString();
    case 'float':
      return pyFloatRepr(x.v);
    case 'bool':
      return x.v ? 'True' : 'False';
    default:
      return 'None';
  }
}
