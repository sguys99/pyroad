// #motion: 시그니처 모션 무대(P2-05) + 아래 참고 자료(A×B 규칙표, 글꼴 실험)
import { goScreen } from '../shared/app';
import { MotionStage } from './MotionStage';
import { MIX_RULES } from './mixRules';
import { GameButton, Hud } from './ui';

const PICK = -0.08;
const TRACKING: [number, number][] = [
  [0, 0],
  [-0.04, 0],
  [-0.08, -0.1],
  [-0.12, -0.15],
];

export function Rules() {
  return (
    <div className="ab-page ab-rulespage">
      <Hud />
      <main className="ab-section-inner ab-rules-main">
        <MotionStage />
        <div className="ab-refs">
          <p className="ab-refs-kicker">참고 자료 (리뷰용)</p>
          <div className="ab-soon-cta">
            <GameButton variant="paper" size="sm" icon="map" onPress={() => goScreen('world')}>
              지도에서 해제 보기
            </GameButton>
            <GameButton variant="paper" size="sm" icon="code" onPress={() => goScreen('quest')}>
              실제 퀘스트에서 성공 보기
            </GameButton>
          </div>
        </div>
        <section className="ab-rules" aria-labelledby="ab-rules-title">
          <h2 id="ab-rules-title" className="ab-display ab-h2">
            A×B 섞는 규칙표
          </h2>
          <p className="ab-lead">구조·조작·반응은 A(게임), 표면·선·기록은 B(그림책). 한 요소 안에서 두 규칙을 섞지 않아요.</p>
          <div className="ab-table-wrap" role="region" aria-label="규칙표" tabIndex={0}>
            <table className="ab-table">
              <thead>
                <tr>
                  <th scope="col">영역</th>
                  <th scope="col">A에서 가져온 것</th>
                  <th scope="col">B에서 가져온 것</th>
                  <th scope="col">섞는 규칙</th>
                </tr>
              </thead>
              <tbody>
                {MIX_RULES.map((r) => (
                  <tr key={r.area}>
                    <th scope="row">{r.area}</th>
                    <td>{r.a}</td>
                    <td>{r.b}</td>
                    <td>{r.rule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="ab-typelab" aria-labelledby="ab-typelab-title">
          <h2 id="ab-typelab-title" className="ab-display ab-h2">
            글꼴 실험
          </h2>
          <h3 className="ab-typelab-h">Gaegu 700 제목 자간</h3>
          <div className="ab-track-grid">
            {TRACKING.map(([t, ws]) => (
              <div key={t} className={`ab-track ${t === PICK ? 'is-pick' : ''}`}>
                <span className="ab-track-val">
                  자간 {t === 0 ? '0' : `${t}em`} · 낱말 간격 {ws === 0 ? '0' : `${ws}em`}
                </span>
                <span className="ab-track-sample" style={{ letterSpacing: `${t}em`, wordSpacing: `${ws}em` }}>
                  코드 한 줄로 섬이 열려요
                </span>
                <span className="ab-track-btn" style={{ letterSpacing: `${t}em`, wordSpacing: `${ws}em` }}>
                  모험 시작! 변수의 숲
                </span>
              </div>
            ))}
          </div>
          <h3 className="ab-typelab-h">A×B 본문: Pretendard vs 고운돋움</h3>
          <div className="ab-body-compare">
            {[
              ['pyRoad Sans', 'Pretendard (채택)'],
              ['Gowun Dodum', '고운돋움 (B 본문)'],
            ].map(([f, name]) => (
              <div key={f} className="ab-body-sample" style={{ fontFamily: `'${f}', sans-serif` }}>
                <span className="ab-body-name">{name}</span>
                <p className="ab-body-dialog">
                  숲 속 두 종류의 마법 상자를 발견! <b>숫자 상자</b>와 <b>글자 상자</b>를 구분해봐요.
                </p>
                <div className="ab-body-hud">
                  <span>Lv 4</span>
                  <span>1,280</span>
                  <span>힌트 1/3</span>
                  <span>★ 39/147</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
