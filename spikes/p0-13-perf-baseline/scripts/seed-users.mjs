// P0-13: 측정용 테스트 사용자 3명과 실제 같은 진행 상태 만들기 (로컬 Supabase 전용, 멱등)
//   P013_WORK=<작업> node scripts/seed-users.mjs
import { ensureUser, psql, resetCeleb, QUEST } from './lib.mjs';

const xp = (base, hints) => (hints === 0 ? Math.round(base * 1.5) : hints === 1 ? Math.round(base * 1.25) : base);
const level = (t) => [0, 100, 300, 600, 1000].reduce((lv, th, i) => (t >= th ? i + 1 : lv), 1);

const quests = psql(`select q.id, s.order, q.order, q.xp_reward from quests q join stages s on s.id=q.stage_id order by s.order, q.order`)
  .split('\n')
  .map((l) => {
    const [id, so, qo, x] = l.split('|');
    return { id, stage: +so, order: +qo, xp: +x };
  });

function progressSQL(uid, list, daysAgo0 = 9) {
  let total = 0;
  const rows = list.map((q, i) => {
    const hints = i % 3; // 0,1,2 힌트를 번갈아
    total += xp(q.xp, hints);
    const ago = Math.max(0, daysAgo0 - Math.floor(i / 2));
    return `('${uid}','${q.id}','completed',${hints},coalesce((select prompt_skeleton->>'solution_code' from quests where id='${q.id}'),'print("완료")'),now()-interval '${ago} days')`;
  });
  return {
    total,
    sql: `delete from user_progress where user_id='${uid}';
      insert into user_progress (user_id, quest_id, status, hints_used, code_submitted, completed_at) values ${rows.join(',\n')};`,
  };
}

const perf = await ensureUser('perf');
const newbie = await ensureUser('newbie');
const celeb = await ensureUser('celeb');

// perf: 1·2스테이지 완료 + 3스테이지 1~2번 완료 (월드맵에서 3스테이지가 "진행 중")
const perfList = quests.filter((q) => q.stage <= 2 || (q.stage === 3 && q.order <= 2));
const p = progressSQL(perf, perfList);
psql(`${p.sql}
  update users set total_xp=${p.total}, current_level=${level(p.total)}, golden_keys=2, last_login_at=now() where id='${perf}';
  delete from user_badges where user_id='${perf}';
  insert into user_badges (user_id, badge_type) values ('${perf}','first_code'),('${perf}','hint_master'),('${perf}','stage_clear');`);

// newbie: 진행 없음
psql(`delete from user_progress where user_id='${newbie}'; delete from user_badges where user_id='${newbie}';
  update users set total_xp=0, current_level=1, golden_keys=3 where id='${newbie}';`);

// celeb: 1스테이지 1~6번 완료, XP 280(Lv.2) → 1-7(75XP, 힌트 0 → 113XP) 완료 시 스테이지 클리어 + Lv.3 + stage_clear 뱃지
const celebList = quests.filter((q) => q.stage === 1 && q.id !== QUEST.stage1Last);
const c = progressSQL(celeb, celebList, 3);
psql(`${c.sql}
  delete from user_badges where user_id='${celeb}';
  insert into user_badges (user_id, badge_type) values ('${celeb}','first_code'),('${celeb}','hint_master');`);
resetCeleb(celeb);

console.log(
  psql(`select u.display_name, u.total_xp, u.current_level, (select count(*) from user_progress p where p.user_id=u.id and status='completed') done,
    (select string_agg(badge_type, ',') from user_badges b where b.user_id=u.id) badges from users u order by 1`),
);
console.log(JSON.stringify({ perf, newbie, celeb }));
