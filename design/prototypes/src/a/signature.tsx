// 시안 A 시그니처 모션 (P2-05): 퀘스트 성공 · 레벨업 연출 조각과 타임라인.
// 축하 카드·레벨업 오버레이 마크업 + build 함수. 실제 흐름(CelebrationLayer)과 #motion 무대가 같은 코드를 쓴다.
// A 시그니처: 꾹 버튼 · 젤리 스퀴시(jellyA) · 코인 튀어나옴(포물선 + 뒤집기 → HUD), 별똥이 = 보상 안내 요정
import { forwardRef, type ReactNode } from 'react';
import { Icon, RewardIcon } from '../shared/icons';
import { springTiming } from '../shared/motion';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { Byeolttongi } from '../shared/characters/Friends';
import { EASING } from '../shared/tokens';
import { GEM_SVG, Seq, burst, centerIn, coins, confetti } from './seq';
import { ClayButton } from './ui';

type RigS = 'idle' | 'talk' | 'think' | 'happy' | 'sad' | 'cheer' | 'dance';

// ───────────── 축하 카드

export interface ClearProps {
  stars: number;
  xp: number;
  coins: number;
  title?: string;
  rig?: RigS;
  tier?: 'full' | 'lite' | 'minimal';
  reduced?: boolean;
  contained?: boolean;
  /** 레벨업이 위에 덮이면 카드 리그를 멈춤 */
  frozen?: boolean;
  onMap?: () => void;
  onNext?: () => void;
}

export const ClearCard = forwardRef<HTMLDivElement, ClearProps>(function ClearCard(
  { stars, xp, coins: c, title, rig = 'cheer', tier, reduced, contained, frozen, onMap, onNext },
  ref,
) {
  return (
    <div ref={ref} className={`a-cel-wrap${contained ? ' is-contained' : ''}`} role="dialog" aria-modal={contained ? undefined : true} aria-labelledby="a-cel-title">
      <div className="a-scrim a-scrim-strong" data-q="scrim" aria-hidden />
      <div className="a-cel" data-q="card">
        <div className="a-cel-burst m-loop" data-q="rays" aria-hidden />
        <div className="a-cel-rig" data-q="rig">
          <PybaemRig key={frozen ? 'f' : 'l'} static={frozen} state={rig} size={150} lookAt={false} tier={tier} reducedMotion={reduced} />
        </div>
        <span className="a-cut" data-q="cut" aria-hidden>
          짠!
        </span>
        <h2 id="a-cel-title" className="a-cel-title" data-q="title">
          {title ?? '퀘스트 클리어!'}
        </h2>
        <div className="a-cel-stars" role="img" aria-label={`별 3개 중 ${stars}개`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`a-cel-star${i === 1 ? ' is-mid' : ''}`}>
              <span className="a-cel-star-empty">
                <RewardIcon kind="starEmpty" size={i === 1 ? 64 : 52} style="A" />
              </span>
              {i < stars && (
                <span className="a-cel-star-on" data-q="star">
                  <RewardIcon kind="star" size={i === 1 ? 64 : 52} style="A" />
                </span>
              )}
            </span>
          ))}
        </div>
        <div className="a-cel-rewards">
          <span className="a-reward" data-q="xp">
            <RewardIcon kind="gem" size={26} style="A" />
            <b>+{xp}</b> 경험치
          </span>
          <span className="a-reward" data-q="coin">
            <RewardIcon kind="coin" size={26} style="A" />
            <b>+{c}</b> 코인
          </span>
        </div>
        <div className="a-cel-actions" data-q="cta">
          <ClayButton variant="white" size="md" icon="map" onClick={onMap}>
            지도로
          </ClayButton>
          <ClayButton variant="primary" size="md" iconRight="arrowRight" onClick={onNext}>
            다음 퀘스트
          </ClayButton>
        </div>
        <div className="a-cel-fx" data-q="fx" aria-hidden />
      </div>
    </div>
  );
});

export interface HudRefs {
  host: Element; // 좌표 기준 + 날아가는 요소를 붙일 곳
  coin: Element | null;
  coinNum: HTMLElement | null;
  xpBox: Element | null;
  xpFill: Element | null;
  lv: Element | null;
  lvNum: HTMLElement | null;
}

