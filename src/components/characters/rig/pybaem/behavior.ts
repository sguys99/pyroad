/**
 * 파이뱀 레이어 (P0-07 `engine.ts`의 compose 이식): 숨쉬기 · 점프(기쁨·응원) · 춤 · 꼬리 흔들기 ·
 * 턱 톡톡 · 말하기 · 두리번 · 꼬리 털기 · 오버래핑(머리·모자·망토) · 털썩 · 소품 위상.
 */
import { STYLE_RULES } from '../style';
import { HopLayer, TalkLayer } from '../core/layers';
import { Follower } from '../core/math';
import type { Behavior, ComposeCtx } from '../core/types';
import type { PybaemState } from './params';

/** 점프 높이 (128 좌표): 기쁨 16 · 응원 10 (리뷰 슬라이더 `tuning.hop`이 곱해짐) */
export function hopHeightOf(state: PybaemState): number {
  return state === 'happy' ? 16 : state === 'cheer' ? 10 : 0;
}

export function createPybaemBehavior(): Behavior<PybaemState> {
  const hop = new HopLayer();
  const talk = new TalkLayer();
  let dance = 0;
  let thudOnLand = false;
  const fidget = { next: 6, until: 0, lookX: 0, lookY: 0 };
  const fidLook = { x: new Follower(0, 90, 16), y: new Follower(0, 90, 16) };
  const tailFlick = new Follower(0, 120, 6);
  const headLag = new Follower(0, 260, 16);
  const hat = new Follower(0, 170, 6);
  const cape = new Follower(0, 90, 7);
  let prevRootX = 0;

  const thud = (ctx: ComposeCtx<PybaemState>) => {
    // 털썩: 아래로 크게 찌그러졌다가 젤리로 돌아옴
    const k = ctx.tuning.thud;
    if (k > 0) ctx.kickJelly(1.4 * k, -1.9 * k);
  };

  return {
    enter(ctx, prev, replay) {
      const pose = ctx.state;
      const hopH = hopHeightOf(pose);
      if (hopH > 0 && ctx.live) {
        hop.start(hopH * ctx.tuning.hop, pose === 'happy' ? 2 : Infinity);
      } else if (hop.active) {
        hop.stop(); // 공중이면 이번 점프는 끝까지 (착지 후 멈춤)
      }
      if (prev === 'idle') fidget.until = 0;
      if (pose === 'sad' && (prev !== 'sad' || replay) && ctx.live) {
        if (hop.active) thudOnLand = true;
        else thud(ctx);
      }
      if (pose === 'surprised' && ctx.live) ctx.kickJelly(-1.4, 2.8);
      if (!ctx.live) hop.cancel();
    },

    compose(ctx) {
      const { cur: c, out: o, sq, dt, t, state, live, policy, tuning } = ctx;
      const secondary = live && policy.secondary;

      if (live) {
        // 숨쉬기 (슬픔 4.4초, 잠 5.5초)
        const period = state === 'sleep' ? 5.5 : state === 'sad' ? 4.4 : 3.2;
        const b = Math.sin((2 * Math.PI * t) / period) * c.breatheAmp;
        sq.y *= 1 + 0.02 * b;
        sq.x *= 1 - 0.009 * b;
        o.headY += -0.5 * b;

        // 점프 (기쁨·응원)
        const nextH = c.hopHeight > 0.5 ? hopHeightOf(state) * tuning.hop : 0;
        const hs = hop.step(dt, nextH);
        if (hop.landed && thudOnLand) {
          thudOnLand = false;
          thud(ctx);
        }
        if (hs) {
          o.rootY += hs.y;
          sq.x *= 1 + hs.sx;
          sq.y *= 1 + hs.sy;
          o.tailRot += -10 * Math.sin(2 * Math.PI * hs.phase);
        }

        // 춤 (120bpm, 2박에 한 번 좌우)
        if (c.danceAmp > 0.002) {
          dance += dt;
          const a = c.danceAmp;
          const beat = 0.5;
          const sway = Math.sin((2 * Math.PI * dance) / (2 * beat));
          const bounce = Math.abs(Math.sin((Math.PI * dance) / beat));
          o.rootRot += 7 * a * sway;
          o.rootX += 3.5 * a * sway;
          o.rootY += -5 * a * bounce;
          o.headRot +=
            -6 * a * Math.sin((2 * Math.PI * dance) / (2 * beat) - 0.7);
          const down = Math.pow(1 - bounce, 3);
          sq.y *= 1 - 0.07 * a * down;
          sq.x *= 1 + 0.055 * a * down;
          o.tailRot += 16 * a * Math.sin((2 * Math.PI * dance) / beat);
        } else if (state !== 'dance') {
          dance = 0;
        }
        o.notesPhase = dance * 0.55;

        // 응원·손 흔들기: 꼬리 흔들기
        o.tailRot += 14 * c.waveAmp * Math.sin(2 * Math.PI * t * 2.2);
        // 생각: 턱 톡톡 + 천천히 갸웃
        o.tailRot +=
          c.thinkAmp * 6 * Math.max(0, Math.sin(2 * Math.PI * t * 1.7));
        o.headRot += c.thinkAmp * 1.5 * Math.sin(2 * Math.PI * t * 0.35);
        o.dotsPhase = t * 1.1;
        // 설명: 꼬리로 콕콕 가리키기 · 격려: 천천히 끄덕 · 갸우뚱: 고개 흔들
        if (state === 'teach')
          o.tailRot += 5 * c.tailPoint * Math.sin(2 * Math.PI * t * 1.6);
        if (state === 'encourage')
          o.headY += 1.1 * Math.max(0, Math.sin(2 * Math.PI * t * 0.9));
        if (state === 'confused')
          o.headRot += 2.5 * Math.sin(2 * Math.PI * t * 0.45);
        o.qmarkRot = 9 * Math.sin(2 * Math.PI * t * 0.8);
        o.zzzPhase = t * 0.55;

        // 말하기 레이어 (어떤 표정 위에도 얹힘)
        if (c.talkAmp > 0.01) {
          const fl = talk.step(dt, ctx.rng, tuning.talkSpeed);
          o.mouthOpen += c.talkAmp * fl;
          o.headY += c.talkAmp * 0.9 * fl;
          o.headRot += c.talkAmp * 1.2 * Math.sin(t * 5.3) * fl;
          o.browY += -c.talkAmp * 1.6 * talk.emph;
          o.browOp = Math.max(o.browOp, c.talkAmp * 0.35);
        } else {
          talk.reset();
        }

        // 대기 중 두리번·꼬리 털기 (full만, 포인터를 2초 이상 안 움직였을 때)
        if (state === 'idle' && secondary && ctx.look.w < 0.05) {
          if (t >= fidget.next) {
            const r = ctx.rng();
            if (r < 0.6) {
              fidget.lookX = ctx.rng() < 0.5 ? -0.85 : 0.85;
              fidget.lookY = -0.25 + ctx.rng() * 0.3;
              fidget.until = t + 0.9 + ctx.rng() * 0.6;
            } else {
              tailFlick.v += 220;
            }
            fidget.next = t + 5 + ctx.rng() * 4;
          }
          if (t > fidget.until) fidget.lookX = fidget.lookY = 0;
        } else {
          fidget.lookX = fidget.lookY = 0;
        }
        o.lookX += fidLook.x.step(fidget.lookX, dt);
        o.lookY += fidLook.y.step(fidget.lookY, dt);
        o.tailRot += tailFlick.step(0, dt);
      } else {
        hop.cancel();
        talk.reset();
        dance = 0;
      }

      // 오버래핑 액션: 머리가 몸을 한 박자 늦게 따라감, 모자·망토 출렁 (full만)
      if (secondary) {
        const hl = headLag.step(o.rootY, dt);
        o.headY += (hl - o.rootY) * 0.5;
        o.hatRot = hat.step((hl - o.rootY) * 1.6 + o.rootRot * -0.4, dt);
        const vx = dt > 0 ? (o.rootX - prevRootX) / dt : 0;
        o.capeSwing = cape.step(
          -vx * 0.06 - o.rootRot * 0.8 + (hl - o.rootY) * 0.15,
          dt,
        );
      } else {
        headLag.reset(o.rootY);
        o.hatRot = live ? hat.step(0, dt) : 0;
        o.capeSwing = 0;
        cape.reset(0);
      }
      prevRootX = o.rootX;

      // 소품 위상 (lite는 반짝이 회전·선 떨림을 멈춤)
      if (live) {
        o.sparkPhase = secondary ? t * 0.8 : 0.15;
        o.tearPhase = (t * 0.6) % 1;
        const fps = tuning.boilFps ?? STYLE_RULES[ctx.style].boilFps;
        o.boilSeed =
          secondary && policy.filters && fps > 0
            ? 1 + (Math.floor(t * fps) % 40)
            : 1;
      } else {
        o.sparkPhase = 0.15;
        o.tearPhase = 0.45;
        o.notesPhase = 0.3;
        o.dotsPhase = 0.25;
        o.zzzPhase = 0;
        o.qmarkRot = 0;
        o.boilSeed = 1;
      }
    },

    busy() {
      return hop.active;
    },
  };
}
