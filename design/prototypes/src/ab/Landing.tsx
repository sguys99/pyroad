// 랜딩 #landing: 팝업북 히어로 · 소셜 로그인 자리 · 30초 체험(X4) · 월드 3장 미리보기 · 캐릭터 3인 · 학부모 안내(X5) · 푸터
import { useRef, useState } from 'react';
import { goScreen } from '../shared/app';
import { BugBug, Byeolttongi } from '../shared/characters/Friends';
import { Icon, RewardIcon, type IconName } from '../shared/icons';
import { PybaemRig, PybaemStatic, type PybaemRigHandle } from '../shared/rig/PybaemRig';
import { WORLD1, STAGES } from '../shared/content';
import { play, springTiming } from '../shared/motion';
import { Cloud, HeroIsland, PopupBook, WorldArt } from './art';
import { fakeRun } from './fakeRun';
import { Bubble, GameButton, Ribbon } from './ui';

const questCount = STAGES.reduce((n, s) => n + s.quests.length, 0);

export function Landing() {
  return (
    <div className="ab-page ab-landing">
      <header className="ab-topbar">
        <a className="ab-logo" href="#landing" aria-label="pyRoad 처음으로">
          <PybaemStatic style="AB" state="happy" size={40} idPrefix="logopy" />
          <span>pyRoad</span>
        </a>
        <nav className="ab-topnav" aria-label="랜딩 메뉴">
          <a href="#ab-try">체험</a>
          <a href="#ab-worlds">월드</a>
          <a href="#ab-parents">학부모 안내</a>
        </nav>
        <GameButton variant="paper" size="sm" onPress={() => document.getElementById('ab-login')?.scrollIntoView({ block: 'center' })}>
          로그인
        </GameButton>
      </header>
      <main>
        <Hero />
        <TrySection />
        <WorldsSection />
        <FriendsSection />
        <ParentsSection />
      </main>
      <footer className="ab-footer">
        <div className="ab-footer-inner">
          <a className="ab-logo ab-logo-sm" href="#landing">
            <PybaemStatic style="AB" state="idle" size={32} idPrefix="footpy" />
            <span>pyRoad</span>
          </a>
          <p>초등학생을 위한 파이썬 모험 그림책</p>
          <nav aria-label="바닥 메뉴" className="ab-footer-links">
            <a href="#landing">이용약관</a>
            <a href="#landing">개인정보처리방침</a>
            <a href="#landing">공지사항</a>
          </nav>
          <p className="ab-footer-small">디자인 시안 A×B (P2-04) · 프로토타입이라 실제 로그인·저장은 되지 않아요</p>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  const rig = useRef<PybaemRigHandle | null>(null);
  return (
    <section className="ab-hero" aria-labelledby="ab-hero-title">
      <div className="ab-hero-inner">
        <div className="ab-hero-copy">
          <Ribbon>파이썬 모험 그림책</Ribbon>
          <h1 id="ab-hero-title" className="ab-display ab-hero-title">
            코드 한 줄로
            <br />
            섬이 <span className="ab-mark">열려요!</span>
          </h1>
          <p className="ab-hero-sub">
            파이뱀 선생님과 함께 퀘스트를 깨면 종이 지도 위에 새 섬이 하나씩 솟아올라요. {questCount}개의 퀘스트가 기다리고 있어요.
          </p>
          <div className="ab-hero-cta">
            <GameButton variant="primary" size="lg" icon="play" onPress={() => goScreen('world')}>
              모험 시작!
            </GameButton>
            <GameButton variant="paper" size="md" icon="code" onPress={() => document.getElementById('ab-try')?.scrollIntoView({ block: 'start' })}>
              30초 체험
            </GameButton>
          </div>
          <div className="ab-login" id="ab-login" role="group" aria-label="소셜 로그인">
            <p className="ab-login-label">이미 모험가라면</p>
            <div className="ab-login-row">
              <button type="button" className="ab-social ab-social-google">
                <span className="ab-social-mark" aria-hidden>
                  G
                </span>
                Google로 계속
              </button>
              <button type="button" className="ab-social ab-social-kakao">
                <span className="ab-social-mark" aria-hidden>
                  K
                </span>
                카카오로 계속
              </button>
              <button type="button" className="ab-social ab-social-naver">
                <span className="ab-social-mark" aria-hidden>
                  N
                </span>
                네이버로 계속
              </button>
            </div>
          </div>
        </div>
        <div className="ab-hero-art">
          <div className="ab-hero-cloud ab-hero-cloud-1 m-ambient">
            <Cloud w={120} />
          </div>
          <div className="ab-hero-cloud ab-hero-cloud-2 m-ambient">
            <Cloud w={84} />
          </div>
          <PopupBook>
            <div className="ab-hero-stage">
              <HeroIsland />
              <button type="button" className="ab-hero-py" aria-label="파이뱀 콕 찌르기" onClick={() => rig.current?.poke()}>
                <PybaemRig ref={rig} style="AB" state="happy" size={240} />
              </button>
              <Bubble side="left" className="ab-hero-bubble">
                안녕! 나는 <b>파이뱀</b>이야.
                <br />
                같이 섬을 열어 볼래?
              </Bubble>
              <span className="ab-hero-sticker ab-hero-sticker-1 m-loop">
                <RewardIcon kind="coin" style="AB" size={40} />
              </span>
              <span className="ab-hero-sticker ab-hero-sticker-2 m-loop">
                <RewardIcon kind="star" style="AB" size={36} />
              </span>
            </div>
          </PopupBook>
        </div>
      </div>
    </section>
  );
}

// ───────────── 30초 체험 (X4): print 한 줄 고쳐 실행

function TrySection() {
  const [code, setCode] = useState('print("안녕, 파이뱀!")');
  const [res, setRes] = useState<{ ok: boolean; text: string; talk: string } | null>(null);
  const outRef = useRef<HTMLDivElement | null>(null);
  const run = () => {
    const r = fakeRun(code);
    if (r.error) setRes({ ok: false, text: r.error.short, talk: r.error.talk });
    else if (!r.out.length) setRes({ ok: false, text: '(아무것도 나오지 않았어요)', talk: 'print( ) 안에 보여 줄 글자를 넣어 봐!' });
    else {
      const said = r.out.join(' ');
      setRes({ ok: true, text: r.out.join('\n'), talk: said.includes('파이뱀') ? '와, 내 이름을 불렀네! 이제 따옴표 안을 네 이름으로 바꿔 봐.' : `"${said}" 멋지다! 방금 너는 파이썬 코드를 실행했어.` });
    }
    requestAnimationFrame(() => play(outRef.current, [{ transform: 'translateY(8px) scale(0.98)' }, { transform: 'none' }], springTiming('prop')));
  };
  return (
    <section className="ab-section ab-try" id="ab-try" aria-labelledby="ab-try-title">
      <div className="ab-section-inner ab-try-grid">
        <div>
          <Ribbon tone="blue">로그인 없이 30초</Ribbon>
          <h2 id="ab-try-title" className="ab-display ab-h2">
            지금 바로 한 줄 실행해 봐요
          </h2>
          <p className="ab-lead">따옴표 안의 글자를 바꾸고 실행 버튼을 눌러 보세요. 파이뱀이 대답해 줘요.</p>
          <ul className="ab-try-tips">
            <li>
              <Icon name="check" size={20} strokeWidth={2.8} /> 글자는 <code>"따옴표"</code> 안에 써요
            </li>
            <li>
              <Icon name="check" size={20} strokeWidth={2.8} /> 따옴표를 하나 지우면 버그버그가 나타나요
            </li>
          </ul>
        </div>
        <div className="ab-try-card">
          <div className="ab-codecard-head">
            <span className="ab-codecard-tab">
              <Icon name="code" size={18} strokeWidth={2.4} /> 체험.py
            </span>
          </div>
          <label className="sr-only" htmlFor="ab-try-input">
            체험 코드
          </label>
          <div className="ab-try-line">
            <span className="ab-gutter" aria-hidden>
              1
            </span>
            <input
              id="ab-try-input"
              className="ab-try-input"
              value={code}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && run()}
            />
          </div>
          <div className="ab-try-run">
            <GameButton variant="primary" size="md" icon="play" onPress={run}>
              실행
            </GameButton>
            <button type="button" className="ab-textbtn" onClick={() => (setCode('print("안녕, 파이뱀!")'), setRes(null))}>
              <Icon name="refresh" size={20} strokeWidth={2.4} /> 처음으로
            </button>
          </div>
          <div className={`ab-try-out ${res ? (res.ok ? 'is-ok' : 'is-bad') : ''}`} ref={outRef} aria-live="polite">
            <div className="ab-out-label">출력</div>
            <pre className="ab-out-text">{res ? res.text : '실행 버튼을 눌러 보세요'}</pre>
          </div>
          <div className="ab-try-talk">
            {res && !res.ok ? <BugBug style="AB" mood="found" size={72} motion="appear-bob" /> : <PybaemStatic style="AB" state={res?.ok ? 'cheer' : 'talk'} size={72} idPrefix="trypy" />}
            <Bubble side="left">{res ? res.talk : '여기에 결과가 나오면 내가 말해 줄게!'}</Bubble>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────── 월드 3장 미리보기

const WORLD_CARDS = [
  { n: 1, title: WORLD1.title, sub: '초록 섬', desc: WORLD1.description, tone: 'w1' as const, locked: false },
  { n: 2, title: '코드 바다', sub: '바다·하늘 섬', desc: '배운 것을 섞어서 더 큰 문제를 풀어요. 종이 구름 위 섬을 열기구로 건너요.', tone: 'w2' as const, locked: true },
  { n: 3, title: '메이커 시티', sub: '공방 섬', desc: '나만의 게임과 그림을 만들어요. 톱니가 돌아가는 노을빛 공방 섬.', tone: 'w3' as const, locked: true },
];

function WorldsSection() {
  return (
    <section className="ab-section ab-worlds" id="ab-worlds" aria-labelledby="ab-worlds-title">
      <div className="ab-section-inner">
        <Ribbon tone="orange">한 장씩 넘기는 모험</Ribbon>
        <h2 id="ab-worlds-title" className="ab-display ab-h2">
          섬을 다 열면 다음 장이 펼쳐져요
        </h2>
        <div className="ab-world-cards">
          {WORLD_CARDS.map((w, i) => (
            <article key={w.n} className={`ab-world-card ab-tone-${w.tone}`}>
              <div className="ab-world-card-art">
                <WorldArt world={i as 0 | 1 | 2} locked={w.locked} />
                <span className="ab-chapter">{w.n}장</span>
                {w.locked && (
                  <span className="ab-world-lock">
                    <Icon name="lock" size={20} strokeWidth={2.6} /> 곧 열려요
                  </span>
                )}
              </div>
              <div className="ab-world-card-body">
                <p className="ab-world-sub">{w.sub}</p>
                <h3 className="ab-display ab-h3">{w.title}</h3>
                <p>{w.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────── 캐릭터 3인

function FriendsSection() {
  return (
    <section className="ab-section ab-friends" aria-labelledby="ab-friends-title">
      <div className="ab-section-inner">
        <Ribbon>모험 친구들</Ribbon>
        <h2 id="ab-friends-title" className="ab-display ab-h2">
          세 친구가 함께해요
        </h2>
        <div className="ab-friend-cards">
          <article className="ab-friend">
            <div className="ab-friend-art ab-tone-w1">
              <PybaemRig style="AB" state="talk" size={150} />
            </div>
            <span className="ab-nametag">파이뱀</span>
            <p className="ab-friend-role">선생님</p>
            <p>막히면 정답 대신 힌트를 한 단계씩 줘요. 맞히면 같이 춤춰요.</p>
          </article>
          <article className="ab-friend">
            <div className="ab-friend-art ab-tone-err">
              <span className="ab-paper-hole" aria-hidden />
              <BugBug style="AB" mood="searching" size={130} motion="bob" />
            </div>
            <span className="ab-nametag ab-nametag-red">버그버그</span>
            <p className="ab-friend-role">말썽쟁이 친구</p>
            <p>코드가 틀리면 종이를 뚫고 나와서 어디가 이상한지 쉬운 말로 알려 줘요.</p>
          </article>
          <article className="ab-friend">
            <div className="ab-friend-art ab-tone-w2">
              <Byeolttongi style="AB" mood="sparkling" size={130} motion="bob" />
            </div>
            <span className="ab-nametag ab-nametag-lemon">별똥이</span>
            <p className="ab-friend-role">보상 요정</p>
            <p>퀘스트를 깨면 별과 코인을 스티커처럼 착 붙여 줘요.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

// ───────────── 학부모 안내 (X5)

const PARENT_POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'user', title: '닉네임만 보여요', body: '실명·사진은 다른 친구에게 보이지 않아요. 공개 정보는 닉네임과 캐릭터뿐이고, 자유 댓글 대신 정해진 스티커로만 반응해요.' },
  { icon: 'book', title: '차근차근 커리큘럼', body: `1월드 ${STAGES.length}개 스테이지 ${questCount}개 퀘스트로 print()부터 함수까지 배우고, 2월드 응용과 3월드 만들기로 이어져요.` },
  { icon: 'hint', title: 'AI는 정답 대신 힌트', body: 'AI 튜터는 답을 바로 알려 주지 않고 생각할 거리를 단계별로 줘요. 막힌 곳을 같이 찾아 주는 선생님 역할만 해요.' },
  { icon: 'pause', title: '건강한 재미', body: '결제와 뽑기가 없어요. 오래 하면 파이뱀이 잠깐 쉬었다 하자고 알려 줘요.' },
];

function ParentsSection() {
  return (
    <section className="ab-section ab-parents" id="ab-parents" aria-labelledby="ab-parents-title">
      <div className="ab-section-inner">
        <div className="ab-parents-head">
          <Ribbon tone="blue">학부모님께</Ribbon>
          <h2 id="ab-parents-title" className="ab-display ab-h2">
            안심하고 맡길 수 있게 만들었어요
          </h2>
        </div>
        <div className="ab-parent-grid">
          {PARENT_POINTS.map((p) => (
            <article key={p.title} className="ab-parent-card">
              <span className="ab-parent-icon">
                <Icon name={p.icon} size={28} strokeWidth={2.4} />
              </span>
              <h3 className="ab-parent-title">{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
