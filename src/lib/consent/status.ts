/**
 * 보호자 동의 상태와 제한 모드 (P3-15, §12-Q35·Q36). 순수 함수 — 서버(게시판 API·레이아웃)와 화면이 같이 쓴다.
 *
 * - 만 14세 이상(`14plus`) 또는 보호자 동의를 마친 계정 = 제한 없음
 * - 그 밖(만 14세 미만 + 동의 전, 또는 나이 확인 결과가 없음) = **제한 모드**: 학습은 그대로, 다른 사람에게 보이는 쓰기
 *   (게시판 글·고치기·댓글, 앞으로의 공유·갤러리)는 막는다. 신고는 공개되지 않고 아이가 해로운 글을 알리는 길이라 막지 않는다. 나이 확인 결과가 없으면 만 14세 미만으로 본다 (안전한 쪽)
 * - 파기 기한(`consent_deadline`) = 만 14세 미만으로 확인된 때 + 30일 (Q36). 7일 전부터 화면에 남은 날을 알린다
 */

export const CONSENT_GRACE_DAYS = 30;
export const CONSENT_WARN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ConsentRow {
  age_band: string | null;
  guardian_consented_at: string | null;
  consent_deadline: string | null;
}

export type ConsentStatus =
  | { state: 'ok' }
  | {
      state: 'pending';
      /** 파기 기한 (ISO). 없으면(아직 나이 확인 전) null */
      deadline: string | null;
      /** 남은 날 (올림, 0 이상). 기한이 없으면 null */
      daysLeft: number | null;
      /** 7일 이하로 남음 → 경고 띠 */
      warn: boolean;
    };

export function consentStatus(
  row: ConsentRow,
  now: number = Date.now(),
): ConsentStatus {
  if (row.age_band === '14plus' || row.guardian_consented_at) {
    return { state: 'ok' };
  }
  const deadline = row.consent_deadline;
  const ms = deadline ? Date.parse(deadline) : NaN;
  const daysLeft = Number.isFinite(ms)
    ? Math.max(0, Math.ceil((ms - now) / DAY_MS))
    : null;
  return {
    state: 'pending',
    deadline: Number.isFinite(ms) ? deadline : null,
    daysLeft,
    warn: daysLeft !== null && daysLeft <= CONSENT_WARN_DAYS,
  };
}

export function isRestricted(status: ConsentStatus): boolean {
  return status.state === 'pending';
}

/** 제한 모드에서 막는 일을 거절할 때 아이에게 보여 줄 문구 (게시판 API·화면 공통). 신고는 막지 않음 */
export const GUARDIAN_REQUIRED_MESSAGE =
  '보호자 동의 전에는 게시판에 글이나 댓글을 쓸 수 없어요. 보호자와 함께 동의하면 바로 쓸 수 있어요!';
