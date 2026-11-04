import { isRetiredModel, MODEL_ENV } from '@/lib/tutor/providers/models';
import type { LLMProviderType } from '@/lib/tutor/providers/types';

/**
 * 서버 시작 때 env 를 한 번 점검해 빠진 값을 알기 쉬운 로그로 남긴다 (P1-22, `src/instrumentation.ts`).
 *
 * 앱을 멈추지는 않는다(throw 하지 않음). 필수 값이 없으면 어차피 요청마다 Supabase 클라이언트가 실패하므로, 여기서는 그 원인을
 * 처음에 한 줄로 알려 주는 것이 목적이다. 선택 기능(Sentry·분석·API 키 암호화)은 각 모듈이 꺼질 때 스스로 알린다.
 * 값은 출력하지 않고 이름만 쓴다. 목록·설명: `.env.example`
 */
export const REQUIRED_SERVER_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export interface ServerEnvProblems {
  missing: string[];
  warnings: string[];
}

export function findServerEnvProblems(
  env: Record<string, string | undefined>,
): ServerEnvProblems {
  const isSet = (name: string) => !!env[name]?.trim();
  const missing = REQUIRED_SERVER_ENV.filter((name) => !isSet(name));
  const warnings: string[] = [];

  if (!isSet('GEMINI_API_KEY')) {
    warnings.push(
      'GEMINI_API_KEY 가 없어 튜터는 본인 API 키가 없는 학생에게 저장된 답변만 보냅니다',
    );
  }
  for (const [type, name] of Object.entries(MODEL_ENV) as [LLMProviderType, string][]) {
    const model = env[name]?.trim();
    if (model && isRetiredModel(type, model)) {
      warnings.push(
        `${name}=${model} 은 제공이 끝난 모델이라 코드 기본 모델을 씁니다. ${name} 을 지우거나 바꾸세요 (B35)`,
      );
    }
  }
  return { missing, warnings };
}

export function reportServerEnvProblems(
  env: Record<string, string | undefined> = process.env,
): ServerEnvProblems {
  const problems = findServerEnvProblems(env);
  if (problems.missing.length > 0) {
    console.error(
      `[env] 필수 env 가 없습니다: ${problems.missing.join(', ')} → 로그인·DB 요청이 실패합니다. .env.local(로컬) 또는 Vercel 프로젝트 env 에 넣고 다시 시작하세요 (.env.example)`,
    );
  }
  for (const warning of problems.warnings) {
    console.warn(`[env] ${warning}`);
  }
  return problems;
}
