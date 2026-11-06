// 랜딩 (#landing): 히어로(살아 있는 파이뱀 + 보물지도) · 소셜 로그인 자리 · 30초 체험(X4) · 그림책 3권 · 캐릭터 · 보호자 안내(X5) · 푸터
import { useRef, useState } from 'react';
import { goScreen } from '../shared/app';
import { Icon, RewardIcon, type IconName } from '../shared/icons';
import { PybaemRig, PybaemStatic } from './rig';
import { BugBug, Byeolttongi } from './rig';
import { STAGES, WORLD1 } from '../shared/content';
import { BOOKS } from './data';
import { CoverArt, HeroArt } from './art';
import { Bubble, InkButton, LogoMark } from './ui';
import { toast } from './state';
import { celebrate, inkReveal, stampSlam } from './fx';

const QUEST_COUNT = WORLD1.stages.reduce((a, s) => a + s.quests.length, 0);

export function Landing() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <>
      <header className="f-topnav">
        <div className="f-topnav-in">
          <a className="f-logo" href="#landing" aria-label="pyRoad 처음 화면">
            <LogoMark />
            <span className="f-logo-t">pyRoad</span>
          </a>
          <nav className="f-topnav-links" aria-label="랜딩 바로가기">
            <button type="button" onClick={() => scrollTo('f-try')}>
              30초 체험
            </button>
            <button type="button" onClick={() => scrollTo('f-parents')}>
              보호자 안내
            </button>
          </nav>
          <InkButton variant="paper" size="sm" onClick={() => scrollTo('f-login')}>
            로그인
          </InkButton>
        </div>
      </header>
      <main className="f-landing">
        <Hero onTry={() => scrollTo('f-try')} />
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
    <section className="f-hero" aria-labelledby="f-hero-t">
      <div className="f-hero-copy">
        <span className="f-kicker">그림책 1권 · 숲 마을</span>
        <h1 id="f-hero-t" className="f-hero-t">
          코드 주문으로
          <br />
          <span className="f-ink-mark">모험 지도</span>를 채워라!
        </h1>
        <p className="f-hero-sub">
          파이뱀 선생님과 퀘스트를 깨면 지도에 잉크 길이 그려지고, 통과 도장이 쾅! 찍혀요. 한 권을 다 읽으면 다음 모험이 열려요.
        </p>
        <div className="f-hero-cta">
          <InkButton variant="primary" size="lg" iconRight="arrowRight" onClick={() => goScreen('world')}>
            모험 시작!
          </InkButton>
          <InkButton variant="paper" size="lg" icon="code" onClick={onTry}>
            30초 체험
          </InkButton>
        </div>
      </div>
      <div className="f-hero-stage">
        <HeroArt />
        <div className="f-hero-py">
          <PybaemRig style="B" state="idle" size={230} />
        </div>
        <div className="f-hero-bubble">
          <Bubble text="안녕, 모험가! 나는 파이뱀. 이 지도의 빈 곳을 같이 채워 볼래?" />
        </div>
      </div>
      <div className="f-login" id="f-login">
        <span className="f-login-k">이미 모험가라면</span>
        <div className="f-login-row">
          <button type="button" className="f-social f-social-google" onClick={() => toast('Google 로그인은 진짜 앱에서 열려요')}>
            <span className="f-social-mark" aria-hidden>
              G
            </span>
            Google로 계속하기
          </button>
          <button type="button" className="f-social f-social-kakao" onClick={() => toast('카카오 로그인은 진짜 앱에서 열려요')}>
            <span className="f-social-mark" aria-hidden>
              K
            </span>
            카카오로 계속하기
          </button>
          <button type="button" className="f-social f-social-naver" onClick={() => toast('네이버 로그인은 진짜 앱에서 열려요')}>
            <span className="f-social-mark" aria-hidden>
              N
            </span>
            네이버로 계속하기
          </button>
        </div>
      </div>
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
    <section className="f-sec f-try" id="f-try" aria-labelledby="f-try-t">
      <div className="f-sec-head">
        <span className="f-kicker">로그인 없이 30초</span>
        <h2 id="f-try-t" className="f-h2">
          첫 주문을 걸어 봐요
        </h2>
        <p className="f-muted">따옴표 안의 글자를 마음대로 바꾸고 “주문 걸기”를 눌러 보세요. 파이뱀이 그대로 말해 줘요.</p>
      </div>
      <div className="f-try-grid">
        <div className="f-try-card f-notebook-card" ref={cardRef}>
          <div className="f-try-label">
            <Icon name="code" size={20} strokeWidth={2.4} /> 나의 첫 공책
          </div>
          <label className="sr-only" htmlFor="f-try-input">
            파이썬 한 줄
          </label>
          <div className="f-try-line">
            <span className="f-try-no" aria-hidden>
              1
            </span>
            <input
              id="f-try-input"
              className="f-try-input"
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
          <div className="f-try-actions">
            <InkButton variant="primary" icon="play" onClick={run}>
              주문 걸기
            </InkButton>
            <button type="button" className="f-textbtn" onClick={() => setCode('print("안녕, 파이뱀!)')}>
              틀린 주문 넣어 보기
            </button>
          </div>
          <div className={`f-try-out ${res && !res.ok ? 'is-err' : ''}`} ref={outRef} aria-live="polite">
            <span className="f-try-out-k">결과</span>
            {res === null && <span className="f-muted">아직 주문을 걸지 않았어요</span>}
            {res?.ok && <span className="f-try-out-v">{res.out || ' '}</span>}
            {res && !res.ok && <span className="f-try-out-e">{res.why}</span>}
          </div>
          <div className="f-try-stamp f-stamp" ref={stampRef} hidden={!res?.ok} aria-hidden={!res?.ok}>
            <span>첫 주문!</span>
          </div>
        </div>
        <div className="f-try-side">
          {res && !res.ok ? (
            <div className="f-try-bug">
              <BugBug style="B" mood="found" size={110} motion="appear-bob" label="버그버그" />
              <Bubble key={`e${runs}`} who="버그버그" tone="bug" text={`히히, 버그 찾았다! ${res.why}`} />
            </div>
          ) : (
            <div className="f-try-py">
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
    <section className="f-sec" id="f-books" aria-labelledby="f-books-t">
      <div className="f-sec-head">
        <span className="f-kicker">한 권씩 열리는 모험</span>
        <h2 id="f-books-t" className="f-h2">
          책장에 꽂힌 세 권의 그림책
        </h2>
        <p className="f-muted">권마다 그림과 색이 바뀌어요. 숲 마을을 다 채우면 바다로, 바다를 건너면 발명가의 공방으로!</p>
      </div>
      <ul className="f-shelf">
        {BOOKS.map((b) => (
          <li key={b.no} className={`f-book f-book-${b.no} ${b.state === 'locked' ? 'is-locked' : ''}`}>
            <div className="f-book-cover">
              <span className="f-book-band">{b.no}권</span>
              <CoverArt book={b.no as 1 | 2 | 3} />
              <b className="f-book-t">{b.title}</b>
              <span className="f-book-sub">{b.sub}</span>
              {b.state === 'locked' && (
                <span className="f-book-clasp" aria-hidden>
                  <Icon name="lock" size={22} strokeWidth={2.6} />
                </span>
              )}
            </div>
            <p className="f-book-note">
              {b.state === 'open' ? (
                <>
                  <b className="f-good">지금 펼칠 수 있어요</b> · 스테이지 {STAGES.length}곳, 퀘스트 {QUEST_COUNT}개
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
  // 최종 시안: 카드 3장 대신 한 줄 소개 (덜어낸 것: 카드 테두리·원형 배경·긴 설명)
  return (
    <section className="f-sec f-friends-sec" aria-labelledby="f-friends-t">
      <h2 id="f-friends-t" className="f-h3">
        함께 모험할 세 친구
      </h2>
      <ul className="f-friends">
        <li className="f-friend">
          <PybaemStatic style="B" state="happy" size={72} framing="avatar" idPrefix="frpy" />
          <span>
            <b className="f-friend-name">파이뱀</b>
            <span className="f-friend-role">답 대신 힌트를 주는 선생님</span>
          </span>
        </li>
        <li className="f-friend">
          <BugBug style="B" mood="searching" size={72} label="" />
          <span>
            <b className="f-friend-name">버그버그</b>
            <span className="f-friend-role">틀린 곳을 알려 주는 말썽쟁이</span>
          </span>
        </li>
        <li className="f-friend">
          <Byeolttongi style="B" mood="sparkling" size={72} label="" />
          <span>
            <b className="f-friend-name">별똥이</b>
            <span className="f-friend-role">별과 코인을 가져오는 요정</span>
          </span>
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
    <section className="f-sec f-parents" id="f-parents" aria-labelledby="f-parents-t">
      <div className="f-letter">
        <span className="f-kicker">보호자께</span>
        <h2 id="f-parents-t" className="f-h2">
          아이가 안심하고 오래 즐기도록 만들었어요
        </h2>
        <div className="f-letter-cols">
          {PARENT.map((p) => (
            <div key={p.t} className="f-letter-col">
              <span className="f-letter-ic">
                <Icon name={p.icon} size={26} strokeWidth={2.4} />
              </span>
              <h3 className="f-h3">{p.t}</h3>
              <ul>
                {p.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="f-footer">
      <div className="f-footer-in">
        <a className="f-logo" href="#landing" aria-label="pyRoad 처음 화면">
          <LogoMark size={30} />
          <span className="f-logo-t">pyRoad</span>
        </a>
        <nav className="f-footer-links" aria-label="바닥 글">
          <a href="#landing">이용약관</a>
          <a href="#landing">개인정보처리방침</a>
          <a href="#landing">공지사항</a>
          <a href="#landing">문의하기</a>
        </nav>
        <p className="f-footer-note">
          <RewardIcon kind="star" style="B" size={18} /> 초등학생을 위한 파이썬 모험 · 시안 B 마법 그림책 (프로토타입)
        </p>
      </div>
    </footer>
  );
}
