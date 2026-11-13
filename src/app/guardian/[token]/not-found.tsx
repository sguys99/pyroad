import type { Metadata } from 'next';
import { GuardianReportGoneView } from '@/components/guardian-report/GuardianReportView';

export const metadata: Metadata = {
  title: '열 수 없는 리포트',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

/** 없음·꺼짐·다시 만든 옛 링크 (P9-15). 404 상태, 학생 정보 없음 */
export default function GuardianReportNotFound() {
  return <GuardianReportGoneView />;
}
