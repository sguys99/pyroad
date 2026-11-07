import { describe, it, expect } from 'vitest';
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  checkNicknameRules,
  nicknameKey,
  normalizeNickname,
  validateNickname,
} from '../nickname';

/** 실패 사유만 꺼내기 */
const reasonOf = (raw: string) => {
  const r = validateNickname(raw);
  return r.ok ? 'ok' : r.reason;
};

describe('validateNickname: 통과 (§12-Q14)', () => {
  it.each([
    '가나',
    'Pyroad01',
    '파이썬꿈나무',
    'abc',
    '12',
    '코딩왕123',
    '열글자닉네임이에요',
    'badminton',
  ])('%s', (name) => {
    const r = validateNickname(name);
    expect(r).toEqual({ ok: true, nickname: name, key: nicknameKey(name) });
  });

  it('10글자는 통과, 2글자는 통과 (경계값)', () => {
    expect(NICKNAME_MIN_LENGTH).toBe(2);
    expect(NICKNAME_MAX_LENGTH).toBe(10);
    expect(reasonOf('가'.repeat(10))).toBe('ok');
    expect(reasonOf('a1')).toBe('ok');
  });

  it('앞뒤 공백은 지우고 저장값으로 돌려준다', () => {
    expect(validateNickname('  코딩친구\u3000\n')).toMatchObject({
      ok: true,
      nickname: '코딩친구',
    });
  });

  it('자모로 풀린(NFD) 입력도 완성형으로 바꿔서 검사·저장한다', () => {
    const nfd = '가나'.normalize('NFD');
    expect(nfd).not.toBe('가나');
    expect(validateNickname(nfd)).toEqual({
      ok: true,
      nickname: '가나',
      key: '가나',
    });
  });
});

describe('validateNickname: 글자', () => {
  it.each([
    ['똠', '똠가'],
    ['햏', '햏햏'],
    ['뷁', '뷁뷁이'],
  ])(
    "KS X 1001 밖 한글 '%s' → unsupported_hangul + 그 글자를 알려 준다",
    (ch, name) => {
      const r = validateNickname(name);
      expect(r).toMatchObject({
        ok: false,
        reason: 'unsupported_hangul',
        char: ch,
      });
      expect(!r.ok && r.message).toBe(
        `'${ch}' 글자는 닉네임에 쓸 수 없어요. 다른 글자로 바꿔 볼까요?`,
      );
    },
  );

  it("자모만 쓴 'ㄱ'·'ㅏ'는 jamo", () => {
    expect(validateNickname('ㄱ')).toMatchObject({
      ok: false,
      reason: 'jamo',
      char: 'ㄱ',
    });
    expect(validateNickname('가ㅏ나')).toMatchObject({
      ok: false,
      reason: 'jamo',
      char: 'ㅏ',
    });
    expect(validateNickname('ㅋㅋㅋㅋ')).toMatchObject({
      ok: false,
      reason: 'jamo',
    });
  });

  it('옛한글(첫가끝 자모 조합)은 jamo 로 막는다', () => {
    // U+1112 + U+119E(아래아): NFC 로도 완성형이 되지 않음
    expect(reasonOf('\u1112\u119e나')).toBe('jamo');
  });

  it('이모지·기호는 invalid_char, 묶인 이모지는 한 덩어리로 알려 준다', () => {
    expect(validateNickname('코딩😀')).toMatchObject({
      ok: false,
      reason: 'invalid_char',
      char: '😀',
    });
    const family = '👨\u200d👩\u200d👧';
    expect(validateNickname(`가${family}`)).toMatchObject({
      ok: false,
      char: family,
    });
    expect(validateNickname('코딩_왕')).toMatchObject({
      ok: false,
      reason: 'invalid_char',
      char: '_',
    });
    expect(reasonOf('코딩!')).toBe('invalid_char');
    expect(reasonOf('ａｂｃ')).toBe('invalid_char'); // 전각 영문
    expect(reasonOf('café')).toBe('invalid_char');
    expect(reasonOf('漢字')).toBe('invalid_char');
  });

  it('띄어쓰기는 받지 않는다 (안쪽 공백)', () => {
    const r = validateNickname('파이 뱀');
    expect(r).toMatchObject({ ok: false, reason: 'space' });
    expect(r.ok || r.char).toBeUndefined();
    expect(reasonOf('코딩\t친구')).toBe('space');
    expect(reasonOf('코딩\u3000친구')).toBe('space');
  });

  it('제어 문자·폭 없는 문자·한글 채움 문자는 invisible_char (글자를 보여 주지 않음)', () => {
    for (const name of [
      '코딩\u200b친구',
      '코딩\u0007',
      '\u3164\u3164',
      '가\u200d나',
      '가\u202e나',
    ]) {
      const r = validateNickname(name);
      expect(r).toMatchObject({ ok: false, reason: 'invisible_char' });
      expect(r.ok || r.char).toBeUndefined();
    }
  });
});

