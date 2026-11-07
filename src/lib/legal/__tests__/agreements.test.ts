import { describe, expect, it } from 'vitest';
import {
  AGREEMENT_ITEMS,
  emptyAgreementState,
  hasRequiredAgreements,
  isAllAgreed,
  isPartlyAgreed,
  missingRequiredAgreements,
  setAgreement,
  setAllAgreements,
  toAgreementRecords,
  type AgreementItem,
} from '../agreements';
import { PRIVACY_VERSION, TERMS_VERSION } from '../meta';

// 동의 체크 로직 (P3-14): "모두 동의" 토글, 필수 항목 조건, 저장할 기록

const WITH_OPTIONAL: AgreementItem<'terms' | 'privacy' | 'news'>[] = [
  ...AGREEMENT_ITEMS,
  {
    id: 'news',
    title: '소식 받기',
    label: '새 퀘스트 소식을 받을래요',
    required: false,
    version: '2026-11-06',
    href: '/privacy',
  },
];

describe('동의 항목 (P3-14)', () => {
  it('가입 동의는 이용약관·개인정보 두 개이고 모두 필수, 지금 문서 버전을 가리킨다', () => {
    expect(
      AGREEMENT_ITEMS.map((i) => [i.id, i.required, i.version, i.href]),
    ).toEqual([
      ['terms', true, TERMS_VERSION, '/terms'],
      ['privacy', true, PRIVACY_VERSION, '/privacy'],
    ]);
    for (const v of [TERMS_VERSION, PRIVACY_VERSION]) {
      expect(v).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('처음에는 아무것도 체크되지 않는다', () => {
    const s = emptyAgreementState(AGREEMENT_ITEMS);
    expect(s).toEqual({ terms: false, privacy: false });
    expect(isAllAgreed(AGREEMENT_ITEMS, s)).toBe(false);
    expect(isPartlyAgreed(AGREEMENT_ITEMS, s)).toBe(false);
    expect(hasRequiredAgreements(AGREEMENT_ITEMS, s)).toBe(false);
  });

  it('"모두 동의"를 켜면 전부, 끄면 전부 꺼진다', () => {
    const on = setAllAgreements(WITH_OPTIONAL, true);
    expect(on).toEqual({ terms: true, privacy: true, news: true });
    expect(isAllAgreed(WITH_OPTIONAL, on)).toBe(true);
    const off = setAllAgreements(WITH_OPTIONAL, false);
    expect(Object.values(off).every((v) => v === false)).toBe(true);
  });

  it('하나만 체크하면 일부 상태, 마지막 하나를 체크하면 모두 동의가 된다', () => {
    let s = emptyAgreementState(AGREEMENT_ITEMS);
    s = setAgreement(s, 'terms', true);
    expect(isPartlyAgreed(AGREEMENT_ITEMS, s)).toBe(true);
    expect(isAllAgreed(AGREEMENT_ITEMS, s)).toBe(false);
    s = setAgreement(s, 'privacy', true);
    expect(isAllAgreed(AGREEMENT_ITEMS, s)).toBe(true);
    expect(isPartlyAgreed(AGREEMENT_ITEMS, s)).toBe(false);
  });

  it('모두 동의 뒤 하나를 끄면 모두 동의가 풀린다', () => {
    const s = setAgreement(
      setAllAgreements(AGREEMENT_ITEMS, true),
      'privacy',
      false,
    );
    expect(isAllAgreed(AGREEMENT_ITEMS, s)).toBe(false);
    expect(hasRequiredAgreements(AGREEMENT_ITEMS, s)).toBe(false);
    expect(
      missingRequiredAgreements(AGREEMENT_ITEMS, s).map((i) => i.id),
    ).toEqual(['privacy']);
  });

  it('필수만 체크하면 다음으로 갈 수 있다 (선택은 몰라도 됨)', () => {
    let s = emptyAgreementState(WITH_OPTIONAL);
    s = setAgreement(s, 'terms', true);
    s = setAgreement(s, 'privacy', true);
    expect(hasRequiredAgreements(WITH_OPTIONAL, s)).toBe(true);
    expect(isAllAgreed(WITH_OPTIONAL, s)).toBe(false);
    expect(missingRequiredAgreements(WITH_OPTIONAL, s)).toEqual([]);
  });

  it('상태를 바꿔도 원래 객체는 그대로 (불변)', () => {
    const s = emptyAgreementState(AGREEMENT_ITEMS);
    setAgreement(s, 'terms', true);
    expect(s.terms).toBe(false);
  });

  it('저장할 기록은 항목마다 id·버전·동의 여부', () => {
    const s = setAgreement(emptyAgreementState(WITH_OPTIONAL), 'terms', true);
    expect(toAgreementRecords(WITH_OPTIONAL, s)).toEqual([
      { id: 'terms', version: TERMS_VERSION, agreed: true },
      { id: 'privacy', version: PRIVACY_VERSION, agreed: false },
      { id: 'news', version: '2026-11-06', agreed: false },
    ]);
  });

  it('항목이 없으면 모두 동의가 아니다', () => {
    expect(isAllAgreed([], {})).toBe(false);
    expect(hasRequiredAgreements([], {})).toBe(true);
  });
});
