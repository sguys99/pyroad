import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GuardianReportView } from '@/components/guardian-report/GuardianReportView';
import { loadGuardianReport } from '@/lib/guardian-report/load';
import { weekOffset } from '@/lib/guardian-report/report';

/**
 * 보호자 주간 리포트 (P9-15, §12-Q67 ②). 학생이 설정에서 만든 비공개 링크로 보호자가 로그인 없이 연다.
 *
 * - 조회는 `loadGuardianReport`(service_role `guardian_report`: 토큰 해시 → 학생 → 집계만)뿐
 * - 쿼리는 `week=last`(지난 주)만 읽고 글자는 그리지 않는다
 * - 비공개: `noindex`·`no-referrer`, 미들웨어가 `Cache-Control: private, no-store`·`X-Robots-Tag` 를 붙이고 세션 갱신은 건너뜀.
 *   제목에 닉네임을 넣지 않음(메신저 미리보기에 이름이 보이지 않게), og 그림 없음
 * - 없음·꺼짐·다시 만든 옛 링크 → `not-found.tsx`(404, 모두 같은 답), 조회 실패 → 던져서 500
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '주간 학습 리포트',
  description: 'pyRoad 보호자용 주간 학습 리포트',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ week?: string | string[] }>;
};

export default async function GuardianReportPage({
  params,
  searchParams,
}: Props) {
  const [{ token }, { week }] = await Promise.all([params, searchParams]);
  const report = await loadGuardianReport(token, weekOffset(week));
  if (report === 'error') throw new Error('guardian report unavailable');
  if (!report) notFound();
  return <GuardianReportView report={report} token={token} />;
}
