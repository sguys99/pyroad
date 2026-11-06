// 랜딩 (#landing): 히어로(살아 있는 파이뱀 + 보물지도) · 소셜 로그인 자리 · 30초 체험(X4) · 그림책 3권 · 캐릭터 · 보호자 안내(X5) · 푸터
import { useRef, useState } from 'react';
import { goScreen } from '../shared/app';
import { Icon, RewardIcon, type IconName } from '../shared/icons';
import { PybaemRig, PybaemStatic } from '../shared/rig/PybaemRig';
import { BugBug, Byeolttongi } from '../shared/characters/Friends';
import { STAGES, WORLD1 } from '../shared/content';
import { BOOKS } from './data';
import { CoverArt, HeroMap } from './art';
import { Bubble, InkButton, LogoMark } from './ui';
import { toast } from './state';
import { celebrate, inkReveal, stampSlam } from './fx';

const QUEST_COUNT = WORLD1.stages.reduce((a, s) => a + s.quests.length, 0);

export function Landing() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <>
      <header className="b-topnav">
        <div className="b-topnav-in">
          <a className="b-logo" href="#landing" aria-label="pyRoad 처음 화면">
            <LogoMark />
            <span className="b-logo-t">pyRoad</span>
          </a>
          <nav className="b-topnav-links" aria-label="랜딩 바로가기">
            <button type="button" onClick={() => scrollTo('b-try')}>
              30초 체험
            </button>
            <button type="button" onClick={() => scrollTo('b-books')}>
              그림책 3권
            </button>
            <button type="button" onClick={() => scrollTo('b-parents')}>
              보호자 안내
            </button>
          </nav>
          <InkButton variant="paper" size="sm" onClick={() => scrollTo('b-login')}>
            로그인
          </InkButton>
        </div>
      </header>
      <main className="b-landing">
        <Hero onTry={() => scrollTo('b-try')} />
        <Trial />
        <Books />
        <Friends />
        <Parents />
      </main>
      <Footer />
    </>
  );
}

// ───────────── 히어로

function Hero({ onTry }: { onTry: () => void }) {
  return (
    <section className="b-hero" aria-labelledby="b-hero-t">
      <div className="b-hero-copy">
        <span className="b-ribbon">
          <Icon name="map" size={20} strokeWidth={2.4} />
          1권 · 숲 마을 모험 지도
        </span>
        <h1 id="b-hero-t" className="b-hero-t">
          코드 주문으로
          <br />
          <span className="b-ink-mark">모험 지도</span>를 채워라!
        </h1>
        <p className="b-hero-sub">
          파이뱀 선생님과 퀘스트를 깨면 지도에 잉크 길이 그려지고, 통과 도장이 쾅! 찍혀요. 한 권을 다 읽으면 다음 모험이 열려요.
        </p>
        <div className="b-hero-cta">
          <InkButton variant="primary" size="lg" iconRight="arrowRight" onClick={() => goScreen('world')}>
            모험 시작!
          </InkButton>
          <InkButton variant="paper" size="lg" icon="code" onClick={onTry}>
            30초 체험
          </InkButton>
        </div>
      </div>
      <div className="b-hero-stage">
        <div className="b-hero-paper">
          <HeroMap />
        </div>
        <div className="b-hero-py">
          <PybaemRig style="B" state="idle" size={250} />
        </div>
        <div className="b-hero-bubble">
          <Bubble text="안녕, 모험가! 나는 파이뱀. 이 지도의 빈 곳을 같이 채워 볼래?" />
        </div>
        <div className="b-hero-bug" aria-hidden>
          <BugBug style="B" mood="searching" size={84} motion="bob" label="" />
        </div>
        <div className="b-hero-star" aria-hidden>
          <Byeolttongi style="B" mood="sparkling" size={70} motion="bob" label="" />
        </div>
      </div>
      <div className="b-login" id="b-login">
        <span className="b-login-k">이미 모험가라면</span>
        <div className="b-login-row">
          <button type="button" className="b-social b-social-google" onClick={() => toast('Google 로그인은 진짜 앱에서 열려요')}>
            <span className="b-social-mark" aria-hidden>
              G
            </span>
            Google로 계속하기
          </button>
          <button type="button" className="b-social b-social-kakao" onClick={() => toast('카카오 로그인은 진짜 앱에서 열려요')}>
            <span className="b-social-mark" aria-hidden>
              K
            </span>
            카카오로 계속하기
          </button>
          <button type="button" className="b-social b-social-naver" onClick={() => toast('네이버 로그인은 진짜 앱에서 열려요')}>
            <span className="b-social-mark" aria-hidden>
              N
            </span>
            네이버로 계속하기
          </button>
        </div>
      </div>
      <ul className="b-hero-facts" aria-label="pyRoad 한눈에">
        <li>
          <b className="b-num">{QUEST_COUNT}</b>개 퀘스트
        </li>
        <li>
          <b className="b-num">{STAGES.length}</b>곳의 스테이지
        </li>
        <li>
          <b className="b-num">3</b>권의 그림책
        </li>
        <li>
          결제·뽑기 <b>없음</b>
        </li>
      </ul>
    </section>
  );
}

