import { cache } from 'react';
import { createClient } from './server';

/**
 * React.cache로 래핑된 getUser.
 * 동일 서버 렌더링 요청 내에서 여러 번 호출해도 Supabase Auth 서버 요청은 1회만 발생.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
});
