import { notFound } from 'next/navigation';

import { BackLink } from '@/components/ui/back-link';
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';
import { isAdminUser } from '@/lib/admin';
import { parseRange } from '@/lib/monitoring/metrics';
import { loadMonitoringSummary, sentryIssuesUrl } from '@/lib/monitoring/load';
import { getAuthUser } from '@/lib/supabase/auth';

/**
 * 운영 지표 (P12-09): 관리자(`app_metadata.role`)만. 비로그인·학생은 404 — 있는 줄도 모르게 (로그인 화면으로 보내지 않음).
 * 읽기 전용 합계(`monitoring_summary`, service_role). `?d=1|7|28`. 정의·경고 기준·같은 숫자를 내는 SQL은 docs/monitoring.md
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { user } = await getAuthUser();
  if (!isAdminUser(user)) notFound();
  const days = parseRange((await searchParams).d);
  const result = await loadMonitoringSummary(days);

  return (
    <div className="mx-auto grid max-w-lg content-start gap-4 px-4 py-4 sm:py-6 md:max-w-6xl">
      <div className="flex min-h-touch items-center">
        <BackLink href="/world">월드맵</BackLink>
      </div>
      {result.ok ? (
        <MonitoringDashboard data={result.data} sentryUrl={sentryIssuesUrl()} />
      ) : (
        <div className="grid gap-2 rounded-2xl bg-surface p-6 shadow-card">
          <h1 className="m-0 font-display text-h2">운영 지표</h1>
          <p className="m-0 text-small text-muted-foreground" role="alert">
            집계를 읽지 못했어요. 00062가 적용됐는지 확인하고, 급하면
            docs/monitoring.md의 SQL을 SQL Editor에서 돌려 주세요.
          </p>
        </div>
      )}
    </div>
  );
}
