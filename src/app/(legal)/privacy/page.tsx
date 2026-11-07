import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo/metadata';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { PRIVACY } from '@/lib/legal/privacy';

export const metadata: Metadata = publicPageMetadata({
  title: '개인정보처리방침',
  description:
    'pyRoad 개인정보처리방침과 만 14세 미만 아동의 개인정보 처리 안내',
});

/** 개인정보처리방침 (P3-14). 정적 페이지 */
export default function PrivacyPage() {
  return (
    <LegalPageShell current="/privacy">
      <LegalDocumentView doc={PRIVACY} />
    </LegalPageShell>
  );
}
