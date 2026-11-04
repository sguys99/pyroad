// users.custom_api_keys(평문) → user_api_keys(암호문) 일회성 이관 (B13, v0.4 런북 ②)
//
// 새 앱은 사용자가 월드맵·설정·튜터를 처음 열 때 그 사용자의 평문 키를 옮깁니다(lazy 이관,
// src/lib/tutor/legacyApiKeys.ts). 그동안 들어오지 않은 사용자의 키를 ③ 00009(컬럼 삭제) 전에 이 스크립트로 옮깁니다.
// 앱과 같은 함수(migrateLegacyApiKeys)를 쓰고, 키·암호문은 출력하지 않습니다.
//
//   # 확인만 (기본, 아무것도 쓰지 않음)
//   npx tsx --env-file=<env 파일> scripts/api-keys/migrate-legacy.ts
//   # 실제 이관
//   npx tsx --env-file=<env 파일> scripts/api-keys/migrate-legacy.ts --apply
//
// env 파일(저장소 밖, 작업 후 삭제): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   API_KEY_ENCRYPTION_KEY(+ 교체 중이면 _VERSION·_PREVIOUS) — **Vercel Production 과 같은 값**이어야 함.
//   다른 키로 암호화하면 앱이 복호화하지 못하므로, 이미 user_api_keys 에 행이 있으면 먼저 그 행이 이 키로 풀리는지 확인하고
//   하나라도 안 풀리면 중단합니다.
// 종료 코드: 0 성공(옮길 것 없음 포함) · 1 이관 실패 · 2 설정 오류

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { decryptApiKey, parseKeyring, type ApiKeyKeyring } from '@/lib/crypto/apiKeyCipher';
import { migrateLegacyApiKeys, pickLegacyKeys } from '@/lib/tutor/legacyApiKeys';
import type { Database } from '@/lib/types/database';

const PAGE = 500;

function fail(message: string, code = 2): never {
  console.error(`오류: ${message}`);
  process.exit(code);
}

const shortId = (id: string) => `${id.slice(0, 8)}…`;

async function legacyUsers(admin: SupabaseClient<Database>) {
  const untyped = admin as unknown as SupabaseClient;
  const users: { id: string; providers: string[] }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await untyped
      .from('users')
      .select('id, custom_api_keys')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) {
      if (error.code === '42703') return null; // 00009 적용됨
      fail(`users 조회 실패: ${error.code} ${error.message}`);
    }
    for (const row of (data ?? []) as { id: string; custom_api_keys: unknown }[]) {
      const v = row.custom_api_keys;
      const empty =
        v == null || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
      if (!empty) users.push({ id: row.id, providers: Object.keys(pickLegacyKeys(v)) });
    }
    if (!data || data.length < PAGE) return users;
  }
}

/** 이미 저장된 암호문이 이 키로 풀리는지 (앱과 같은 키인지) */
async function verifyKeyring(admin: SupabaseClient<Database>, keyring: ApiKeyKeyring) {
  const { data, error } = await admin
    .from('user_api_keys')
    .select('user_id, provider, key_version, iv, auth_tag, ciphertext');
  if (error) fail(`user_api_keys 조회 실패: ${error.code} ${error.message} (00007 적용 여부 확인)`);
  let bad = 0;
  for (const row of data ?? []) {
    try {
      decryptApiKey(keyring, row.user_id, row.provider, row);
    } catch {
      bad += 1;
    }
  }
  return { total: data?.length ?? 0, bad };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다');

  let keyring: ApiKeyKeyring | null;
  try {
    keyring = parseKeyring(process.env);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
  if (!keyring) fail('API_KEY_ENCRYPTION_KEY 가 없습니다 (Vercel Production 과 같은 값)');

  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log(`대상: ${new URL(url).host} · 모드: ${apply ? '이관(--apply)' : '확인만'}`);

  const check = await verifyKeyring(admin, keyring);
  if (check.bad > 0) {
    fail(
      `user_api_keys ${check.total}행 중 ${check.bad}행이 이 키로 풀리지 않음 → 앱과 다른 API_KEY_ENCRYPTION_KEY 입니다. 중단`,
    );
  }
  console.log(
    check.total > 0
      ? `키 확인: 기존 암호문 ${check.total}행이 모두 이 키로 풀림`
      : '키 확인: 기존 암호문이 없어 앱과 같은 키인지 확인할 수 없음 (Vercel 에 등록한 값인지 다시 확인하세요)',
  );

  const users = await legacyUsers(admin);
  if (users === null) {
    console.log('users.custom_api_keys 컬럼이 없음 (00009 적용됨). 할 일 없음');
    return;
  }
  console.log(`평문 키가 남은 사용자: ${users.length}명`);
  for (const u of users) console.log(`  - ${shortId(u.id)} ${u.providers.join(', ') || '(알 수 없는 값만)'}`);
  if (!apply || users.length === 0) {
    if (!apply && users.length > 0) console.log('옮기려면 --apply 를 붙여 다시 실행하세요');
    return;
  }

  let failed = 0;
  for (const u of users) {
    const result = await migrateLegacyApiKeys(admin, keyring, u.id);
    if (result.status === 'error') {
      failed += 1;
      console.error(`  ✗ ${shortId(u.id)} ${result.message}`);
    } else {
      console.log(`  ✓ ${shortId(u.id)} ${result.status}`);
    }
  }

  const after = await legacyUsers(admin);
  const recheck = await verifyKeyring(admin, keyring);
  console.log(
    `결과: 실패 ${failed} · 남은 평문 사용자 ${after?.length ?? 0} · user_api_keys ${recheck.total}행 (복호화 실패 ${recheck.bad})`,
  );
  if (failed > 0 || (after?.length ?? 0) > 0 || recheck.bad > 0) process.exit(1);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err), 1));
