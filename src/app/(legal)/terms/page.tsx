import type { Metadata } from 'next';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { TERMS } from '@/lib/legal/terms';

export const metadata: Metadata = {
  title: '이용약관 - pyRoad',
  description: 'pyRoad 서비스 이용약관',
};

/** 이용약관 (P3-14). 정적 페이지 */
export default function TermsPage() {
  return (
    <LegalPageShell current="/terms">
      <LegalDocumentView doc={TERMS} />
    </LegalPageShell>
  );
}
