/**
 * 별똥이 레이어: 떠 있기 · 날아오기(호를 그리며 속도 방향으로 늘어남 + 꼬리 빛) · 착지(찌그러짐 + 먼지) ·
 * 반짝(한 바퀴 돌기 + 반짝이) · 보상 건네기(코인을 번쩍 → 팝! 신호 'reward'로 화면의 코인 팝과 맞춤).
 * 날기·돌기·코인은 "이번 동작은 끝까지": 도중에 상태가 바뀌어도 끝까지 이어진다.
 */
import { STYLE_RULES } from '../style';
import {
  Follower,
  clamp,
  easeInOutSine,
  easeOutCubic,
  lerp,
} from '../core/math';
import type { Behavior } from '../core/types';
import type { ByeolttongiState } from './params';

export const FLIGHT_LEN = 0.9;
/** 날아오는 길 (몸 가운데 기준 상대 좌표, 2차 베지어) */
const P0 = [-118, -96];
const P1 = [-30, -118];
const SPIN_LEN = 0.75;
const SPIN_EVERY = 2.6;
/** 코인: 올리기 0.4초 → 들고 있기 → 0.75초에 팝 → 0.4초 동안 오른쪽 위로 날아감 */
export const COIN_POP_AT = 0.75;

function bez(u: number, i: 0 | 1) {
  const a = (1 - u) * (1 - u);
  const b = 2 * (1 - u) * u;
  return a * P0[i] + b * P1[i];
}

