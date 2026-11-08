import { LandingSection } from '../LandingSection';
import { TrialNotebook } from './trial/TrialNotebook';
import './trial.css';

/**
 * 랜딩 `#try` 섹션: 30초 체험 공책 (P4-02 라이브 데모 + P4-03 체험, Q41·Q43).
 * 화면에 들어오면 파이뱀이 `print("안녕!")`을 직접 쳐서 결과를 보여 주고 "이제 네 차례!"로 공책을 넘긴다.
 * Pyodide는 싣지 않는다 (Q41). 공책·연출은 `trial/`, 스타일은 옆의 `trial.css`(접두사 `ld-trial-`).
 *
 * - 앵커 id `try`·제목 id `try-title`은 바꾸지 않는다 (헤더·히어로 바로가기와 e2e가 가리킴)
 * - 서버 HTML = 완성된 주문과 결과가 보이는 정지 상태 (글자 opacity 0 없음). 데모는 하이드레이션 뒤 full·lite만
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function TrialSection() {
  return (
    <LandingSection
      id="try"
      kicker="로그인 없이 30초"
      title="첫 주문을 걸어 봐요"
      lead={
        '공책의 "안녕!"을 다른 말로 고치고 "주문 걸기"를 눌러 보세요. 파이뱀이 그대로 말해 줘요.'
      }
    >
      <TrialNotebook />
    </LandingSection>
  );
}
