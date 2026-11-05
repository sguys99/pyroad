import { describe, it, expect } from 'vitest';
import {
  ApiKeyConfigError,
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
  parseKeyring,
} from '../apiKeyCipher';

// 고정 테스트 키 (운영 키 아님). Buffer.alloc(32, n).toString('base64')
const KEY_1 = Buffer.alloc(32, 1).toString('base64');
const KEY_2 = Buffer.alloc(32, 2).toString('base64');
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const SECRET = 'sk-ant-api03-test-key-0123456789abcd';

const keyring = parseKeyring({ API_KEY_ENCRYPTION_KEY: KEY_1 })!;

function flip(b64: string) {
  const buf = Buffer.from(b64, 'base64');
  buf[0] ^= 0x01;
  return buf.toString('base64');
}

describe('parseKeyring', () => {
  it('키가 없거나 비어 있으면 null (커스텀 키 기능만 꺼짐)', () => {
    expect(parseKeyring({})).toBeNull();
    expect(parseKeyring({ API_KEY_ENCRYPTION_KEY: '' })).toBeNull();
    expect(parseKeyring({ API_KEY_ENCRYPTION_KEY: '   ' })).toBeNull();
  });

  it('32바이트 base64 키를 버전 1로 읽음', () => {
    const k = parseKeyring({ API_KEY_ENCRYPTION_KEY: ` ${KEY_1}\n` })!;
    expect(k.currentVersion).toBe(1);
    expect(k.keys.get(1)).toEqual(Buffer.alloc(32, 1));
  });

  it('길이·형식이 틀리면 ApiKeyConfigError', () => {
    expect(() =>
      parseKeyring({
        API_KEY_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'),
      }),
    ).toThrow(ApiKeyConfigError);
    expect(() =>
      parseKeyring({ API_KEY_ENCRYPTION_KEY: 'not base64!!' }),
    ).toThrow(ApiKeyConfigError);
    expect(() =>
      parseKeyring({
        API_KEY_ENCRYPTION_KEY: KEY_1,
        API_KEY_ENCRYPTION_KEY_VERSION: '0',
      }),
    ).toThrow(ApiKeyConfigError);
    expect(() =>
      parseKeyring({
        API_KEY_ENCRYPTION_KEY: KEY_2,
        API_KEY_ENCRYPTION_KEY_VERSION: '2',
        API_KEY_ENCRYPTION_KEY_PREVIOUS: `2:${KEY_1}`,
      }),
    ).toThrow(/중복/);
    expect(() =>
      parseKeyring({
        API_KEY_ENCRYPTION_KEY: KEY_2,
        API_KEY_ENCRYPTION_KEY_PREVIOUS: KEY_1,
      }),
    ).toThrow(ApiKeyConfigError);
  });
});

describe('encryptApiKey / decryptApiKey', () => {
  it('왕복: 같은 user_id·provider 로 원문이 돌아옴', () => {
    const row = encryptApiKey(keyring, USER_A, 'anthropic', SECRET);
    expect(row.key_version).toBe(1);
    expect(Buffer.from(row.iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(row.auth_tag, 'base64')).toHaveLength(16);
    expect(decryptApiKey(keyring, USER_A, 'anthropic', row)).toBe(SECRET);
  });

  it('암호문에 원문이 드러나지 않고, 같은 원문도 매번 다른 IV·암호문', () => {
    const a = encryptApiKey(keyring, USER_A, 'openai', SECRET);
    const b = encryptApiKey(keyring, USER_A, 'openai', SECRET);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    const stored = JSON.stringify(a);
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain(SECRET.slice(-8));
  });

  it('변조 감지: 암호문·태그·IV 중 1비트만 바꿔도 실패', () => {
    const row = encryptApiKey(keyring, USER_A, 'gemini', SECRET);
    expect(() =>
      decryptApiKey(keyring, USER_A, 'gemini', {
        ...row,
        ciphertext: flip(row.ciphertext),
      }),
    ).toThrow();
    expect(() =>
      decryptApiKey(keyring, USER_A, 'gemini', {
        ...row,
        auth_tag: flip(row.auth_tag),
      }),
    ).toThrow();
    expect(() =>
      decryptApiKey(keyring, USER_A, 'gemini', { ...row, iv: flip(row.iv) }),
    ).toThrow();
    // 잘린 태그(짧은 태그로 위조 시도)도 거부
    expect(() =>
      decryptApiKey(keyring, USER_A, 'gemini', {
        ...row,
        auth_tag: Buffer.from(row.auth_tag, 'base64')
          .subarray(0, 4)
          .toString('base64'),
      }),
    ).toThrow();
  });

  it('AAD: 다른 사용자·다른 provider 행으로 옮겨 붙이면 복호화 실패', () => {
    const row = encryptApiKey(keyring, USER_A, 'anthropic', SECRET);
    expect(() => decryptApiKey(keyring, USER_B, 'anthropic', row)).toThrow();
    expect(() => decryptApiKey(keyring, USER_A, 'openai', row)).toThrow();
  });

  it('다른 키로는 복호화 실패', () => {
    const row = encryptApiKey(keyring, USER_A, 'anthropic', SECRET);
    const other = parseKeyring({ API_KEY_ENCRYPTION_KEY: KEY_2 })!;
    expect(() => decryptApiKey(other, USER_A, 'anthropic', row)).toThrow();
  });

  it('키 교체: 새 키로 암호화하고, 이전 버전 행은 PREVIOUS 키로 복호화', () => {
    const oldRow = encryptApiKey(keyring, USER_A, 'openai', SECRET);
    const rotated = parseKeyring({
      API_KEY_ENCRYPTION_KEY: KEY_2,
      API_KEY_ENCRYPTION_KEY_VERSION: '2',
      API_KEY_ENCRYPTION_KEY_PREVIOUS: `1:${KEY_1}`,
    })!;
    expect(decryptApiKey(rotated, USER_A, 'openai', oldRow)).toBe(SECRET);
    const newRow = encryptApiKey(rotated, USER_A, 'openai', SECRET);
    expect(newRow.key_version).toBe(2);
    expect(decryptApiKey(rotated, USER_A, 'openai', newRow)).toBe(SECRET);
    // 이전 키만 있는 쪽은 새 버전을 모름
    expect(() => decryptApiKey(keyring, USER_A, 'openai', newRow)).toThrow(
      /버전 2/,
    );
  });

  it('예외 메시지에 키·원문을 넣지 않음', () => {
    const row = encryptApiKey(keyring, USER_A, 'anthropic', SECRET);
    try {
      decryptApiKey(keyring, USER_B, 'anthropic', row);
      expect.unreachable();
    } catch (err) {
      const msg = String(err);
      expect(msg).not.toContain(SECRET);
      expect(msg).not.toContain(KEY_1);
    }
  });
});

describe('maskApiKey', () => {
  it('끝 4자리만 보여 줌', () => {
    expect(maskApiKey(SECRET)).toBe('••••abcd');
    expect(maskApiKey(SECRET)).not.toContain(SECRET.slice(0, -4));
  });
  it('짧은 값은 끝자리도 숨김', () => {
    expect(maskApiKey('short-key')).toBe('••••');
  });
});
