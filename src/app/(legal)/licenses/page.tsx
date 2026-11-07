import type { Metadata } from 'next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LicensesView } from '@/components/legal/LicensesView';

export const metadata: Metadata = {
  title: '오픈소스·에셋 고지 - pyRoad',
  description:
    'pyRoad가 쓰는 오픈소스 소프트웨어·글꼴·소리의 저작권과 라이선스',
};

/** 오픈소스·에셋 고지 (P3-14, §12-Q33). 데이터는 `npm run licenses:build` 생성물. 정적 페이지 */
export default function LicensesPage() {
  return (
    <LegalPageShell current="/licenses">
      <LicensesView />
    </LegalPageShell>
  );
}
