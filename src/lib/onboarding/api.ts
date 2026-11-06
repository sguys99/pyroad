/**
 * 온보딩 API 약속 (P3-11). 화면(`src/components/onboarding/`)과 API Route가 같은 모양을 쓴다.
 * 브라우저 번들에도 들어가므로 타입·상수·문구만 둔다 (zod 검사는 서버 전용 `./schema`).
 *
 *   GET  /api/profile/nickname?name=<입력>   → NicknameAvailability
 *   POST /api/onboarding  OnboardingRequest  → OnboardingResponse
 */
import type { NicknameError } from '@/lib/profile/nicknameRules';
import type { SkinId } from '@/lib/avatar/skins';
import type { AgreementRecord, GuardianRelation } from '@/lib/legal/agreements';
import type { AgeAnswer } from '@/lib/consent/age';

export const NICKNAME_CHECK_ENDPOINT = '/api/profile/nickname';
export const ONBOARDING_ENDPOINT = '/api/onboarding';

/** 닉네임 확인 결과. 실패 사유는 글자 규칙·금칙어(`NicknameError`)·중복·요청 한도·서버 오류 */
export type NicknameUnavailableReason =
  | NicknameError
  | 'taken'
  | 'rate_limited'
  | 'error';

export type NicknameAvailability =
  | { ok: true; nickname: string }
  | {
      ok: false;
      reason: NicknameUnavailableReason;
      /** 아이에게 보여 줄 문구 */
      message: string;
      /** 문제가 된 글자 (글자 규칙일 때) */
      char?: string;
      /** 중복일 때 대신 쓸 수 있는 이름 (숫자를 붙인 것, 서버가 비어 있는지 확인함) */
      suggestion?: string;
    };

export interface OnboardingRequest {
  nickname: string;
  skin: SkinId;
  /** 1~6, 건너뛰면 null */
  grade: number | null;
  /** `toAgreementRecords(AGREEMENT_ITEMS, state)` 그대로 */
  agreements: AgreementRecord[];
  /** 나이 확인 답 (P3-15). 서버가 다시 계산하고 결과만 저장 */
  age: AgeAnswer;
  /** 보호자가 함께 동의했을 때 (만 14세 미만), 아니면 null = 나중에 (제한 모드) */
  guardian: GuardianConsentRequest | null;
}

/** 보호자 동의 (P3-15): `toAgreementRecords(GUARDIAN_AGREEMENT_ITEMS, state)` + 관계(선택) */
export interface GuardianConsentRequest {
  agreements: AgreementRecord[];
  relation: GuardianRelation | null;
}

export const GUARDIAN_CONSENT_ENDPOINT = '/api/consent/guardian';

export type GuardianConsentResponse =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'invalid_body'
        | 'guardian_agreements_required'
        | 'not_under14'
        | 'rate_limited'
        | 'unauthorized'
        | 'server_error';
      message: string;
    };

export const GUARDIAN_AGREEMENTS_REQUIRED_MESSAGE =
  '보호자 동의 항목을 모두 체크해 주세요.';

export type OnboardingErrorCode =
  | 'invalid_body'
  | 'invalid_nickname'
  | 'nickname_taken'
  | 'agreements_required'
  | 'guardian_agreements_required'
  | 'rate_limited'
  | 'unauthorized'
  | 'server_error';

export type OnboardingResponse =
  | {
      ok: true;
      first: boolean;
      /** 만 14세 미만 + 보호자 동의 전 → 제한 모드 (P3-15) */
      restricted: boolean;
    }
  | {
      ok: false;
      error: OnboardingErrorCode;
      message: string;
      /** invalid_nickname 일 때 사유 */
      reason?: NicknameError;
      /** nickname_taken 일 때 대신 쓸 수 있는 이름 */
      suggestion?: string;
    };

/** 닉네임 중복 안내 (가리키는 사람 없이, 다른 이름을 권함) */
export const NICKNAME_TAKEN_MESSAGE =
  '이미 다른 친구가 쓰고 있어요. 숫자를 붙이거나 다른 이름을 골라 볼까요?';

export const NICKNAME_RATE_LIMITED_MESSAGE =
  '확인을 너무 많이 했어요. 잠깐 쉬었다가 다시 해 볼까요?';

export const ONBOARDING_SERVER_ERROR_MESSAGE =
  '앗, 잠깐 문제가 생겼어요. 조금 뒤에 다시 눌러 볼까요?';

export const AGREEMENTS_REQUIRED_MESSAGE =
  '이용약관과 개인정보 수집·이용에 동의해야 모험을 시작할 수 있어요.';
