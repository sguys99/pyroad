// 스테이지 #stage: 퀘스트 고르기·복습 (X7). 모바일은 바텀시트, 데스크톱은 지도 오른쪽에 펼쳐지는 종이 장
import { goScreen } from '../shared/app';
import { Icon } from '../shared/icons';
import { RewardIcon } from '../shared/icons';
import { STAGES } from '../shared/content';
import { PaperIsland } from './art';
import { CHEST_GOAL, STAGE_BUILDING, questProgress, stageStars, stageStatus } from './data';
import { setAb, toast } from './store';
import { KindBadge, Progress, Sheet, Stars } from './ui';

export function StageSheet({ stage, onClose }: { stage: number; onClose: () => void }) {
  const s = STAGES.find((x) => x.order === stage) ?? STAGES[0];
  const t = stageStars(s.order);
  const st = stageStatus(s.order);
  const chestOpen = t.got >= CHEST_GOAL;
  return (
    <Sheet
      label={`${s.order}번 섬 ${s.title} 퀘스트 고르기`}
      onClose={onClose}
      title={
        <div className="ab-stage-head">
          <span className="ab-stage-isle" aria-hidden>
            <PaperIsland kind={STAGE_BUILDING[s.order - 1]} big={s.final} />
          </span>
          <div>
            <p className="ab-stage-kicker">
              {s.order}번 섬 · {st === 'done' ? '클리어' : '모험 중'}
            </p>
            <h2 className="ab-display ab-h2">{s.title}</h2>
          </div>
        </div>
      }
    >
      <p className="ab-stage-desc">{s.description}</p>
      <div className="ab-stage-meter">
        <div className="ab-stage-meter-row">
          <span>
            <b>★ {t.got}</b> / {t.max}
          </span>
          <span className={`ab-chest ${chestOpen ? 'is-open' : ''}`}>
            <RewardIcon kind="gem" style="AB" size={24} />
            {chestOpen ? '보물상자 열림' : `★ ${CHEST_GOAL}개면 보물상자`}
          </span>
        </div>
        <Progress value={t.got} max={t.max} label={`별 ${t.max}개 중 ${t.got}개`} tone="lemon" />
      </div>
      <ol className="ab-quest-list">
        {s.quests.map((q) => {
          const p = questProgress(s.order, q);
          const locked = p.status === 'locked';
          const review = p.status === 'done' && p.stars < 3;
          return (
            <li key={q.order}>
              <button
                type="button"
                className={`ab-quest-row is-${p.status}`}
                aria-disabled={locked}
                onClick={() => {
                  if (locked) {
                    toast('앞 퀘스트를 깨면 열려요', 'lock');
                    return;
                  }
                  setAb({ quest: { stage: s.order, order: q.order } });
                  goScreen('quest');
                }}
              >
                <span className="ab-quest-no">{locked ? <Icon name="lock" size={20} strokeWidth={2.8} /> : `${s.order}-${q.order}`}</span>
                <span className="ab-quest-main">
                  <span className="ab-quest-title">
                    {q.title}
                    {q.challenge && <span className="ab-chip-challenge">도전</span>}
                  </span>
                  <span className="ab-quest-meta">
                    <KindBadge kind={p.kind} />
                    <span className="ab-quest-concept">{q.concept}</span>
                  </span>
                </span>
                <span className="ab-quest-side">
                  {locked ? (
                    <span className="ab-quest-lock">잠김</span>
                  ) : p.status === 'current' ? (
                    <span className="ab-quest-now">
                      <Icon name="play" size={18} /> 시작
                    </span>
                  ) : (
                    <>
                      <Stars n={p.stars} size={20} />
                      {review && <span className="ab-quest-review">별 채우기</span>}
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="ab-stage-foot">
        <Icon name="refresh" size={18} strokeWidth={2.4} /> 깬 퀘스트도 다시 풀어 별을 채울 수 있어요. 퀴즈 복습은 다음 날부터 별이 바뀌어요.
      </p>
    </Sheet>
  );
}
