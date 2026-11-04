// 사용자 API 키 암호화 (B13, §12-Q24: 서버 키 AES-256-GCM)
//
// - 키: 서버 env `API_KEY_ENCRYPTION_KEY` = 32바이트를 base64로 (`openssl rand -base64 32`).
//   키를 바꿀 때는 새 키를 `API_KEY_ENCRYPTION_KEY`에, 버전을 `API_KEY_ENCRYPTION_KEY_VERSION`(기본 1)에 올리고,
//   이전 키를 `API_KEY_ENCRYPTION_KEY_PREVIOUS="<버전>:<base64>[,<버전>:<base64>]"`에 남겨 둡니다.
//   새로 저장하는 키는 현재 버전으로 암호화하고, 이전 버전 행은 이전 키로 복호화합니다.
// - 행마다 무작위 IV(12바이트), 인증 태그(16바이트). AAD에 user_id·provider를 묶어 다른 사용자·다른 provider
//   행으로 옮겨 붙인 암호문은 복호화되지 않습니다.
// - DB·Supabase를 모르는 순수 함수만 둡니다(일회성 이관 스크립트도 씀). node:crypto를 쓰므로 브라우저 번들에 넣을 수 없음.
//   앱 코드는 서버 전용 모듈 src/lib/tutor/apiKeys.ts 를 거쳐서만 씁니다.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const AAD_PREFIX = 'pyroad:user_api_keys:v1';

export interface ApiKeyKeyring {
  currentVersion: number;
  keys: Map<number, Buffer>;
}

/** user_api_keys 한 행의 암호화 필드 (모두 base64 문자열, DB 컬럼과 같은 이름) */
export interface EncryptedApiKey {
  key_version: number;
  iv: string;
  auth_tag: string;
  ciphertext: string;
}

export class ApiKeyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyConfigError';
  }
}

function decodeKey(value: string, name: string): Buffer {
  const trimmed = value.trim();
  // base64 문자 집합만 허용 (Buffer.from 은 잘못된 문자를 조용히 버림)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    throw new ApiKeyConfigError(`${name} 는 base64 문자열이어야 합니다`);
  }
  const key = Buffer.from(trimmed, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new ApiKeyConfigError(
      `${name} 는 ${KEY_BYTES}바이트여야 합니다 (지금 ${key.length}바이트). openssl rand -base64 32`,
    );
  }
  return key;
}

function parseVersion(value: string | undefined, name: string): number {
  if (value === undefined || value.trim() === '') return 1;
  const n = Number(value.trim());
  if (!Number.isInteger(n) || n < 1 || n > 32767) {
    throw new ApiKeyConfigError(`${name} 는 1~32767 정수여야 합니다`);
  }
  return n;
}

/**
 * env 에서 키 묶음을 만든다. 키가 없으면 null (커스텀 키 기능만 꺼짐).
 * 형식이 틀리면 ApiKeyConfigError (잘못된 키로 저장해 나중에 복호화하지 못하는 일을 막음).
 */
export function parseKeyring(
  env: Record<string, string | undefined>,
): ApiKeyKeyring | null {
  const raw = env.API_KEY_ENCRYPTION_KEY;
  if (!raw || raw.trim() === '') return null;

  const currentVersion = parseVersion(
    env.API_KEY_ENCRYPTION_KEY_VERSION,
    'API_KEY_ENCRYPTION_KEY_VERSION',
  );
  const keys = new Map<number, Buffer>([
    [currentVersion, decodeKey(raw, 'API_KEY_ENCRYPTION_KEY')],
  ]);

  const previous = env.API_KEY_ENCRYPTION_KEY_PREVIOUS?.trim();
  if (previous) {
    for (const entry of previous.split(',')) {
      const sep = entry.indexOf(':');
      if (sep < 0) {
        throw new ApiKeyConfigError(
          'API_KEY_ENCRYPTION_KEY_PREVIOUS 는 "<버전>:<base64>" 목록이어야 합니다',
        );
      }
      const version = parseVersion(
        entry.slice(0, sep),
        'API_KEY_ENCRYPTION_KEY_PREVIOUS 버전',
      );
      if (keys.has(version)) {
        throw new ApiKeyConfigError(`암호화 키 버전 ${version} 이 중복됩니다`);
      }
      keys.set(
        version,
        decodeKey(entry.slice(sep + 1), `API_KEY_ENCRYPTION_KEY_PREVIOUS(${version})`),
      );
    }
  }
  return { currentVersion, keys };
}

function aad(userId: string, provider: string): Buffer {
  return Buffer.from(`${AAD_PREFIX}:${userId}:${provider}`, 'utf8');
}

export function encryptApiKey(
  keyring: ApiKeyKeyring,
  userId: string,
  provider: string,
  plaintext: string,
): EncryptedApiKey {
  const key = keyring.keys.get(keyring.currentVersion)!;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(userId, provider));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    key_version: keyring.currentVersion,
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

/**
 * 복호화. 키 버전이 없거나, 암호문·태그·IV가 바뀌었거나, 다른 user_id·provider 의 행이면 예외.
 * 예외 메시지에는 키·암호문을 넣지 않음.
 */
export function decryptApiKey(
  keyring: ApiKeyKeyring,
  userId: string,
  provider: string,
  row: EncryptedApiKey,
): string {
  const key = keyring.keys.get(row.key_version);
  if (!key) throw new Error(`암호화 키 버전 ${row.key_version} 이 없습니다`);
  const iv = Buffer.from(row.iv, 'base64');
  const tag = Buffer.from(row.auth_tag, 'base64');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('암호화 필드 형식이 올바르지 않습니다');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(aad(userId, provider));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** 화면 표시용: 끝 4자리만 (짧은 값은 끝자리도 숨김) */
export function maskApiKey(plaintext: string): string {
  return plaintext.length >= 12 ? `••••${plaintext.slice(-4)}` : '••••';
}
