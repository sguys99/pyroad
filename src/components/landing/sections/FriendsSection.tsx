import {
  BugBugStatic,
  ByeolttongiStatic,
  PybaemStatic,
} from '@/components/characters/rig';
import { LandingSection } from '../LandingSection';
import { FriendsCast } from './friends/FriendsCast';
import './friends.css';

const STILL = {
  size: 168,
  framing: 'stage' as const,
  label: '',
  className: 'ld-friends-svg',
};

/**
 * 랜딩 `#friends` 세 친구 (P4-06): 파이뱀 · 버그버그 · 별똥이를 이름 + 역할 한 줄로 소개한다.
 * 최종 시안 `Landing.tsx` Friends("한 줄 소개" — 카드 테두리·원형 배경 없음)에 누르면 반응하는 리그를 얹었다.
 *
 * - 서버 컴포넌트: 이름·역할·첫 말풍선·정지 그림(훅 없는 RigStatic)을 서버 HTML에 그린다. 정지 그림은 여기서 그려
 *   `FriendsCast`(클라이언트)에 넘기므로 정지 그림 코드가 클라이언트 JS에 들어가지 않는다
 * - 라이브 리그·인사·반응은 `friends/FriendsCast.tsx`, 이름·역할·대사는 `friends/friends.ts`
 * - 앵커 id `friends`·제목 id `friends-title`은 바꾸지 않는다. 스타일은 `friends.css`(`ld-friends-`)
 * - 문구를 바꾸면 `npm run fonts:build -- --landing` → `npm run fonts:check`
 */
export function FriendsSection() {
  return (
    <LandingSection
      id="friends"
      kicker="함께하는 친구들"
      title="함께 모험할 세 친구"
      lead="퀘스트 길에서 늘 만나는 친구들이야. 콕 눌러 봐!"
    >
      <FriendsCast
        stills={{
          pybaem: <PybaemStatic {...STILL} idPrefix="ldfr-py-" />,
          bugbug: <BugBugStatic {...STILL} idPrefix="ldfr-bug-" />,
          byeolttongi: <ByeolttongiStatic {...STILL} idPrefix="ldfr-star-" />,
        }}
      />
    </LandingSection>
  );
}
