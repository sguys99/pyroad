// 테스트용 메모리 DB: users(preferred_provider, custom_api_keys, settings) + user_api_keys 만 흉내 냄.
// legacyColumn=false 면 00009 이후처럼 users.custom_api_keys 조회·수정이 42703 을 냄.

export interface FakeKeyRow {
  user_id: string;
  provider: string;
  key_version: number;
  iv: string;
  auth_tag: string;
  ciphertext: string;
  updated_at?: string;
}

export interface FakeState {
  users: Record<
    string,
    {
      preferred_provider: string | null;
      custom_api_keys?: unknown;
      /** users.settings (P2-15 움직임·P2-14 사운드 설정) */
      settings?: unknown;
    }
  >;
  user_api_keys: FakeKeyRow[];
  legacyColumn: boolean;
  /** 설정하면 user_api_keys 쓰기가 이 오류로 실패 */
  failKeyWrites?: { code: string; message: string };
}

type Result = {
  data: unknown;
  error: { code: string; message: string } | null;
};

const MISSING = {
  code: '42703',
  message: 'column users.custom_api_keys does not exist',
};

export function fakeAdmin(state: FakeState) {
  return {
    /** patch_user_settings (00020): settings || p_patch, 키는 motion·sound 만 */
    async rpc(fn: string, args: Record<string, unknown>): Promise<Result> {
      if (fn !== 'patch_user_settings')
        throw new Error(`fakeAdmin: unknown rpc ${fn}`);
      const patch = args.p_patch as Record<string, unknown>;
      if (
        Object.entries(patch).some(
          ([k, v]) =>
            !['motion', 'sound'].includes(k) ||
            !v ||
            typeof v !== 'object' ||
            Array.isArray(v),
        )
      )
        return {
          data: null,
          error: { code: 'PT400', message: 'invalid_settings_key' },
        };
      const user = state.users[args.p_user_id as string];
      if (!user) return { data: false, error: null };
      const current =
        user.settings && typeof user.settings === 'object'
          ? (user.settings as Record<string, unknown>)
          : {};
      user.settings = { ...current, ...patch };
      return { data: true, error: null };
    },
    from(table: string) {
      const filters: [string, unknown][] = [];
      let mode: 'select' | 'update' | 'delete' = 'select';
      let columns = '*';
      let patch: Record<string, unknown> = {};

      const match = (row: Record<string, unknown>) =>
        filters.every(([c, v]) => row[c] === v);

      function run(): Result {
        if (table === 'users') {
          const touchesLegacy =
            (mode === 'select' && columns.includes('custom_api_keys')) ||
            (mode === 'update' && 'custom_api_keys' in patch);
          if (touchesLegacy && !state.legacyColumn)
            return { data: null, error: MISSING };
          const rows = Object.entries(state.users)
            .map(([id, u]) => ({ id, ...u }))
            .filter(match);
          if (mode === 'update') {
            for (const r of rows) Object.assign(state.users[r.id], patch);
            return { data: null, error: null };
          }
          return { data: rows, error: null };
        }
        if (table === 'user_api_keys') {
          if (mode === 'delete') {
            if (state.failKeyWrites)
              return { data: null, error: state.failKeyWrites };
            state.user_api_keys = state.user_api_keys.filter(
              (r) => !match(r as unknown as Record<string, unknown>),
            );
            return { data: null, error: null };
          }
          return {
            data: state.user_api_keys
              .filter((r) => match(r as unknown as Record<string, unknown>))
              .map((r) => ({ ...r })),
            error: null,
          };
        }
        throw new Error(`fakeAdmin: unknown table ${table}`);
      }

      const builder = {
        select(cols = '*') {
          columns = cols;
          return builder;
        },
        eq(col: string, value: unknown) {
          filters.push([col, value]);
          return builder;
        },
        update(values: Record<string, unknown>) {
          mode = 'update';
          patch = values;
          return builder;
        },
        delete() {
          mode = 'delete';
          return builder;
        },
        async upsert(
          input: FakeKeyRow | FakeKeyRow[],
          opts: { onConflict?: string; ignoreDuplicates?: boolean } = {},
        ): Promise<Result> {
          if (table !== 'user_api_keys')
            throw new Error('fakeAdmin: upsert only on user_api_keys');
          if (state.failKeyWrites)
            return { data: null, error: state.failKeyWrites };
          for (const row of Array.isArray(input) ? input : [input]) {
            const i = state.user_api_keys.findIndex(
              (r) => r.user_id === row.user_id && r.provider === row.provider,
            );
            if (i < 0) state.user_api_keys.push({ ...row });
            else if (!opts.ignoreDuplicates)
              state.user_api_keys[i] = { ...row };
          }
          return { data: null, error: null };
        },
        async maybeSingle(): Promise<Result> {
          const r = run();
          if (r.error) return r;
          return { data: (r.data as unknown[])[0] ?? null, error: null };
        },
        async single(): Promise<Result> {
          return builder.maybeSingle();
        },
        then<T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) {
          try {
            return Promise.resolve(resolve(run()));
          } catch (e) {
            return reject ? Promise.resolve(reject(e)) : Promise.reject(e);
          }
        },
      };
      return builder;
    },
  };
}
