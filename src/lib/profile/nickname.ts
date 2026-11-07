import { moderateText, type ModerationCategory } from '@/lib/moderation/filter';
import {
  checkNicknameRules,
  nicknameMessage,
  type NicknameCheck,
} from './nicknameRules';

/**
 * 닉네임 최종 검사 (P3-11·P3-18): 글자·길이·예약어(`./nicknameRules`) + 게시판과 같은 금칙어·개인정보 필터(P1-18).
 *
 * - 순수 모듈이라 서버·클라이언트 모두 import할 수 있습니다. 다만 이 파일을 화면에서 쓰면 금칙어 목록(약 10KB)이 번들에 들어갑니다.
 *   입력 중 안내만 필요하면 `checkNicknameRules`를 쓰고, 금칙어는 저장 API에서 확인해도 됩니다.
 * - **서버는 저장 전에 반드시 다시 부릅니다**(클라이언트 결과를 믿지 않음). 중복 확인은 여기서 하지 않고 DB 유일 인덱스가 맡습니다
 *   (`nicknameKey` = `lower(nickname)`, 00012 `users_nickname_lower_key`).
 * - 어떤 단어가 걸렸는지는 화면에 보여 주지 않습니다(우회 방법을 가르치지 않게). `moderation`은 서버 기록용입니다.
 */

export {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  checkNicknameRules,
  nicknameKey,
  nicknameMessage,
  normalizeNickname,
  type NicknameCheck,
  type NicknameError,
  type NicknameRuleError,
} from './nicknameRules';

export type NicknameValidation =
  | NicknameCheck
  | (Extract<NicknameCheck, { ok: false }> & {
      reason: 'banned';
      /** 서버 기록용 (화면에 보여 주지 않음) */
      moderation: { category: ModerationCategory; ruleId: string };
    });

/** 닉네임 전체 검사. 통과하면 `{ ok: true, nickname(저장값), key(중복 확인 키) }` */
export function validateNickname(raw: string): NicknameValidation {
  const rules = checkNicknameRules(raw);
  if (!rules.ok) return rules;

  const moderation = moderateText(rules.nickname);
  if (!moderation.ok) {
    return {
      ok: false,
      reason: 'banned',
      message: nicknameMessage('banned'),
      nickname: rules.nickname,
      moderation: { category: moderation.category, ruleId: moderation.ruleId },
    };
  }
  return rules;
}
