import { hero, features, parents, faq, footer } from '@/content';
import { Topbar, Mascot, Bubble, QuestCard, CodeDemo, XpBar, Hud, Icon } from './parts';

const featureIcons = [
  ['b-mint', Icon.map],
  ['b-coral', Icon.chat],
  ['b-lemon', Icon.gift],
  ['b-sky', Icon.phone],
];

/** 성능 측정용 "전형적인 랜딩" — 히어로(제목·부제·CTA·마스코트·말풍선) → HUD → 퀘스트 → 기능 4개 → 코드 데모 → 부모님 → FAQ → 푸터 */
export default function Landing() {
  return (
    <div className="wrap">
      <Topbar showHud={false} />
      <section className="hero">
        <div>
          <span className="eyebrow">{hero.eyebrow}</span>
          <h1 className="display" id="hero-title">
            {hero.title[0]}
            <br />
            <em>{hero.title[1]}</em>
          </h1>
          <p className="lead" id="hero-lead">{hero.subtitle}</p>
          <div className="cta">
            <a className="btn" href="#"><Icon.play />{hero.ctaPrimary}</a>
            <a className="btn ghost" href="#">{hero.ctaSecondary}</a>
          </div>
        </div>
        <div className="stage">
          <Bubble />
          <div style={{ position: 'relative', width: '100%', display: 'grid', justifyItems: 'center' }}>
            <div className="island" />
            <Mascot />
          </div>
        </div>
      </section>

      <section className="section">
        <h2>오늘의 모험 현황</h2>
        <div className="grid two">
          <div className="card" style={{ display: 'grid', gap: 14 }}>
            <Hud />
            <XpBar />
          </div>
          <QuestCard />
        </div>
      </section>

      <section className="section">
        <h2>pyRoad에서는 이렇게 배워요</h2>
        <div className="grid four">
          {features.map((f, i) => {
            const [cls, Ico] = featureIcons[i];
            return (
              <article className="card" key={f.title}>
                <span className={`badge ${cls}`}><Ico /></span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section" id="code-section">
        <h2>첫 줄은 이렇게 시작해요</h2>
        <CodeDemo />
      </section>

      <section className="section">
        <div className="parents">
          <h2>{parents.title}</h2>
          <p>{parents.body}</p>
          <ul>{parents.points.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </section>

      <section className="section faq">
        <h2>자주 묻는 질문</h2>
        <dl>{faq.map((f) => [<dt key={f.q}>{f.q}</dt>, <dd key={f.a}>{f.a}</dd>])}</dl>
      </section>

      <footer className="footer">{footer}</footer>
    </div>
  );
}
