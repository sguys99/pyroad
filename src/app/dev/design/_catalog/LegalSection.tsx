'use client';

import { useState } from 'react';
import { AgreementChecklist } from '@/components/legal/AgreementChecklist';
import { LegalNav } from '@/components/legal/LegalPageShell';
import { Button } from '@/components/ui/button';
import { NoticeBody } from '@/components/notice/NoticeBody';
import {
  AGREEMENT_ITEMS,
  emptyAgreementState,
  hasRequiredAgreements,
  setAllAgreements,
  toAgreementRecords,
  type AgreementState,
} from '@/lib/legal/agreements';
import { CodeSample, Demo, Section } from './ui';

type Id = (typeof AGREEMENT_ITEMS)[number]['id'];

/** 약관 동의 체크 목록 (P3-14). 온보딩(P3-11)·보호자 동의(P3-15)가 쓰는 상태들 */
export function LegalSection() {
  return (
    <Section
      id="legal"
      kicker="기타 (P3-14)"
      title="약관 동의"
      description="진짜 체크박스 + 라벨이라 Tab·Space로 고르고 스크린 리더가 읽어요. 일부만 고르면 '모두 동의'가 중간 상태가 되고, '보기'는 문서를 새 탭으로 열어요. 저장은 부르는 쪽이 toAgreementRecords()로 합니다(이 컴포넌트는 DB에 쓰지 않음)."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="처음 (아무것도 안 고름)" surface="card" data-testid="legal-empty">
          <AgreementChecklist />
        </Demo>
        <Demo label="일부만 (모두 동의 = 중간 상태)" surface="card">
          <AgreementChecklist defaultValue={{ terms: true, privacy: false }} />
        </Demo>
        <Demo label="모두 동의" surface="card">
          <AgreementChecklist defaultValue={setAllAgreements(AGREEMENT_ITEMS, true)} />
        </Demo>
        <Demo
          label="다음 단계와 함께 (필수 안내)"
          note="필수를 빼고 '다음'을 누르면 빠진 항목을 알려 줘요"
          surface="card"
        >
          <WithNextButton />
        </Demo>
        <Demo label="법적 고지 링크 (페이지 위·설정 아래)">
          <LegalNav />
        </Demo>
      </div>
      <CodeSample
        code={`const [agreements, setAgreements] = useState(emptyAgreementState(AGREEMENT_ITEMS));
const [tried, setTried] = useState(false);
<AgreementChecklist value={agreements} onChange={setAgreements} showRequiredError={tried} />
<Button onClick={() => { setTried(true); if (hasRequiredAgreements(AGREEMENT_ITEMS, agreements)) save(toAgreementRecords(AGREEMENT_ITEMS, agreements)); }}>다음</Button>`}
      />
    </Section>
  );
}

function WithNextButton() {
  const [state, setState] = useState<AgreementState<Id>>(() =>
    emptyAgreementState(AGREEMENT_ITEMS),
  );
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <AgreementChecklist
        value={state}
        onChange={(next) => {
          setState(next);
          setSaved(null);
        }}
        showRequiredError={tried}
      />
      <Button
        sfx={false}
        className="w-full"
        onClick={() => {
          setTried(true);
          if (hasRequiredAgreements(AGREEMENT_ITEMS, state)) {
            setSaved(JSON.stringify(toAgreementRecords(AGREEMENT_ITEMS, state)));
          }
        }}
      >
        다음
      </Button>
      {saved && (
        <p className="text-caption break-all text-muted-foreground" data-testid="legal-records">
          기록: {saved}
        </p>
      )}
    </div>
  );
}

const NOTICE_SAMPLE = `pyRoad가 정식 1.0 버전이 되었습니다.
보호자님께 달라진 점을 안내드립니다.

### AI 튜터
- 기본 AI 튜터는 이제 외부 AI 서비스를 쓰지 않고, 미리 준비한 힌트와 답변으로만 도와드립니다. 두 줄이 넘는 항목도 들여쓴 채로 이어져요.
- 본인 키 선택지는 **그대로**입니다.

### 보호자님께서 하실 수 있는 것
- 개인정보처리방침 전문: [pyroad.vercel.app/privacy](https://pyroad.vercel.app/privacy)

문의: sguys99@gmail.com`;

/** 공지 본문 (B145). 관리자 글만 마크다운 일부, 옛 일반 텍스트 공지도 같은 모양 */
export function NoticeBodySection() {
  return (
    <Section
      id="notice-body"
      kicker="기타 (B145)"
      title="공지 본문"
      description="### 소제목(본문 굵은 글씨) · - 목록(들여쓰기·항목 간격) · 굵게 · 링크(http(s)·mailto만, 외부는 새 탭). raw HTML·그림·표는 그리지 않고, 줄바꿈 한 번은 그대로 살려요. 게시판(학생 글)은 일반 텍스트 그대로."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="서식 있는 공지" surface="card">
          <NoticeBody content={NOTICE_SAMPLE} />
        </Demo>
        <Demo label="옛 일반 텍스트 공지" surface="card">
          <NoticeBody
            content={
              '안녕, 모험가 친구들!\n이제 카카오·네이버·Google 중에서 골라 들어올 수 있어요.\n\n- 처음 들어오면 나만의 "모험가 등록증"을 만들어요.\n  별명을 짓고, 내 파이뱀 색을 고르면 금색 도장이 쾅!\n- 3~4분이면 끝나요 <꼭>'
            }
          />
        </Demo>
      </div>
    </Section>
  );
}
