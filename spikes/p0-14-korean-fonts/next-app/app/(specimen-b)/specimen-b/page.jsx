import Specimen from '@/components/Specimen';
import { SYS_SANS, SYS_MONO } from '@/components/parts';

export default function Page() {
  return (
    <Specimen
      stack="b"
      meta={{ stackName: 'B 마법 그림책', title: 'Gaegu Bold', body: 'Gowun Dodum', code: 'D2Coding' }}
      titleOptions={[
        { name: 'Gaegu Bold 700 · Google Fonts · OFL', family: `var(--nf-gaegu), ${SYS_SANS}`, weight: 700, note: '제목·버튼·말풍선 이름표. 한글 2,350자만 → 희귀 글자 대체' },
        { name: 'Gaegu Regular 400', family: `var(--nf-gaegu), ${SYS_SANS}`, weight: 400, note: '손글씨 메모·스탬프 문구용' },
        { name: 'Gowun Dodum 400 (제목으로 쓸 때)', family: `var(--nf-gowun), ${SYS_SANS}`, weight: 400, note: '한 굵기뿐 → 굵게는 합성(faux bold)됨' },
      ]}
      bodyAlt={{ name: 'Gaegu 400', family: `var(--nf-gaegu), ${SYS_SANS}`, weight: 400, size: 19 }}
      monos={[
        { name: 'JetBrains Mono + 시스템 한글', family: `var(--nf-jbm), ${SYS_MONO}`, note: '현재 v0.3 설정' },
        { name: 'D2Coding', family: `'D2Coding', ${SYS_MONO}`, note: '권장 · 리거처 없는 기본판' },
        { name: '나눔고딕코딩', family: `var(--nf-ngc), ${SYS_MONO}`, note: '대안 · next/font/google로 바로 사용 가능' },
      ]}
    />
  );
}
