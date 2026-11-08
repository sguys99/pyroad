import type { BubbleTone } from '@/components/ui/speech-bubble';
import type { PybaemState } from '@/components/characters/rig/pybaem';
import type { BugBugState } from '@/components/characters/rig/bugbug';
import type { ByeolttongiState } from '@/components/characters/rig/byeolttongi';
import type { SfxId } from '@/lib/sound/manifest';

/**
 * 랜딩 `#friends` 세 친구 (P4-06). 이름·역할·대사·반응 순서를 한 곳에 둔다 (DOM 없는 순수 데이터 → 단위 테스트).
 *
 * 역할·대사는 지금 앱에서 실제로 하는 일만 쓴다:
 * - 파이뱀: AI 튜터. 시스템 프롬프트가 "정답 코드를 직접 알려 주지 않고 힌트·유도 질문"(`src/lib/tutor/prompts.ts`), 힌트는 3단계
 * - 버그버그: 실행 에러·시간 초과 때 결과 패널에 나와 "여기를 살펴볼까요?"(`src/components/quest/OutputPanel.tsx`)
 * - 별똥이: 퀘스트를 깨고 XP를 받을 때 상태 막대로 날아온다(`QuestStatusBar.tsx`). 별·코인은 Phase 8이라 아직 쓰지 않는다
 *   (별·코인이 생기면 역할을 "별과 코인을 가져오는 요정"으로 바꾸고 `give` 상태를 써도 된다)
 */
export type FriendId = 'pybaem' | 'bugbug' | 'byeolttongi';

interface FriendStates {
  pybaem: PybaemState;
  bugbug: BugBugState;
  byeolttongi: ByeolttongiState;
}

export interface FriendReaction<S extends string = string> {
  state: S;
  line: string;
  sfx: SfxId;
  /** 재생 속도(=음높이) */
  rate?: number;
  /** 이 시간(ms)이 지나면 대기로 돌아간다 */
  hold: number;
}

export interface FriendDef<K extends FriendId = FriendId> {
  id: K;
  name: string;
  /** 한 줄 역할 (이름 아래) */
  role: string;
  /** 말풍선 말투 (버그버그는 오류 틴트) */
  tone: BubbleTone;
  /** 처음 말풍선 (서버 렌더) */
  hello: string;
  /** 화면에 들어올 때 인사 포즈 (말풍선은 hello를 다시 타자) */
  greet: { state: FriendStates[K]; hold: number };
  /** 누를 때마다 순서대로 (같은 반응이 연달아 나오지 않음) */
  reactions: readonly FriendReaction<FriendStates[K]>[];
}

const PYBAEM: FriendDef<'pybaem'> = {
  id: 'pybaem',
  name: '파이뱀',
  role: '답 대신 힌트를 주는 선생님',
  tone: 'tutor',
  hello: '막히면 나를 불러! 힌트를 줄게.',
  greet: { state: 'wave', hold: 1600 },
  reactions: [
    {
      state: 'teach',
      line: '정답은 비밀! 대신 생각할 힌트를 줄게.',
      sfx: 'blip',
      hold: 2400,
    },
    {
      state: 'think',
      line: '음… 어디서 막혔는지 같이 볼까?',
      sfx: 'blip',
      rate: 0.9,
      hold: 2400,
    },
    {
      state: 'happy',
      line: '스스로 풀면 기분이 최고야!',
      sfx: 'tap',
      rate: 1.2,
      hold: 1900,
    },
    {
      state: 'encourage',
      line: '힌트는 세 단계까지 있어. 천천히 해 보자.',
      sfx: 'blip',
      rate: 1.1,
      hold: 2400,
    },
  ],
};

const BUGBUG: FriendDef<'bugbug'> = {
  id: 'bugbug',
  name: '버그버그',
  role: '틀린 곳을 알려 주는 말썽쟁이',
  tone: 'bug',
  hello: '히히, 코드에 숨은 버그는 내가 찾아!',
  greet: { state: 'appear', hold: 1400 },
  reactions: [
    {
      state: 'search',
      line: '돋보기로 샅샅이… 어디가 틀렸을까?',
      sfx: 'bug',
      hold: 2400,
    },
    {
      state: 'found',
      line: '찾았다! 에러 메시지를 잘 읽어 봐.',
      sfx: 'bug',
      rate: 1.2,
      hold: 1900,
    },
    {
      state: 'hit',
      line: '아야! 벌써 고쳤어?',
      sfx: 'tap',
      rate: 0.85,
      hold: 1700,
    },
    {
      state: 'makeup',
      line: '버그를 고치면 우린 친구야!',
      sfx: 'correct',
      hold: 2200,
    },
  ],
};

const BYEOLTTONGI: FriendDef<'byeolttongi'> = {
  id: 'byeolttongi',
  name: '별똥이',
  role: '퀘스트를 깨면 XP를 가져오는 요정',
  tone: 'tutor',
  hello: '반짝! 퀘스트를 깨면 날아갈게.',
  greet: { state: 'flyIn', hold: 1900 },
  reactions: [
    {
      state: 'sparkle',
      line: '반짝반짝! 기분이 좋아지지?',
      sfx: 'star',
      hold: 2600,
    },
    {
      state: 'land',
      line: '쿵! 착지 성공!',
      sfx: 'tap',
      rate: 0.9,
      hold: 1100,
    },
    {
      state: 'flyIn',
      line: '퀘스트를 깨면 XP를 들고 슝 날아와!',
      sfx: 'coin',
      hold: 1900,
    },
  ],
};

export const FRIENDS = [PYBAEM, BUGBUG, BYEOLTTONGI] as const;

/** 인사 간격 (한 명씩) */
export const GREET_STAGGER_MS = 520;

export interface ReactionCycle<S extends string> {
  next(): FriendReaction<S>;
}

/** 반응을 순서대로 돌린다 */
export function createReactionCycle<S extends string>(
  reactions: readonly FriendReaction<S>[],
): ReactionCycle<S> {
  let i = 0;
  return {
    next() {
      const r = reactions[i % reactions.length];
      i += 1;
      return r;
    },
  };
}
