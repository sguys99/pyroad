// #motion: 시그니처 모션은 P2-05가 채울 자리 ("준비 중"). 검토용으로 A×B 규칙표와 글꼴 실험을 둔다
import { goScreen } from '../shared/app';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { MIX_RULES } from './mixRules';
import { GameButton, Hud, Ribbon } from './ui';

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
        <section className="ab-soon" aria-labelledby="ab-soon-title">
          <PybaemRig style="AB" state="think" size={120} />
          <div>
            <Ribbon tone="orange">준비 중</Ribbon>
            <h1 id="ab-soon-title" className="ab-display ab-h1">
              시그니처 모션은 다음 작업에서 채워요
            </h1>
            <p>스테이지 해제(잉크 길 + 팝업 섬), 퀘스트 성공, 레벨업 연출이 여기에 들어와요 (P2-05). 지금 화면에는 간단한 버전만 있어요.</p>
            <div className="ab-soon-cta">
              <GameButton variant="primary" size="md" icon="map" onPress={() => goScreen('world')}>
                지도에서 섬 눌러 보기
              </GameButton>
              <GameButton variant="paper" size="md" icon="code" onPress={() => goScreen('quest')}>
                퀘스트 성공 보기
              </GameButton>
            </div>
          </div>
        </section>

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
