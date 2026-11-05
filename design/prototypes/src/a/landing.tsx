// 랜딩 (#landing): 히어로(살아 있는 파이뱀 + 클레이 섬) · 30초 체험(X4) · 월드 3개 · 친구 3인 · 학부모 안내(X5) · 푸터
import { useRef, useState } from 'react';
import { STAGES } from '../shared/content';
import { goScreen, getScroller } from '../shared/app';
import { Icon, RewardIcon, type IconName } from '../shared/icons';
import { PybaemRig, type PybaemRigHandle } from '../shared/rig/PybaemRig';
import { BugBug, Byeolttongi } from '../shared/characters/Friends';
import { celebrate } from './celebrate';
import { CloudShape } from './clay';
import { runPython, tokenize } from './pyfake';
import { Island, Landmark, Palm, WorldScene } from './scenes';
import { ClayButton, Logo, toast } from './ui';

const QUEST_COUNT = STAGES.reduce((a, s) => a + s.quests.length, 0);

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const sc = getScroller();
  const top = el.getBoundingClientRect().top + (sc instanceof Window ? window.scrollY : (sc as HTMLElement).scrollTop - (sc as HTMLElement).getBoundingClientRect().top) - 12;
  sc.scrollTo({ top, behavior: document.documentElement.dataset.reduced === 'true' ? 'auto' : 'smooth' });
}

export function Landing() {
  return (
    <div className="a-screen a-landing">
      <header className="a-top">
        <div className="a-wrap a-top-row">
          <Logo />
          <nav className="a-top-nav" aria-label="랜딩 바로가기">
            <button type="button" onClick={() => scrollToId('a-try')}>
              체험하기
            </button>
            <button type="button" onClick={() => scrollToId('a-worlds')}>
              월드
            </button>
            <button type="button" onClick={() => scrollToId('a-parents')}>
              학부모님께
            </button>
          </nav>
          <ClayButton variant="white" size="sm" icon="user" onClick={() => scrollToId('a-login')}>
            로그인
          </ClayButton>
        </div>
      </header>
      <main>
        <Hero />
        <TryIt />
        <Worlds />
        <Friends />
        <Parents />
        <FinalCta />
      </main>
      <footer className="a-foot">
        <div className="a-wrap a-foot-row">
          <Logo small />
          <nav aria-label="바닥글">
            <a href="#landing" onClick={(e) => e.preventDefault()}>
              이용약관
            </a>
            <a href="#landing" onClick={(e) => e.preventDefault()}>
              개인정보처리방침
            </a>
            <a href="#landing" onClick={(e) => e.preventDefault()}>
              공지사항
            </a>
          </nav>
          <p>© 2026 pyRoad · 초등학생을 위한 파이썬 모험 · 디자인 시안 A</p>
        </div>
      </footer>
    </div>
  );
}

// ───────────── 히어로

