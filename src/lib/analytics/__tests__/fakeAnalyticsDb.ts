import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * analytics_events·한도 RPC 만 흉내 내는 service_role 클라이언트 (P1-17 테스트용).
 * upsert 는 (anon_id, dedupe_key) 가 겹치면 건너뛴다 (00017 UNIQUE + ON CONFLICT DO NOTHING).
 */
export interface FakeAnalyticsDb {
  rows: Record<string, unknown>[];
  upserts: { rows: Record<string, unknown>[]; options: unknown }[];
  rpcCalls: { fn: string; args: Record<string, unknown> }[];
  deletes: { filters: [string, unknown][] }[];
  /** rpc 응답 (fn 이름별). 없으면 { data: { allowed: true } } */
  rpcResult: Record<string, { data: unknown; error: unknown }>;
  insertError: { code: string; message: string } | null;
  client: SupabaseClient<Database>;
}

export function fakeAnalyticsDb(): FakeAnalyticsDb {
  const db: FakeAnalyticsDb = {
    rows: [],
    upserts: [],
    rpcCalls: [],
    deletes: [],
    rpcResult: {},
    insertError: null,
    client: null as unknown as SupabaseClient<Database>,
  };
  const client = {
    from(table: string) {
      if (table !== 'analytics_events')
        throw new Error(`unexpected table ${table}`);
      return {
        async upsert(rows: Record<string, unknown>[], options: unknown) {
          db.upserts.push({ rows, options });
          if (db.insertError) return { error: db.insertError };
          for (const row of rows) {
            const dup =
              row.dedupe_key != null &&
              db.rows.some(
                (r) =>
                  r.anon_id === row.anon_id && r.dedupe_key === row.dedupe_key,
              );
            if (!dup) db.rows.push(row);
          }
          return { error: null };
        },
        delete() {
          const filters: [string, unknown][] = [];
          const q = {
            eq(col: string, value: unknown) {
              filters.push([col, value]);
              return q;
            },
            then(resolve: (v: { error: null }) => void) {
              db.deletes.push({ filters });
              db.rows = db.rows.filter(
                (r) => !filters.every(([c, v]) => r[c] === v),
              );
              resolve({ error: null });
            },
          };
          return q;
        },
      };
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      db.rpcCalls.push({ fn, args });
      return db.rpcResult[fn] ?? { data: { allowed: true }, error: null };
    },
  };
  db.client = client as unknown as SupabaseClient<Database>;
  return db;
}