describe('validateNickname: 길이', () => {
  it('빈 값·공백만은 empty', () => {
    expect(reasonOf('')).toBe('empty');
    expect(reasonOf('   ')).toBe('empty');
  });

  it('1글자는 too_short, 11글자는 too_long', () => {
    expect(reasonOf('가')).toBe('too_short');
    expect(reasonOf('a')).toBe('too_short');
    expect(reasonOf('가'.repeat(11))).toBe('too_long');
    expect(reasonOf('abcdefghijk')).toBe('too_long');
    expect(validateNickname('가'.repeat(11))).toMatchObject({
      message: '닉네임은 10글자까지 쓸 수 있어요.',
    });
  });
});

describe('validateNickname: 예약어·자리표시자', () => {
  it.each(['모험가1234', '모험가0001', '모험가'])(
    '%s → placeholder',
    (name) => {
      expect(reasonOf(name)).toBe('placeholder');
    },
  );

  it('모험가가 들어간 다른 이름은 허용', () => {
    expect(reasonOf('꼬마모험가')).toBe('ok');
    expect(reasonOf('모험가짱')).toBe('ok');
  });

  it.each([
    '운영자',
    '관리자',
    '운영진',
    '운영자짱',
    '나는관리자',
    '파이뱀',
    '버그버그',
    '별똥이',
    '파이로드',
    '선생님',
  ])('%s → reserved', (name) => {
    expect(reasonOf(name)).toBe('reserved');
  });

  it.each(['admin', 'ADMIN', 'Admin7', 'pyroad', 'PyRoad', 'PYBAEM', 'System'])(
    '영문은 대소문자 무시: %s → reserved',
    (name) => {
      expect(reasonOf(name)).toBe('reserved');
    },
  );

  it('캐릭터·서비스 이름은 정확히 같을 때만 막는다', () => {
    expect(reasonOf('Pyroad01')).toBe('ok');
    expect(reasonOf('파이뱀팬')).toBe('ok');
    expect(reasonOf('badminton')).toBe('ok');
  });
});

describe('validateNickname: 금칙어 (P1-18 필터 재사용)', () => {
  it.each(['시발놈아', '병신', 'fuckyou', '씨빨놈', 'FuCk01'])(
    '%s → banned',
    (name) => {
      const r = validateNickname(name);
      expect(r).toMatchObject({
        ok: false,
        reason: 'banned',
        message:
          '친구가 속상하거나 닉네임에 어울리지 않는 말이 들어 있어요. 다른 닉네임을 골라 볼까요?',
        moderation: { ruleId: expect.any(String) },
      });
    },
  );

  it('초성을 섞은 욕("ㅅ발놈")은 글자 규칙(jamo)에서 먼저 막힌다', () => {
    expect(reasonOf('ㅅ발놈')).toBe('jamo');
  });

  it('허용 단어(시발점)는 통과', () => {
    expect(reasonOf('시발점')).toBe('ok');
  });

  it('checkNicknameRules 는 금칙어를 보지 않는다 (입력 중 안내용)', () => {
    expect(checkNicknameRules('병신').ok).toBe(true);
    expect(validateNickname('병신').ok).toBe(false);
  });
});

describe('nicknameKey / normalizeNickname (DB lower(nickname) 와 같은 규칙)', () => {
  it('영문 대문자만 소문자로, 한글·숫자는 그대로', () => {
    expect(nicknameKey('PyRoad01')).toBe('pyroad01');
    expect(nicknameKey('코딩King')).toBe('코딩king');
    expect(nicknameKey('가나'.normalize('NFD'))).toBe('가나');
    expect(nicknameKey(' Abc ')).toBe('abc');
  });

  it('대소문자만 다른 이름은 같은 키', () => {
    expect(nicknameKey('CodingBear')).toBe(nicknameKey('codingbear'));
  });

  it('normalizeNickname: NFC + 앞뒤 공백 제거, 안쪽 공백은 그대로', () => {
    expect(normalizeNickname(' 가 나 '.normalize('NFD'))).toBe('가 나');
  });

  it('통과한 닉네임의 key 는 PostgreSQL lower() 와 같은 결과 (A-Z 만 바뀜)', () => {
    for (const name of ['ABCxyz09', '가나다', '코딩Z']) {
      const r = validateNickname(name);
      expect(r.ok && r.key).toBe(name.toLowerCase());
    }
  });
});