// ───────────── 30초 체험 (X4): print("…") 한 줄 고쳐서 돌려 보기

function parsePrint(src: string): { ok: true; out: string } | { ok: false; why: string } {
  const s = src.trim();
  if (!s) return { ok: false, why: '공책이 비어 있어요. print("안녕, 파이뱀!")을 써 볼까요?' };
  if (!/^print/.test(s)) return { ok: false, why: '주문은 print 로 시작해요. 맨 앞에 print 를 써 주세요.' };
  const m = /^print\s*\(\s*(["'])(.*)\1\s*\)$/.exec(s);
  if (m) return { ok: true, out: m[2] };
  if (/^print\s*\(\s*["'][^"']*$/.test(s) || /^print\s*\(\s*["'][^"']*\)$/.test(s)) return { ok: false, why: '따옴표를 열었으면 닫아 주세요. 글자 앞뒤에 " 가 하나씩 있어야 해요.' };
  if (!/\)$/.test(s)) return { ok: false, why: '닫는 괄호 ) 가 빠졌어요. 주문 맨 끝에 ) 를 붙여 주세요.' };
  if (/^print\s*\(\s*[^"']/.test(s)) return { ok: false, why: '글자는 따옴표 " " 안에 넣어야 해요. 예: print("안녕")' };
  return { ok: false, why: '주문이 조금 이상해요. print("하고 싶은 말") 모양으로 써 볼까요?' };
}

function Trial() {
  const [code, setCode] = useState('print("안녕, 파이뱀!")');
  const [res, setRes] = useState<null | { ok: true; out: string } | { ok: false; why: string }>(null);
  const [runs, setRuns] = useState(0);
  const outRef = useRef<HTMLDivElement | null>(null);
  const stampRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const run = () => {
    const r = parsePrint(code);
    setRes(r);
    setRuns((n) => n + 1);
    requestAnimationFrame(() => {
      inkReveal(outRef.current, '12% 50%', 700);
      if (r.ok) stampSlam(stampRef.current, { paper: cardRef.current, rot: -10 });
      else celebrate('fail', { paper: cardRef.current });
    });
  };
  const state = res === null ? 'idle' : res.ok ? 'happy' : 'sad';
  return (
    <section className="b-sec b-try" id="b-try" aria-labelledby="b-try-t">
      <div className="b-sec-head">
        <span className="b-kicker">로그인 없이 30초</span>
        <h2 id="b-try-t" className="b-h2">
          첫 주문을 걸어 봐요
        </h2>
        <p className="b-muted">따옴표 안의 글자를 마음대로 바꾸고 “주문 걸기”를 눌러 보세요. 파이뱀이 그대로 말해 줘요.</p>
      </div>
      <div className="b-try-grid">
        <div className="b-try-card b-notebook-card" ref={cardRef}>
          <div className="b-try-label">
            <Icon name="code" size={20} strokeWidth={2.4} /> 나의 첫 공책
          </div>
          <label className="sr-only" htmlFor="b-try-input">
            파이썬 한 줄
          </label>
          <div className="b-try-line">
            <span className="b-try-no" aria-hidden>
              1
            </span>
            <input
              id="b-try-input"
              className="b-try-input"
              value={code}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') run();
              }}
            />
          </div>
          <div className="b-try-actions">
            <InkButton variant="primary" icon="play" onClick={run}>
              주문 걸기
            </InkButton>
            <button type="button" className="b-textbtn" onClick={() => setCode('print("안녕, 파이뱀!)')}>
              틀린 주문 넣어 보기
            </button>
          </div>
          <div className={`b-try-out ${res && !res.ok ? 'is-err' : ''}`} ref={outRef} aria-live="polite">
            <span className="b-try-out-k">결과</span>
            {res === null && <span className="b-muted">아직 주문을 걸지 않았어요</span>}
            {res?.ok && <span className="b-try-out-v">{res.out || ' '}</span>}
            {res && !res.ok && <span className="b-try-out-e">{res.why}</span>}
          </div>
          <div className="b-try-stamp b-stamp" ref={stampRef} hidden={!res?.ok} aria-hidden={!res?.ok}>
            <span>첫 주문!</span>
          </div>
        </div>
        <div className="b-try-side">
          {res && !res.ok ? (
            <div className="b-try-bug">
              <BugBug style="B" mood="found" size={110} motion="appear-bob" label="버그버그" />
              <Bubble key={`e${runs}`} who="버그버그" tone="bug" text={`히히, 버그 찾았다! ${res.why}`} />
            </div>
          ) : (
            <div className="b-try-py">
              <PybaemStatic style="B" state={state === 'happy' ? 'happy' : 'idle'} size={140} framing="avatar" idPrefix="trypy" />
              <Bubble
                key={`p${runs}`}
                tone={res?.ok ? 'good' : 'tutor'}
                text={res?.ok ? `“${res.out}” 잘 들렸어요! 방금 진짜 파이썬 주문을 쓴 거예요. 지도에서 다음 퀘스트가 기다려요.` : '공책의 따옴표 안 글자를 바꿔 봐요. 내 이름을 넣어도 좋아요!'}
              />
              {res?.ok && (
                <InkButton variant="primary" iconRight="arrowRight" onClick={() => goScreen('world')}>
                  이어서 모험하기
                </InkButton>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ───────────── 그림책 3권 (월드별 비주얼 변화)

function Books() {
  return (
    <section className="b-sec" id="b-books" aria-labelledby="b-books-t">
      <div className="b-sec-head">
        <span className="b-kicker">한 권씩 열리는 모험</span>
        <h2 id="b-books-t" className="b-h2">
          책장에 꽂힌 세 권의 그림책
        </h2>
        <p className="b-muted">권마다 그림과 색이 바뀌어요. 숲 마을을 다 채우면 바다로, 바다를 건너면 발명가의 공방으로!</p>
      </div>
      <ul className="b-shelf">
        {BOOKS.map((b) => (
          <li key={b.no} className={`b-book b-book-${b.no} ${b.state === 'locked' ? 'is-locked' : ''}`}>
            <div className="b-book-cover">
              <span className="b-book-band">{b.no}권</span>
              <CoverArt book={b.no as 1 | 2 | 3} />
              <b className="b-book-t">{b.title}</b>
              <span className="b-book-sub">{b.sub}</span>
              {b.state === 'locked' && (
                <span className="b-book-clasp" aria-hidden>
                  <Icon name="lock" size={22} strokeWidth={2.6} />
                </span>
              )}
            </div>
            <p className="b-book-note">
              {b.state === 'open' ? (
                <>
                  <b className="b-good">지금 펼칠 수 있어요</b> · 스테이지 {STAGES.length}곳, 퀘스트 {QUEST_COUNT}개
                </>
              ) : (
                <>
                  <Icon name="lock" size={16} strokeWidth={2.4} /> {b.no - 1}권을 다 읽으면 열려요
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ───────────── 캐릭터 3인

function Friends() {
  return (
    <section className="b-sec" aria-labelledby="b-friends-t">
      <div className="b-sec-head">
        <span className="b-kicker">함께 모험할 친구들</span>
        <h2 id="b-friends-t" className="b-h2">
          책 속에서 만나는 세 친구
        </h2>
      </div>
      <ul className="b-friends">
        <li className="b-friend">
          <div className="b-friend-art b-friend-py">
            <PybaemStatic style="B" state="happy" size={150} framing="avatar" idPrefix="frpy" />
          </div>
          <b className="b-friend-name">파이뱀</b>
          <span className="b-friend-role">선생님</span>
          <p>정답을 바로 말해 주지 않고, 스스로 찾을 수 있게 한 걸음씩 힌트를 줘요.</p>
        </li>
        <li className="b-friend">
          <div className="b-friend-art b-friend-bug">
            <BugBug style="B" mood="searching" size={130} motion="bob" label="" />
          </div>
          <b className="b-friend-name">버그버그</b>
          <span className="b-friend-role">말썽쟁이 친구</span>
          <p>코드에 틀린 곳이 있으면 책 귀퉁이에 나타나 어디가 이상한지 쉬운 말로 알려 줘요.</p>
        </li>
        <li className="b-friend">
          <div className="b-friend-art b-friend-star">
            <Byeolttongi style="B" mood="sparkling" size={130} motion="bob" label="" />
          </div>
          <b className="b-friend-name">별똥이</b>
          <span className="b-friend-role">보상 요정</span>
          <p>퀘스트를 통과하면 별과 코인을 들고 페이지 사이로 반짝 날아와요.</p>
        </li>
      </ul>
    </section>
  );
}

// ───────────── 보호자 안내 (X5)

const PARENT: { icon: IconName; t: string; items: string[] }[] = [
  {
    icon: 'user',
    t: '안전',
    items: ['실명 대신 닉네임과 캐릭터만 보여요', '자유 댓글 없이 정해진 스티커로만 반응해요', '만 14세 미만은 보호자 동의 후 시작해요'],
  },
  {
    icon: 'book',
    t: '커리큘럼',
    items: [`1권 기초: print부터 함수까지 ${QUEST_COUNT}개 퀘스트`, '2권 응용 → 3권 나만의 게임·그림 만들기', '매주 성장 카드로 배운 것을 알려 드려요'],
  },
  {
    icon: 'chat',
    t: 'AI 원칙',
    items: ['파이뱀은 답 대신 생각할 거리를 줘요', '결제·뽑기·광고가 없어요', '20분마다 쉬어 가기 알림이 떠요'],
  },
];

function Parents() {
  return (
    <section className="b-sec b-parents" id="b-parents" aria-labelledby="b-parents-t">
      <div className="b-letter">
        <span className="b-letter-seal" aria-hidden>
          <Icon name="check" size={30} strokeWidth={3} />
        </span>
        <span className="b-kicker">보호자께 드리는 편지</span>
        <h2 id="b-parents-t" className="b-h2">
          아이가 안심하고 오래 즐기도록 만들었어요
        </h2>
        <div className="b-letter-cols">
          {PARENT.map((p) => (
            <div key={p.t} className="b-letter-col">
              <span className="b-letter-ic">
                <Icon name={p.icon} size={26} strokeWidth={2.4} />
              </span>
              <h3 className="b-h3">{p.t}</h3>
              <ul>
                {p.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="b-letter-sign">— pyRoad 만드는 사람들 드림</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="b-footer">
      <div className="b-footer-in">
        <a className="b-logo" href="#landing" aria-label="pyRoad 처음 화면">
          <LogoMark size={30} />
          <span className="b-logo-t">pyRoad</span>
        </a>
        <nav className="b-footer-links" aria-label="바닥 글">
          <a href="#landing">이용약관</a>
          <a href="#landing">개인정보처리방침</a>
          <a href="#landing">공지사항</a>
          <a href="#landing">문의하기</a>
        </nav>
        <p className="b-footer-note">
          <RewardIcon kind="star" style="B" size={18} /> 초등학생을 위한 파이썬 모험 · 시안 B 마법 그림책 (프로토타입)
        </p>
      </div>
    </footer>
  );
}