export function createByeolttongiBehavior(): Behavior<ByeolttongiState> {
  let flying = false;
  let flyU = 0;
  let spinAt = -10;
  let dustAt = -10;
  let giveAt = -10;
  let popped = true;
  const trail = {
    x1: new Follower(0, 160, 20),
    y1: new Follower(0, 160, 20),
    x2: new Follower(0, 110, 18),
    y2: new Follower(0, 110, 18),
  };
  let prevX = 0;
  let prevY = 0;

  return {
    enter(ctx, prev, replay) {
      const s = ctx.state;
      if (s === 'flyIn' && ctx.live) {
        flying = true;
        flyU = 0;
        prevX = P0[0];
        prevY = P0[1];
      }
      if (s === 'land' && (prev !== 'land' || replay)) {
        dustAt = ctx.t;
        if (ctx.live) ctx.kickJelly(2.4, -3.4);
      }
      if (s === 'sparkle' && ctx.live) spinAt = ctx.t;
      if (s === 'give' && (prev !== 'give' || replay)) {
        giveAt = ctx.t;
        popped = false;
        // 움직임이 없으면 코인을 든 모습으로 두고 신호만 바로 보낸다
        if (!ctx.live) {
          popped = true;
          ctx.emit('reward');
        }
      }
      if (!ctx.live) flying = false;
    },

    compose(ctx) {
      const { cur: c, out: o, sq, dt, t, live, policy, tuning, state } = ctx;
      const secondary = live && policy.secondary;

      if (live) {
        // 떠 있기
        o.rootY += -4 * c.floatAmp * Math.sin(2 * Math.PI * t * 0.45);
        o.rootRot += 4 * c.floatAmp * Math.sin(2 * Math.PI * t * 0.3 + 0.8);
        o.armWiggle = 0.14 * c.floatAmp * Math.sin(2 * Math.PI * t * 1.1);

        // 날아오기 (2차 베지어, 끝에서 살짝 감속)
        let tx = 0;
        let ty = 0;
        if (flying) {
          flyU = Math.min(1, flyU + dt / FLIGHT_LEN);
          const e = 1 - (1 - flyU) * (1 - flyU);
          const x = bez(e, 0);
          const y = bez(e, 1);
          const vx = dt > 0 ? (x - prevX) / dt : 0;
          const vy = dt > 0 ? (y - prevY) / dt : 0;
          prevX = x;
          prevY = y;
          o.flyX = x;
          o.flyY = y;
          const speed = Math.hypot(vx, vy);
          o.stretch = clamp(speed / 900, 0, 0.32);
          o.stretchDir = (Math.atan2(vy, vx) * 180) / Math.PI;
          // 꼬리 빛: 지나온 길 (lite는 짧게)
          const k = secondary ? 1 : 0.5;
          const e1 = Math.max(0, e - 0.14 * k);
          const e2 = Math.max(0, e - 0.3 * k);
          tx = (bez(e1, 0) - x) * c.trail;
          ty = (bez(e1, 1) - y) * c.trail;
          o.tx2 = (bez(e2, 0) - x) * c.trail;
          o.ty2 = (bez(e2, 1) - y) * c.trail;
          if (flyU >= 1) flying = false;
        } else {
          o.flyX = 0;
          o.flyY = 0;
          o.stretch = 0;
        }
        o.tx1 = trail.x1.step(tx, dt);
        o.ty1 = trail.y1.step(ty, dt);
        o.tx2 = trail.x2.step(flying ? o.tx2 : 0, dt);
        o.ty2 = trail.y2.step(flying ? o.ty2 : 0, dt);

        // 반짝: 한 바퀴 (주기마다 다시)
        if (state === 'sparkle' && c.spinAmp > 0.5 && t - spinAt > SPIN_EVERY)
          spinAt = t;
        const su = (t - spinAt) / SPIN_LEN;
        if (su >= 0 && su < 1) {
          o.rootRot += 360 * easeInOutSine(su);
          sq.y *= 1 + 0.06 * Math.sin(Math.PI * su);
        }
        o.twPhase = t * 0.9;
      } else {
        flying = false;
        o.flyX = o.flyY = o.stretch = 0;
        o.tx1 = c.trail * -24;
        o.ty1 = c.trail * 30;
        o.tx2 = c.trail * -50;
        o.ty2 = c.trail * 56;
        o.armWiggle = 0;
        o.twPhase = 0.2;
        trail.x1.reset(0);
        trail.y1.reset(0);
        trail.x2.reset(0);
        trail.y2.reset(0);
      }

      // 착지 먼지
      o.dustPhase = live ? clamp((t - dustAt) / 0.6) : 0.35;

      // 코인
      const tg = t - giveAt;
      if (!live) {
        o.coinX = 64;
        o.coinY = 2;
        o.coinS = 1;
        o.coinFlip = 1;
        o.coinOp = 1;
      } else if (tg < 0.4) {
        const e = easeOutCubic(tg / 0.4);
        o.coinX = 64;
        o.coinY = lerp(86, 2, e);
        o.coinS = lerp(0.55, 1, e);
        o.coinFlip = 1;
        o.coinOp = 1;
      } else if (tg < COIN_POP_AT) {
        o.coinX = 64;
        o.coinY = 2 + 1.5 * Math.sin((tg - 0.4) * 18);
        o.coinS = 1;
        o.coinFlip = Math.cos((tg - 0.4) * 2 * Math.PI * 2.2);
        o.coinOp = 1;
      } else {
        if (!popped) {
          popped = true;
          ctx.emit('reward');
          ctx.kickJelly(-0.8, 1.6);
        }
        const e = clamp((tg - COIN_POP_AT) / 0.4);
        const k = easeInOutSine(e);
        o.coinX = lerp(64, 132, k);
        o.coinY = lerp(2, -52, k) - 18 * Math.sin(Math.PI * e);
        o.coinS = lerp(1.15, 0.55, k);
        o.coinFlip = 1;
        o.coinOp = 1 - smoothEnd(e);
      }
      // 손: 코인을 올릴 때 번쩍, 날린 뒤 내림
      if (live && tg >= 0 && tg < 1.4)
        o.reach *= tg < COIN_POP_AT + 0.15 ? 1 : 0.5;

      const fps = tuning.boilFps ?? STYLE_RULES[ctx.style].boilFps;
      o.boilSeed =
        secondary && policy.filters && fps > 0
          ? 1 + (Math.floor(t * fps) % 40)
          : 1;
    },

    busy(ctx) {
      return (
        flying ||
        (ctx.t - spinAt >= 0 && ctx.t - spinAt < SPIN_LEN) ||
        (!popped && ctx.live) ||
        ctx.t - giveAt < COIN_POP_AT + 0.45 ||
        ctx.t - dustAt < 0.6
      );
    },
  };
}

function smoothEnd(e: number) {
  return e < 0.6 ? 0 : (e - 0.6) / 0.4;
}
