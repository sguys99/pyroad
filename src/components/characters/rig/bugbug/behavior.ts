/**
 * 버그버그 레이어: 숨쉬기 · 종종걸음 · 옆에서 통통 등장 · 두리번(돋보기) · 깜짝 점프 · 공격(찌그러졌다 돌진) ·
 * 피격(찌그러짐 + 흔들림 + 별 어지러움) · 패배(뒤집혀 다리 버둥) · 화해(통통 + 다리 흔들기) · 더듬이 2차 움직임.
 */
import { STYLE_RULES } from '../style';
import { HopLayer } from '../core/layers';
import { Follower, clamp } from '../core/math';
import type { Behavior } from '../core/types';
import type { BugBugState } from './params';

/** 공격 한 주기(초): 준비 → 돌진 → 복귀 → 대기 */
export const ATTACK_PERIOD = 1.9;
const ENTER_FROM = -78;

export function createBugBugBehavior(): Behavior<BugBugState> {
  const hop = new HopLayer();
  const enterX = new Follower(0, 38, 12);
  const antL = new Follower(0, 140, 7);
  const antR = new Follower(0, 140, 7);
  const lag = new Follower(0, 160, 10);
  let legPhase = 0;
  let shakeAt = -10;
  let puffAt = -10;
  let attackT = 0;
  let attackCue = false;
  let entering = false;

  return {
    enter(ctx, prev, replay) {
      const s = ctx.state;
      if (!ctx.live) {
        hop.cancel();
        enterX.reset(0);
        entering = false;
        return;
      }
      if (s === 'appear') {
        // 옆에서 통통 들어온다 (끊겨도 위치 스프링이 끝까지 이어 줌)
        enterX.reset(ENTER_FROM);
        entering = true;
        hop.start(7, Infinity);
      } else if (hop.active && !entering) {
        hop.stop();
      }
      if (s === 'found' && (prev !== 'found' || replay)) {
        hop.start(9, 1);
        ctx.kickJelly(-1.2, 2.4);
      }
      if (s === 'hit') {
        shakeAt = ctx.t;
        ctx.kickJelly(2.2, -2.8);
      }
      if (s === 'defeat' && prev !== 'defeat') ctx.kickJelly(1.6, -2);
      if (s === 'attack' && (prev !== 'attack' || replay)) attackT = 0;
    },

    compose(ctx) {
      const { cur: c, out: o, sq, dt, t, live, policy, tuning, state } = ctx;
      const secondary = live && policy.secondary;

      if (live) {
        // 숨쉬기
        const b = Math.sin((2 * Math.PI * t) / 2.8) * c.breatheAmp;
        sq.y *= 1 + 0.018 * b;
        sq.x *= 1 - 0.008 * b;
        o.headY += -0.4 * b;

        // 등장: 옆에서 통통
        const ex = enterX.step(0, dt);
        o.rootX += ex;
        if (entering && Math.abs(ex) < 2) {
          entering = false;
          hop.stop();
          puffAt = t;
        }
        const hs = hop.step(dt, 9);
        if (hs) {
          o.rootY += hs.y;
          sq.x *= 1 + hs.sx;
          sq.y *= 1 + hs.sy;
        }
        if (hop.landed && !hop.active) {
          ctx.kickJelly(1.2, -1.6);
          puffAt = t;
        }

        // 종종걸음 (다리 위상)
        const speed = entering ? 9 : state === 'search' ? 3.2 : 1.2;
        legPhase += dt * speed * Math.max(c.legAmp, 0.15);

        // 탐색: 두리번 + 옆걸음 (돋보기가 시선을 따라감)
        const scan = Math.sin(2 * Math.PI * t * 0.42);
        o.lookX += 0.95 * c.scanAmp * scan;
        o.lookY += 0.15 * c.scanAmp * Math.sin(2 * Math.PI * t * 0.84);
        o.headRot += 5 * c.scanAmp * scan;
        o.rootX += 4 * c.scanAmp * Math.sin(2 * Math.PI * t * 0.42 - 0.6);

        // 공격: 준비(찌그러짐) → 돌진(커지며 앞으로) → 복귀. 세기는 엔벨로프라 끊어도 부드럽게 사라짐
        if (c.attackAmp > 0.002) {
          attackT += dt;
          const u = (attackT % ATTACK_PERIOD) / ATTACK_PERIOD;
          const a = c.attackAmp;
          const wind = u < 0.36 ? Math.sin((Math.PI * u) / 0.36) : 0;
          const dash =
            u >= 0.36 && u < 0.62 ? Math.sin((Math.PI * (u - 0.36)) / 0.26) : 0;
          sq.x *= 1 + a * (0.15 * wind + 0.2 * dash);
          sq.y *= 1 + a * (-0.17 * wind + 0.24 * dash);
          o.rootY += a * (2.5 * wind + 5 * dash);
          o.headRot += a * (-7 * wind + 4 * dash);
          o.shellOpen += a * 0.9 * dash;
          o.rootX += a * Math.sin(t * 40) * 0.8 * wind;
          if (u >= 0.45 && !attackCue) {
            attackCue = true;
            puffAt = t;
            ctx.emit('attack');
          } else if (u < 0.45) attackCue = false;
        } else {
          attackT = 0;
        }

        // 피격 흔들림 (상태가 바뀌어도 끝까지 줄어들며 이어짐)
        const sk = t - shakeAt;
        if (sk < 0.9) o.rootX += Math.sin(sk * 48) * 3.2 * Math.exp(-sk * 4.5);

        // 패배: 뒤집힌 채 흔들흔들
        o.rootRot += 6 * c.legFlail * Math.sin(2 * Math.PI * t * 0.55);

        // 화해: 통통 + 앞다리 흔들기
        o.rootY += -3.2 * c.bobAmp * Math.abs(Math.sin(Math.PI * t * 1.6));
        o.waveRot =
          -62 * c.legWave + 20 * c.legWave * Math.sin(2 * Math.PI * t * 1.8);

        // 더듬이: 몸을 늦게 따라오며 출렁 (full만), 대기 중에는 살랑
        const sway = 5 * Math.sin(2 * Math.PI * t * 0.35);
        const l = secondary
          ? lag.step(o.rootY + o.headY, dt) - (o.rootY + o.headY)
          : 0;
        const baseL = 16 * c.antPerk - 30 * c.antDroop + sway + l * 1.4;
        const baseR = -16 * c.antPerk + 30 * c.antDroop - sway - l * 1.4;
        o.antL = secondary ? antL.step(baseL, dt) : baseL;
        o.antR = secondary ? antR.step(baseR, dt) : baseR;

        o.magRot = 14 * o.lookX;
        o.exRot = 10 * Math.sin(2 * Math.PI * t * 1.3);
        o.dizzyPhase = t * 0.85;
        const fps = tuning.boilFps ?? STYLE_RULES[ctx.style].boilFps;
        o.boilSeed =
          secondary && policy.filters && fps > 0
            ? 1 + (Math.floor(t * fps) % 40)
            : 1;
      } else {
        hop.cancel();
        enterX.reset(0);
        entering = false;
        legPhase = 0.15;
        o.waveRot = -62 * c.legWave;
        o.antL = 16 * c.antPerk - 30 * c.antDroop;
        o.antR = -16 * c.antPerk + 30 * c.antDroop;
        lag.reset(0);
        antL.reset(o.antL);
        antR.reset(o.antR);
        o.magRot = 0;
        o.exRot = 0;
        o.dizzyPhase = 0.1;
        o.boilSeed = 1;
      }
      o.legPhase = legPhase;
      o.puffPhase = clamp((t - puffAt) / 0.55);
    },

    busy(ctx) {
      return hop.active || entering || ctx.t - shakeAt < 0.9;
    },
  };
}
