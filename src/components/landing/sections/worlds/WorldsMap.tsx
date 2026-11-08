import type { CSSProperties } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { ScrollLink } from '../../ScrollLink';
import { WorldCoverArt } from './WorldCoverArt';
import { WorldsMapDecorLazy } from './WorldsMapDecorLazy';
import { WorldsMapMotion } from './WorldsMapMotion';
import {
  LOCKED_TIP,
  standRange,
  worldLabel,
  worldNote,
  type WorldPreview,
} from './worldsData';
import type { WorldStats } from './worldStats';

/** 카드 사이 점선 길. 넓은 화면(가로 지도)은 오르내리는 길, 좁은 화면(세로 지도)은 좌우로 굽는 길 */
function RoadStep({ i }: { i: number }) {
  const up = i % 2 === 0;
  return (
    <>
      <svg
        className="ld-worlds-step"
        data-axis="x"
        data-dir={up ? 'up' : 'down'}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        focusable="false"
      >
        <path
          className="hm-road"
          d={up ? 'M0 100C55 100 45 0 100 0' : 'M0 0C55 0 45 100 100 100'}
        />
      </svg>
      <svg
        className="ld-worlds-step"
        data-axis="y"
        data-dir={up ? 'right' : 'left'}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
        focusable="false"
      >
        <path
          className="hm-road"
          d={up ? 'M0 0C0 60 100 40 100 100' : 'M100 0C100 60 0 40 0 100'}
        />
      </svg>
    </>
  );
}

/**
 * 세계관 지도 (P4-04): 두루마리 그림책 지도 위에 월드 표지 3장과 그 사이 점선 길.
 * 넓은 화면(900px~)은 가로 지도(왼쪽 → 오른쪽으로 펼침), 좁은 화면은 세로 지도(위 → 아래).
 *
 * 펼침 연출 (worlds.css, 단계별):
 * - full: 스크롤에 맞춰 두루마리 막대가 굴러가며 지도를 드러내고(덮개 transform), 지나간 자리의 표지가 일어선다(rotateX).
 *   점선 길은 막대가 지나가며 드러나므로 "그려지는" 것처럼 보인다 (stroke-dashoffset 없이 transform만)
 * - lite(또는 스크롤 연동을 모르는 브라우저): 화면에 들어올 때 한 번 펼침
 * - minimal·동작 줄이기: 처음부터 펼친 정지 상태
 *
 * 서버 컴포넌트: 글자·표지 그림은 서버 HTML에 그대로 있다. 클라이언트는 `WorldsMapMotion`(속성·알림)과 여백 그림(지연)뿐
 */
export function WorldsMap({
  worlds,
  stats,
}: {
  worlds: readonly WorldPreview[];
  stats: WorldStats | null;
}) {
  return (
    <div className="ld-worlds-map" data-testid="worlds-map">
      <div className="ld-worlds-stage">
        <div className="ld-worlds-paper">
          <ol className="ld-worlds-list">
            {worlds.map((w, i) => {
              const { s, e } = standRange(i, worlds.length);
              const noteId = `ld-worlds-note-${w.no}`;
              const locked = w.state === 'locked';
              return (
                <li
                  key={w.no}
                  className="ld-worlds-card"
                  data-world={w.no}
                  data-state={w.state}
                  data-testid={`world-card-${w.no}`}
                  style={{ '--s': s, '--e': e } as CSSProperties}
                >
                  {i < worlds.length - 1 && <RoadStep i={i} />}
                  <WorldsMapDecorLazy world={w.no} />
                  <div className="ld-worlds-card-in">
                    <div className="ld-worlds-face">
                      <div className="ld-worlds-cover">
                        <WorldCoverArt world={w.no} />
                        <span className="ld-worlds-tags">
                          <span className="ld-worlds-band">
                            {worldLabel(w.no)}
                          </span>
                          {!w.ready && (
                            <span className="ld-worlds-soon">준비 중</span>
                          )}
                        </span>
                        {locked && (
                          <>
                            <span className="ld-worlds-lock" aria-hidden>
                              <Lock strokeWidth={2.4} />
                            </span>
                            <span className="ld-worlds-tip" aria-hidden>
                              {LOCKED_TIP}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="ld-worlds-text">
                        <h3 className="ld-worlds-name font-display">
                          <span className="sr-only">{worldLabel(w.no)} · </span>
                          {w.name}
                        </h3>
                        <p className="ld-worlds-line">{w.line}</p>
                        <p className="ld-worlds-note" id={noteId}>
                          {locked ? (
                            <Lock aria-hidden strokeWidth={2.4} />
                          ) : (
                            <b>지금 열려 있어요</b>
                          )}
                          <span>{worldNote(w, worlds[i - 1], stats)}</span>
                        </p>
                        {locked ? (
                          <button
                            type="button"
                            className="ld-worlds-act"
                            aria-label={`${w.name}: 잠겨 있어요`}
                            aria-describedby={noteId}
                            data-locked-world={w.name}
                          />
                        ) : (
                          <ScrollLink
                            target="try"
                            className="ld-worlds-act"
                            data-testid="world-open-link"
                          >
                            30초 체험하기
                            <ArrowRight aria-hidden strokeWidth={2.4} />
                          </ScrollLink>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
        {/* 두루마리: 시작 쪽 막대(고정) + 굴러가는 막대와 아직 말린 부분을 가리는 덮개 */}
        <span className="ld-worlds-rod" data-at="start" aria-hidden />
        <div className="ld-worlds-track" aria-hidden>
          <span className="ld-worlds-veil" />
          <span className="ld-worlds-rod" data-at="end" />
        </div>
      </div>
      <WorldsMapMotion />
    </div>
  );
}
