/**
 * 동의 항목과 체크 상태 로직 (P3-14). 화면은 `src/components/legal/AgreementChecklist.tsx`.
 *
 * 순수 함수만 둔다(DB 쓰기 없음). 온보딩(P3-11)과 만 14세 미만 보호자 동의(P3-15)가 같은 항목·로직을 쓰고,
 * 동의를 저장할 때는 `toAgreementRecords()`의 `{ id, version, agreed }`를 그대로 기록한다
 * (보호자 동의 기록의 "동의 항목"이 이 값이다).
 */

import { PRIVACY_VERSION, TERMS_VERSION } from './meta';

export interface AgreementItem<Id extends string = string> {
  id: Id;
  /** 문서에 남기는 공식 이름 (동의 기록·보호자 안내) */
  title: string;
  /** 체크 칸 옆 쉬운 말 */
  label: string;
  required: boolean;
  /** 동의한 문서 버전 */
  version: string;
  /** "보기" 링크 (예: `/terms`, `/privacy#children`) */
  href: string;
}

export type AgreementId = 'terms' | 'privacy';

/** 가입 때 받는 동의 (모두 필수). 선택 항목이 생기면 `required: false`로 더한다 */
export const AGREEMENT_ITEMS: readonly AgreementItem<AgreementId>[] = [
  {
    id: 'terms',
    title: '이용약관 동의',
    label: 'pyRoad 이용약관에 동의해요',
    required: true,
    version: TERMS_VERSION,
    href: '/terms',
  },
  {
    id: 'privacy',
    title: '개인정보 수집·이용 동의',
    label: '개인정보 수집·이용에 동의해요',
    required: true,
    version: PRIVACY_VERSION,
    href: '/privacy',
  },
];

/** 항목 id → 체크 여부 */
export type AgreementState<Id extends string = string> = Record<Id, boolean>;

export interface AgreementRecord<Id extends string = string> {
  id: Id;
  version: string;
  agreed: boolean;
}

export function emptyAgreementState<Id extends string>(
  items: readonly AgreementItem<Id>[],
): AgreementState<Id> {
  return Object.fromEntries(
    items.map((i) => [i.id, false]),
  ) as AgreementState<Id>;
}

/** 하나 바꾸기 */
export function setAgreement<Id extends string>(
  state: AgreementState<Id>,
  id: NoInfer<Id>,
  checked: boolean,
): AgreementState<Id> {
  return { ...state, [id]: checked };
}

/** "모두 동의": 전부 켜거나 전부 끈다 */
export function setAllAgreements<Id extends string>(
  items: readonly AgreementItem<Id>[],
  checked: boolean,
): AgreementState<Id> {
  return Object.fromEntries(
    items.map((i) => [i.id, checked]),
  ) as AgreementState<Id>;
}

/** 모두 체크했는지 ("모두 동의" 칸의 상태). 항목이 없으면 false */
export function isAllAgreed<Id extends string>(
  items: readonly AgreementItem<Id>[],
  state: AgreementState<Id>,
): boolean {
  return items.length > 0 && items.every((i) => state[i.id] === true);
}

/** 일부만 체크 ("모두 동의" 칸의 중간 표시) */
export function isPartlyAgreed<Id extends string>(
  items: readonly AgreementItem<Id>[],
  state: AgreementState<Id>,
): boolean {
  const n = items.filter((i) => state[i.id] === true).length;
  return n > 0 && n < items.length;
}

/** 필수 항목을 모두 체크했는지 (다음 단계 버튼을 여는 조건) */
export function hasRequiredAgreements<Id extends string>(
  items: readonly AgreementItem<Id>[],
  state: AgreementState<Id>,
): boolean {
  return items.every((i) => !i.required || state[i.id] === true);
}

/** 아직 체크하지 않은 필수 항목 (안내 문구용) */
export function missingRequiredAgreements<Id extends string>(
  items: readonly AgreementItem<Id>[],
  state: AgreementState<Id>,
): AgreementItem<Id>[] {
  return items.filter((i) => i.required && state[i.id] !== true);
}

/** 저장할 동의 기록 (항목마다 id·버전·동의 여부). 일시·방법은 저장하는 쪽(P3-15)이 붙인다 */
export function toAgreementRecords<Id extends string>(
  items: readonly AgreementItem<Id>[],
  state: AgreementState<Id>,
): AgreementRecord<Id>[] {
  return items.map((i) => ({
    id: i.id,
    version: i.version,
    agreed: state[i.id] === true,
  }));
}