export function hudRefs(scope: ParentNode, host: Element): HudRefs {
  return {
    host,
    coin: scope.querySelector('[data-hud-coin]'),
    coinNum: scope.querySelector<HTMLElement>('[data-hud-coin-num]'),
    xpBox: scope.querySelector('[data-hud-xp]'),
    xpFill: scope.querySelector('[data-hud-xp] [data-prog-fill]'),
    lv: scope.querySelector('[data-hud-lv]'),
    lvNum: scope.querySelector<HTMLElement>('[data-hud-lv-num]'),
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');

/**
 * 퀘스트 성공: 카드 젤리 등장 → 제목 → 별 하나씩(prop + 반짝이) → 코인 튀어나와 HUD로 + 숫자 올리기 → 경험치 보석 → XP 바 → CTA
 * at0 = 카드가 뜨는 시각. 돌려주는 값 = XP 바가 다 찬 시각(레벨업 연결용)
 */
export function buildClear(
  seq: Seq,
  card: Element,
  hud: HudRefs,
  o: { at0: number; stars: number; coins: number; coinFrom: number; xpFrom: number; xpTo: number; xpMax: number; setRig?: (s: RigS) => void },
) {
  const q = (s: string) => card.querySelector(s);
  const T = o.at0;
  // 좌표는 애니메이션을 만들기 전에 (카드가 변형되기 전) 잰다
  const fx = q('[data-q="fx"]') ?? card;
  const stars = [...card.querySelectorAll('[data-q="star"]')];
  const starPos = stars.map((s) => centerIn(s, fx));
  const coinEl = q('[data-q="coin"]');
  const xpEl = q('[data-q="xp"]');
  const coinFrom = coinEl ? centerIn(coinEl, hud.host) : null;
  const coinTo = hud.coin ? centerIn(hud.coin, hud.host) : null;
  const xpFrom = xpEl ? centerIn(xpEl, hud.host) : null;
  const xpTo = hud.xpBox ? centerIn(hud.xpBox, hud.host) : null;
  // ① 카드
  seq.appear(q('[data-q="scrim"]'), T, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  seq.appear(q('[data-q="card"]'), T, [{ transform: 'translateY(40px) scale(0.6)' }, { transform: 'none' }], { spring: 'jellyA', liteSpring: 'body' });
  seq.appear(q('[data-q="rays"]'), T + seq.s(200), [{ transform: 'scale(0.3)' }, { transform: 'none' }], { spring: 'body', liteSpring: 'face' });
  seq.beat('카드 등장 (젤리)', T, seq.moves ? springTiming(seq.mode === 'lite' ? 'body' : 'jellyA').duration : 150, 'jellyA / lite body');
  if (seq.mode === 'reduced') seq.appear(q('[data-q="cut"]'), T, [{ opacity: 0 }, { opacity: 1 }]);
  // ② 제목
  const T1 = T + seq.s(320);
  seq.appear(q('[data-q="title"]'), T1, [{ transform: 'scale(0.5, 0.3)' }, { transform: 'none' }], { spring: 'jellyA', liteSpring: 'body' });
  if (o.setRig) seq.call(T1, () => o.setRig?.('cheer'));
  // ③ 별
  const T2 = T + seq.s(640);
  const step = seq.s(280);
  stars.forEach((s, i) => {
    const at = T2 + i * step;
    seq.appear(s, at, [{ transform: 'scale(0) rotate(-50deg)' }, { transform: 'none' }], { spring: 'prop', liteSpring: 'face' });
    burst(seq, fx, starPos[i].x, starPos[i].y, at + seq.s(80), i === 2 ? 8 : 6, 46);
  });
  const starsEnd = T2 + stars.length * step;
  seq.beat(`별 ${stars.length}개 하나씩 (${step}ms 간격) + 반짝이`, T2, Math.max(150, stars.length * step + (seq.moves ? 400 : 0)), 'prop / lite face');
  // ④ 코인
  const T3 = starsEnd + seq.s(160);
  let coinsEnd = T3;
  if (coinFrom && coinTo && hud.coin) {
    const r = coins(seq, hud.host, coinFrom, coinTo, T3, 5);
    const arrive = seq.moves ? r.first : T3;
    if (seq.moves) seq.anim(hud.coin.closest('[data-hud-chip]') ?? hud.coin, [{ transform: 'scale(1.22)' }, { transform: 'none' }], arrive, { ...springTiming('prop'), fill: 'none' });
    else if (seq.mode === 'minimal') seq.anim(hud.coinNum, [{ opacity: 0 }, { opacity: 1 }], arrive, { duration: 150, fill: 'none' });
    const countDur = seq.moves ? seq.s(600) + (r.last - r.first) : 0;
    seq.tick(arrive, countDur, (u) => {
      if (hud.coinNum) hud.coinNum.textContent = fmt(o.coinFrom + (o.coins * (1 - (1 - u) ** 3)));
    });
    seq.call(T3 - 1, () => {
      if (hud.coinNum) hud.coinNum.textContent = fmt(o.coinFrom);
    });
    coinsEnd = arrive + countDur;
    seq.beat(seq.moves ? `코인 ${seq.mode === 'full' ? 5 : 1}개 튀어나옴 → HUD + 숫자 올리기` : '코인 숫자 교체', T3, Math.max(150, coinsEnd - T3), '포물선 420 + inOut 480, prop 팝');
  }
  // ⑤ 경험치
  const T4 = T3 + seq.s(240);
  let xpEnd = T4;
  if (xpFrom && xpTo && hud.xpFill) {
    const r = coins(seq, hud.host, xpFrom, xpTo, T4, 1, GEM_SVG, 26);
    const arrive = seq.moves ? r.first : T4;
    const a = Math.min(1, o.xpFrom / o.xpMax);
    const b = Math.min(1, o.xpTo / o.xpMax);
    if (seq.moves) seq.anim(hud.xpFill, [{ transform: `scaleX(${a})` }, { transform: `scaleX(${b})` }], arrive, { duration: seq.s(520), easing: EASING.out });
    else seq.anim(hud.xpFill, [{ transform: `scaleX(${a})` }, { transform: `scaleX(${b})` }], arrive, { duration: seq.mode === 'minimal' ? 150 : 1 });
    xpEnd = arrive + (seq.moves ? seq.s(520) : 150);
    seq.beat('경험치 보석 → XP 바 채움', T4, xpEnd - T4, 'inOut 비행 → out 520ms');
  }
  // ⑥ 다음 행동
  const T5 = Math.max(coinsEnd, xpEnd) + seq.s(120);
  seq.appear(q('[data-q="cta"]'), T5, [{ transform: 'translateY(16px) scale(0.9)' }, { transform: 'none' }], { spring: 'body', liteSpring: 'face' });
  seq.beat('다음 퀘스트 버튼', T5, seq.moves ? springTiming('body').duration : 150, 'body');
  return { xpFull: xpEnd, end: T5 };
}

// ───────────── 레벨업

export function LevelUpOverlay({
  level,
  title,
  unlockText,
  rig = 'dance',
  tier,
  reduced,
  contained,
  onClose,
}: {
  level: number;
  title: string;
  unlockText: string;
  rig?: RigS;
  tier?: 'full' | 'lite' | 'minimal';
  reduced?: boolean;
  contained?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className={`a-lv-wrap${contained ? ' is-contained' : ''}`} role="dialog" aria-modal={contained ? undefined : true} aria-labelledby="a-lv-title">
      <div className="a-scrim a-scrim-strong" data-l="scrim" aria-hidden />
      <div className="a-lv" data-l="panel">
        <div className="a-lv-rays m-loop" data-l="rays" aria-hidden />
        <h2 id="a-lv-title" className="a-lv-title" data-l="banner">
          레벨 업!
        </h2>
        <div className="a-lv-row">
          <div className="a-lv-rig" data-l="rig">
            <PybaemRig state={rig} size={112} lookAt={false} tier={tier} reducedMotion={reduced} />
          </div>
          <div className="a-lv-badge" data-l="badge" aria-label={`레벨 ${level}`}>
            <span>Lv</span>
            {level}
          </div>
          <div className="a-lv-star" data-l="star" aria-hidden>
            <Byeolttongi style="A" mood="sparkling" size={88} label="" />
          </div>
        </div>
        <p className="a-lv-say" data-l="say">
          새 칭호를 가져왔어!
        </p>
        <div className="a-lv-gifts">
          <span className="a-lv-title-chip" data-l="title-chip">
            <Icon name="trophy" size={22} strokeWidth={2.6} />
            새 칭호 <b>{title}</b>
          </span>
          <span className="a-lv-unlock" data-l="unlock">
            <Icon name="unlock" size={22} strokeWidth={2.6} />
            {unlockText}
          </span>
        </div>
        <div className="a-lv-cta" data-l="cta">
          <ClayButton variant="lemon" size="md" icon="check" onClick={onClose}>
            좋아!
          </ClayButton>
        </div>
        <span className="a-cut a-cut-lv" data-l="cut" aria-hidden>
          뽁!
        </span>
        <div className="a-lv-fx" data-l="fx" aria-hidden />
      </div>
    </div>
  );
}

/**
 * 레벨업: XP 바 꽉 참(번쩍 + 젤리) → HUD 레벨 배지 변신(감기 → 뒤집혀 숫자 바뀜 → jellyA) → 배너 "레벨 업!" → 큰 배지 + 반짝이
 * → 별똥이 날아와 착지 → 새 칭호·새로 열린 것 → 컨페티 → CTA
 */
export function buildLevelUp(
  seq: Seq,
  ov: Element,
  hud: HudRefs,
  o: { at0: number; from: number; to: number; xpAfter: number; xpMaxAfter: number; setRig?: (s: RigS) => void },
) {
  const q = (s: string) => ov.querySelector(s);
  const T = o.at0;
  const fx = q('[data-l="fx"]') ?? ov;
  const badge = q('[data-l="badge"]');
  const banner = q('[data-l="banner"]');
  const badgePos = badge ? centerIn(badge, fx) : null;
  const bannerPos = banner ? centerIn(banner, fx) : null;
  // ① XP 바 꽉 참
  if (hud.xpBox) {
    seq.wiggle(hud.xpBox, T, [{ transform: 'none' }, { transform: 'scale(1.08, 1.5)' }, { transform: 'none' }], 300, EASING.out);
    const flash = seq.make(hud.xpBox, 'span', 'a-xp-flash');
    seq.anim(flash, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], T, { duration: seq.mode === 'reduced' ? 1 : seq.s(420) });
  }
  seq.beat('XP 바 꽉 참 (번쩍 + 늘어남)', T, seq.moves ? seq.s(420) : 150, 'out 300ms');
  // ② 배지 변신
  const T1 = T + seq.s(360);
  const lv = hud.lv;
  const mid = T1 + seq.s(380);
  if (seq.moves && lv) {
    seq.anim(lv, [{ transform: 'none' }, { transform: 'scale(1.35)' }], T1, { duration: seq.s(200), easing: EASING.out, fill: 'none' });
    seq.anim(lv, [{ transform: 'scale(1.35)' }, { transform: 'scale(1.35) rotateY(90deg)' }], T1 + seq.s(200), { duration: seq.s(180), easing: EASING.press, fill: 'none' });
    seq.anim(lv, [{ transform: 'scale(1.35) rotateY(-90deg)' }, { transform: 'none' }], mid, { ...springTiming(seq.mode === 'lite' ? 'body' : 'jellyA'), fill: 'none' });
  } else if (seq.mode === 'minimal' && lv) {
    seq.anim(lv, [{ opacity: 0.2 }, { opacity: 1 }], mid, { duration: 150, fill: 'none' });
  }
  seq.call(T1 - 1, () => {
    if (hud.lvNum) hud.lvNum.textContent = String(o.from);
    lv?.classList.remove('is-up');
  });
  seq.call(mid, () => {
    if (hud.lvNum) hud.lvNum.textContent = String(o.to);
    lv?.classList.add('is-up');
  });
  if (hud.xpFill) seq.anim(hud.xpFill, [{ transform: 'scaleX(1)' }, { transform: `scaleX(${o.xpAfter / o.xpMaxAfter})` }], mid, { duration: seq.moves ? seq.s(360) : seq.mode === 'minimal' ? 150 : 1, easing: EASING.out });
  seq.beat(`HUD 배지 변신 Lv ${o.from}→${o.to} (감기 → 뒤집기 → 젤리)`, T1, seq.moves ? mid - T1 + springTiming(seq.mode === 'lite' ? 'body' : 'jellyA').duration : 150, 'out · press · jellyA');
  // ③ 배너
  const T2 = mid + seq.s(160);
  seq.appear(q('[data-l="scrim"]'), T2, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  seq.appear(q('[data-l="panel"]'), T2, [{ transform: 'translateY(30px) scale(0.7)' }, { transform: 'none' }], { spring: 'body', liteSpring: 'face' });
  seq.appear(q('[data-l="rays"]'), T2 + seq.s(120), [{ transform: 'scale(0.2)' }, { transform: 'none' }], { spring: 'body', liteSpring: 'face' });
  seq.appear(q('[data-l="banner"]'), T2 + seq.s(160), [{ transform: 'scale(0.3, 0.2)' }, { transform: 'none' }], { spring: 'jellyA', liteSpring: 'body' });
  if (seq.mode === 'reduced') seq.appear(q('[data-l="cut"]'), T2, [{ opacity: 0 }, { opacity: 1 }]);
  seq.beat('"레벨 업!" 배너 (젤리)', T2, seq.moves ? seq.s(160) + springTiming('jellyA').duration : 150, 'body · jellyA');
  const T3 = T2 + seq.s(420);
  seq.appear(badge, T3, [{ transform: 'scale(0) rotate(-30deg)' }, { transform: 'none' }], { spring: 'prop', liteSpring: 'face' });
  if (badgePos) burst(seq, fx, badgePos.x, badgePos.y, T3 + seq.s(120), 10, 70);
  seq.appear(q('[data-l="rig"]'), T3 + seq.s(100), [{ transform: 'translateY(30px) scale(0.6)' }, { transform: 'none' }], { spring: 'jellyA', liteSpring: 'body' });
  if (o.setRig) seq.call(T3 + seq.s(100), () => o.setRig?.('dance'));
  seq.beat('큰 배지 Lv + 반짝이, 파이뱀 춤', T3, seq.moves ? springTiming('prop').duration : 150, 'prop · jellyA');
  // ④ 별똥이
  const T4 = T3 + seq.s(520);
  const star = q('[data-l="star"]');
  if (seq.moves) {
    const kf: Keyframe[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const e = 1 - (1 - u) ** 2;
      kf.push({ transform: `translate(${(1 - e) * 220}px, ${(1 - e) * -200 + Math.sin(Math.PI * u) * -40}px) rotate(${(1 - e) * 40}deg) scale(${0.6 + e * 0.4})`, opacity: i === 0 ? 0 : 1, offset: u });
    }
    seq.anim(star, kf, T4, { duration: seq.s(760) });
    seq.squish(star, T4 + seq.s(760), 0.8);
  } else seq.appear(star, T4, [{ opacity: 0 }, { opacity: 1 }]);
  const T4b = T4 + (seq.moves ? seq.s(760) : 0);
  seq.appear(q('[data-l="say"]'), T4b + seq.s(80), [{ transform: 'translateY(8px) scale(0.6)' }, { transform: 'none' }], { spring: 'prop', liteSpring: 'face' });
  seq.beat('별똥이 날아와 착지 + 말풍선', T4, T4b + seq.s(80) - T4 + (seq.moves ? 300 : 150), 'out 포물선 760ms → jellyA');
  // ⑤ 선물
  const T5 = T4b + seq.s(320);
  seq.appear(q('[data-l="title-chip"]'), T5, [{ transform: 'scale(0.4)' }, { transform: 'none' }], { spring: 'prop', liteSpring: 'face' });
  seq.appear(q('[data-l="unlock"]'), T5 + seq.s(220), [{ transform: 'translateY(14px) scale(0.6)' }, { transform: 'none' }], { spring: 'prop', liteSpring: 'face' });
  seq.beat('새 칭호 + 새로 열린 것', T5, seq.s(220) + (seq.moves ? springTiming('prop').duration : 150), 'prop');
  // ⑥ 컨페티
  const T6 = T5 + seq.s(120);
  if (bannerPos) confetti(seq, fx, bannerPos.x, bannerPos.y, T6, 36, 1);
  if (seq.n(36) > 0) seq.beat(`컨페티 ${seq.n(36)}개 (DOM, transform·opacity)`, T6, seq.s(1700), '중력 포물선 + 회전');
  // ⑦ CTA
  const T7 = T5 + seq.s(700);
  seq.appear(q('[data-l="cta"]'), T7, [{ transform: 'translateY(16px) scale(0.9)' }, { transform: 'none' }], { spring: 'body', liteSpring: 'face' });
  seq.beat('"좋아!" 버튼', T7, seq.moves ? springTiming('body').duration : 150, 'body');
}

/** 무대용 작은 HUD (실제 HUD와 같은 클래스·data 속성) */
export function MiniHud({ level, xp, xpMax, coins: c, children }: { level: number; xp: number; xpMax: number; coins: number; children?: ReactNode }) {
  return (
    <div className="a-minihud">
      <div className="a-hud-player" data-hud-chip="">
        <span className="a-hud-lv" data-hud-lv="">
          <span aria-hidden>Lv</span>
          <b data-hud-lv-num="">{level}</b>
        </span>
        <span className="a-hud-xp" data-hud-xp="">
          <span className="a-hud-nick">코딩탐험가</span>
          <span className="a-prog a-prog-lemon a-prog-thin" role="progressbar" aria-label={`경험치 ${xp} / ${xpMax}`} aria-valuenow={xp} aria-valuemin={0} aria-valuemax={xpMax}>
            <span className="a-prog-fill" data-prog-fill="" style={{ transform: `scaleX(${xp / xpMax})` }} />
          </span>
        </span>
      </div>
      <span className="a-chip a-chip-coin" data-hud-chip="">
        <span data-hud-coin="" className="a-chip-ic">
          <RewardIcon kind="coin" size={26} style="A" />
        </span>
        <span className="a-num" data-hud-coin-num="">
          {c.toLocaleString('ko-KR')}
        </span>
      </span>
      {children}
    </div>
  );
}