function Hero() {
  const rig = useRef<PybaemRigHandle | null>(null);
  return (
    <section className="a-hero" aria-labelledby="a-hero-title">
      <div className="a-hero-sky" aria-hidden>
        <span className="a-sun" />
        <CloudShape className="a-hcloud a-hcloud-1 m-ambient" w={170} />
        <CloudShape className="a-hcloud a-hcloud-2 m-ambient" w={110} />
        <CloudShape className="a-hcloud a-hcloud-3 m-ambient" w={140} />
      </div>
      <div className="a-wrap a-hero-grid">
        <div className="a-hero-head">
          <p className="a-eyebrow">
            <RewardIcon kind="star" size={20} style="A" />
            초등학생을 위한 파이썬 모험
          </p>
          <h1 id="a-hero-title" className="a-hero-title">
            파이뱀이랑 섬을 건너며
            <br />
            <span className="a-hl">파이썬</span>을 배워요!
          </h1>
        </div>
        <div className="a-hero-art">
          <svg className="a-hero-island" viewBox="0 0 520 300" aria-hidden>
            <ellipse cx="260" cy="232" rx="250" ry="58" fill="#8FDCFF" opacity="0.7" />
            <Island x={260} y={206} rx={200} ry={48} seed={8}>
              <Palm x={110} y={196} s={1.6} />
              <Palm x={410} y={190} s={1.3} flip />
              <Landmark kind="forest" x={360} y={198} s={0.9} />
            </Island>
            <Island x={58} y={262} rx={38} ry={12} seed={2} sandOnly />
          </svg>
          <div className="a-hero-rig" onClick={() => rig.current?.poke()}>
            <PybaemRig ref={rig} state="happy" size={250} />
          </div>
          <div className="a-hero-bubble">
            안녕! 나는 <b>파이뱀</b>이야.
            <br />
            같이 섬을 건너 볼래?
          </div>
          <span className="a-float a-float-1 m-loop" aria-hidden>
            <RewardIcon kind="coin" size={44} style="A" />
          </span>
          <span className="a-float a-float-2 m-loop" aria-hidden>
            <RewardIcon kind="star" size={40} style="A" />
          </span>
          <span className="a-float a-float-3 m-loop" aria-hidden>
            <RewardIcon kind="gem" size={34} style="A" />
          </span>
          <span className="a-hero-bug" aria-hidden>
            <BugBug style="A" mood="searching" size={84} motion="bob" label="" />
          </span>
          <span className="a-hero-star" aria-hidden>
            <Byeolttongi style="A" mood="flying" size={78} motion="bob" label="" />
          </span>
        </div>
        <div className="a-hero-body">
          <p className="a-hero-sub">퀘스트를 깰 때마다 다리가 놓이고 새 섬이 열려요. 틀려도 괜찮아요, 버그버그랑 같이 고치면 돼요.</p>
          <div className="a-hero-cta">
            <ClayButton variant="primary" size="lg" icon="play" onClick={() => goScreen('world')}>
              모험 시작!
            </ClayButton>
            <ClayButton variant="white" size="lg" icon="code" onClick={() => scrollToId('a-try')}>
              30초 체험
            </ClayButton>
          </div>
          <div className="a-social" id="a-login">
            <p className="a-social-label">이미 친구라면 로그인</p>
            <div className="a-social-row">
              {(
                [
                  ['google', 'Google로 계속하기'],
                  ['kakao', '카카오로 계속하기'],
                  ['naver', '네이버로 계속하기'],
                ] as const
              ).map(([k, t]) => (
                <button key={k} type="button" className={`a-sbtn a-sbtn-${k}`} onClick={() => toast('시안이라 로그인은 아직 안 돼요', 'user')}>
                  <span className="a-sbtn-chip" aria-hidden />
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="a-hero-sea" aria-hidden>
        <div className="a-hero-waves m-ambient" />
      </div>
    </section>
  );
}

// ───────────── 30초 체험 (X4): print 한 줄 고쳐 돌려 보기

function TryIt() {
  const [code, setCode] = useState('print("안녕, 파이뱀!")');
  const [out, setOut] = useState<{ text: string; err?: string } | null>(null);
  const [mood, setMood] = useState<'idle' | 'happy' | 'sad'>('idle');
  const outRef = useRef<HTMLDivElement | null>(null);
  const run = () => {
    const r = runPython(code);
    if (r.error) {
      setOut({ text: '', err: r.error.say });
      setMood('sad');
      return;
    }
    setOut({ text: r.out.join('\n') });
    setMood('happy');
    requestAnimationFrame(() => celebrate('try-it', { from: outRef.current }));
  };
  return (
    <section className="a-sec a-try" id="a-try" aria-labelledby="a-try-title">
      <div className="a-wrap">
        <div className="a-sec-head">
          <span className="a-sec-badge">
            <Icon name="sparkle" size={20} strokeWidth={2.6} />
            로그인 없이 30초
          </span>
          <h2 id="a-try-title" className="a-h2">
            지금 바로 첫 코드를 돌려 봐요
          </h2>
          <p className="a-sec-sub">따옴표 안의 글자를 내 이름으로 바꾸고 ‘돌려보기’를 눌러 보세요.</p>
        </div>
        <div className="a-try-card a-card">
          <div className="a-try-editor">
            <div className="a-editor-head">
              <span className="a-editor-file a-editor-file-ko">
                <Icon name="code" size={18} strokeWidth={2.6} />
                첫 코드
              </span>
            </div>
            <div className="a-try-line">
              <span className="a-try-ln" aria-hidden>
                1
              </span>
              <span className="a-try-field">
                <span className="a-try-hl" aria-hidden>
                  {tokenize(code).map((t, i) => (
                    <span key={i} className={`tk-${t.t}`}>
                      {t.s}
                    </span>
                  ))}
                </span>
                <input
                  className="a-try-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && run()}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  aria-label="파이썬 한 줄 코드"
                />
              </span>
            </div>
            <div className="a-try-actions">
              <ClayButton variant="primary" size="md" icon="play" onClick={run}>
                돌려보기
              </ClayButton>
              <button type="button" className="a-linkbtn" onClick={() => setCode('print("안녕, 파이뱀!")')}>
                <Icon name="refresh" size={18} strokeWidth={2.6} />
                처음으로
              </button>
            </div>
            <div ref={outRef} className={`a-try-out${out?.err ? ' is-err' : ''}`} aria-live="polite">
              <span className="a-try-out-label">결과</span>
              {!out && <span className="a-out-empty">여기에 결과가 나와요</span>}
              {out && !out.err && <code>{out.text || ' '}</code>}
              {out?.err && (
                <span className="a-try-err">
                  <BugBug style="A" mood="found" size={52} motion="appear" label="버그버그" />
                  {out.err}
                </span>
              )}
            </div>
          </div>
          <div className="a-try-side">
            <PybaemRig state={mood === 'happy' ? 'cheer' : mood === 'sad' ? 'sad' : 'idle'} size={170} lookAt />
            <p className="a-try-say">{mood === 'happy' ? '우와! 컴퓨터가 네 말을 따라 했어!' : mood === 'sad' ? '괜찮아, 따옴표 짝을 확인해 볼까?' : '내 이름을 불러 줄래?'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────── 월드 3개

function Worlds() {
  const W = [
    { n: 1 as const, name: '파이썬 섬', sub: '야자수 섬에서 print부터 함수까지', meta: `${STAGES.length}스테이지 · ${QUEST_COUNT}퀘스트`, open: true },
    { n: 2 as const, name: '코드 바다', sub: '구름 위 섬과 열기구, 더 큰 문제 풀기', meta: '곧 열려요', open: false },
    { n: 3 as const, name: '메이커 시티', sub: '톱니가 도는 공방 섬에서 게임 만들기', meta: '곧 열려요', open: false },
  ];
  return (
    <section className="a-sec a-worlds" id="a-worlds" aria-labelledby="a-worlds-title">
      <div className="a-wrap">
        <div className="a-sec-head">
          <h2 id="a-worlds-title" className="a-h2">
            섬을 건널수록 세상이 바뀌어요
          </h2>
          <p className="a-sec-sub">월드마다 바다 색도, 건물도, 음악도 달라져요. 진행 자체가 보상이에요.</p>
        </div>
        <div className="a-world-grid">
          {W.map((w) => (
            <article key={w.n} className={`a-card a-world-card a-world-${w.n}`}>
              <div className="a-world-scene">
                <WorldScene world={w.n} />
                {!w.open && (
                  <span className="a-world-lock">
                    <Icon name="lock" size={22} strokeWidth={2.6} />
                  </span>
                )}
              </div>
              <div className="a-world-body">
                <span className={`a-tag a-tag-w${w.n}`}>{w.n}월드</span>
                <h3>{w.name}</h3>
                <p>{w.sub}</p>
                <span className="a-world-meta">{w.meta}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────── 친구 3인

function Friends() {
  return (
    <section className="a-sec a-friends" aria-labelledby="a-friends-title">
      <div className="a-wrap">
        <div className="a-sec-head">
          <h2 id="a-friends-title" className="a-h2">
            같이 모험할 친구들
          </h2>
        </div>
        <div className="a-friend-grid">
          <article className="a-card a-friend a-friend-py">
            <div className="a-friend-art">
              <PybaemRig state="talk" size={150} lookAt={false} seed={4} />
            </div>
            <span className="a-friend-role">선생님</span>
            <h3>파이뱀</h3>
            <p>정답을 바로 알려 주지 않고, 힌트로 스스로 풀게 도와줘요.</p>
          </article>
          <article className="a-card a-friend a-friend-bug">
            <div className="a-friend-art">
              <BugBug style="A" mood="searching" size={130} motion="bob" />
            </div>
            <span className="a-friend-role">말썽쟁이 친구</span>
            <h3>버그버그</h3>
            <p>코드에 문제가 생기면 톡 튀어나와 어디가 틀렸는지 같이 찾아요.</p>
          </article>
          <article className="a-card a-friend a-friend-star">
            <div className="a-friend-art">
              <Byeolttongi style="A" mood="sparkling" size={130} motion="bob" />
            </div>
            <span className="a-friend-role">보상 요정</span>
            <h3>별똥이</h3>
            <p>퀘스트를 깨면 하늘에서 휙 날아와 별과 코인을 건네줘요.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

// ───────────── 학부모 안내 (X5)

function Parents() {
  const items: { icon: IconName; title: string; text: string }[] = [
    { icon: 'user', title: '실명 대신 닉네임', text: '다른 친구에게는 닉네임과 캐릭터만 보여요. 이름·사진·학교는 공개하지 않아요.' },
    { icon: 'close', title: '결제·뽑기 없음', text: '코인은 공부로만 모아요. 돈을 쓰는 결제나 확률형 뽑기는 없어요.' },
    { icon: 'pause', title: '쉬는 시간 알림', text: '20분쯤 공부하면 파이뱀이 잠깐 쉬자고 알려 줘요.' },
    { icon: 'chat', title: 'AI 선생님 원칙', text: '정답을 대신 써 주지 않고 단계별 힌트로 생각을 도와요. 대화는 안전 필터를 거쳐요.' },
  ];
  return (
    <section className="a-sec a-parents" id="a-parents" aria-labelledby="a-parents-title">
      <div className="a-wrap">
        <div className="a-parents-card">
          <div className="a-sec-head a-sec-head-left">
            <span className="a-sec-badge a-sec-badge-blue">
              <Icon name="book" size={20} strokeWidth={2.6} />
              학부모님께
            </span>
            <h2 id="a-parents-title" className="a-h2">
              안심하고 맡길 수 있는 코딩 놀이터
            </h2>
            <p className="a-sec-sub">7~12세 아이가 혼자서도 끝까지 해낼 수 있게, 재미와 안전을 함께 설계했어요.</p>
          </div>
          <ul className="a-parent-grid">
            {items.map((it) => (
              <li key={it.title} className="a-parent-item">
                <span className="a-parent-ic" aria-hidden>
                  <Icon name={it.icon} size={26} strokeWidth={2.6} />
                </span>
                <h3>{it.title}</h3>
                <p>{it.text}</p>
              </li>
            ))}
          </ul>
          <div className="a-curri">
            <h3>
              1월드 커리큘럼 <span>{STAGES.length}스테이지 · {QUEST_COUNT}퀘스트</span>
            </h3>
            <ol className="a-curri-list">
              {STAGES.map((s) => (
                <li key={s.order}>
                  <span className="a-curri-no">{s.order}</span>
                  <span className="a-curri-name">{s.title}</span>
                  <span className="a-curri-desc">{s.description.replace(/을 배워봐요!|를 배워봐요!|해봐요!/, '')}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="a-final" aria-labelledby="a-final-title">
      <div className="a-wrap a-final-row">
        <div>
          <h2 id="a-final-title" className="a-h2">
            첫 섬이 기다리고 있어요
          </h2>
          <p>지금 시작하면 파이썬 마을 입구에서 파이뱀이 마중 나와요.</p>
        </div>
        <ClayButton variant="lemon" size="lg" icon="play" onClick={() => goScreen('world')}>
          모험 시작!
        </ClayButton>
      </div>
    </section>
  );
}
