import Specimen from '@/components/Specimen';
import { SYS_SANS, SYS_MONO } from '@/components/parts';

export default function Page() {
  return (
    <Specimen
      stack="a"
      meta={{ stackName: 'A 모험 섬', title: 'Jua', body: 'Pretendard', code: 'D2Coding' }}
      titleOptions={[
        { name: 'Jua · Google Fonts · OFL', family: `var(--nf-jua), ${SYS_SANS}`, weight: 400, note: '한 굵기(400). 한글 2,367자 → 희귀 글자는 시스템 폰트로 대체' },
        { name: 'Cafe24 써라운드 · OFL(+카페24 고지)', family: `'Cafe24 Ssurround', ${SYS_SANS}`, weight: 400, note: '한 굵기(굵은 디자인). 한글 11,172자 전체' },
        { name: 'Cafe24 써라운드 에어 · OFL(+카페24 고지)', family: `'Cafe24 Ssurround Air', ${SYS_SANS}`, weight: 400, note: '가는 짝꿍. 부제·라벨용' },
      ]}
      monos={[
        { name: 'JetBrains Mono + 시스템 한글', family: `var(--nf-jbm), ${SYS_MONO}`, note: '현재 v0.3 설정' },
        { name: 'D2Coding', family: `'D2Coding', ${SYS_MONO}`, note: '권장 · 리거처 없는 기본판' },
        { name: '나눔고딕코딩', family: `var(--nf-ngc), ${SYS_MONO}`, note: '대안 · next/font/google로 바로 사용 가능' },
      ]}
    />
  );
}
