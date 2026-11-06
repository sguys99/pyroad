import { describe, expect, it } from 'vitest';
import bannedWords from '../data/banned-words.json';
import personalInfoPatterns from '../data/personal-info-patterns.json';
import {
  MODERATION_MESSAGES,
  moderateFields,
  moderateText,
  type ModerationCategory,
} from '../filter';

// 운영 중 오탐이 보고되면 이 목록에 문장을 추가하고 규칙을 고칩니다 (data/banned-words.json $comment)
const NORMAL_SENTENCES = [
  // 일상·학습
  '안녕하세요! 파이썬 처음 배워요',
  '오늘 퀘스트 3개나 깼어요 ㅋㅋㅋ',
  '이 문제 진짜 어려워요 ㅠㅠ 도와주세요',
  '감사합니다!! ㄱㅅㄱㅅ',
  '파이썬 진짜 재밌다 미쳤다',
  '미친 듯이 재밌어요',
  '개발자가 되고 싶어요',
  '우리 반 친구들이랑 같이 해요',
  '저는 3학년이에요',
  '저는 3학년 2반이에요',
  '학교 숙제로 파이썬 해요',
  '레벨 10 달성! 퀘스트 1-5 완료',
  '점수가 1000점이에요',
  '2025년 11월 4일에 처음 시작했어요',
  '1 2 3 4 5 6 7 8 9 10',
  '물고기는 어디 살아요?',
  '전화번호부 만드는 프로그램 질문이요',
  '주소록 프로그램을 만들고 싶어요',
  '카카오 프렌즈 좋아해요',
  '마인크래프트 좋아하는 사람?',
  '로블록스 재밌어요',
  '결과 사진 보여줘',
  '직접 해 보니까 알겠어요',
  '코드를 직접 볼래?',
  '다음 퀘스트에서 만나요!',
  '선생님 아이디어 좋아요',
  '파이썬 공식 문서 보고 공부했어요',
  // 금칙어를 품은 일상어
  '시발점부터 다시 해 볼게요',
  '졸라맨 그리기 했어요',
  '엄마를 졸라서 컴퓨터를 샀어요',
  '불이 꺼져 있어요',
  '컴퓨터가 꺼져서 저장을 못 했어요',
  '고양이가 새끼를 낳았어요',
  '새끼손가락 다쳤어',
  '보지 말고 직접 풀어 보세요',
  '정답을 보지 않고 풀었어요',
  '늦게 자지 마',
  '가자 위로 올라가자',
  '수박씨 발라 먹어',
  '지금은 21세기야',
  '시바견 귀여워',
  '보존 나무',
  '투병 신청',
  '병아리 신기해',
  '엿을 먹었어요',
  '껌을 씹었어요',
  '좀 더 쉬운 문제 없나요?',
  '조금만 더 해 보자',
  '수업 중 3반 친구가 알려 줬어요',
  // 된소리를 접으면 금칙어와 같아지는 일상어 (data tense 목록)
  '게임에서 진다고 울지 마',
  '공을 가진다',
  '이 코드 진짜 멋진다',
  '이번엔 우리 팀이 이긴다',
  '해가 진다',
  '책임을 진다',
  '전을 지진다',
  '살이 찐다고 엄마가 말했어요',
  '가방을 뒤진다',
  '고양이를 쫒아가요',
  '술래가 쫒아와서 도망쳤어',
  '십년 후에 나는 개발자',
  '이십년 뒤에 만나',
  '이십세기 소년',
  '시장게임 재밌어요',
  '달달이 간식 먹었어',
  '등신대 사진 찍었어',
  '팔등신 캐릭터 그리기',
  '한강간다 신난다',
  // 코드
  'for i in range(10): print(i)',
  "print('안녕하세요!')",
  'def add(a, b):\n    return a + b',
  'while True:\n    print("무한 반복!")',
  '@staticmethod',
  'x = [0, 1, 0, 1, 1, 0, 1, 0, 1, 1]',
  'bin(10) = 0b1010, 01011010110',
  'nums = [10, 20, 30, 40]',
  'user_id = 1234',
  'print(3.14 * 2)',
  // 영어
  'has extra lives',
  'I like Python class',
  'Essex and Sussex',
  'shiitake mushroom',
];

const BAD: [string, ModerationCategory][] = [
  // 욕설 우회
  ['시발', 'profanity'],
  ['시 발', 'profanity'],
  ['시.발 진짜', 'profanity'],
  ['씨1발', 'profanity'],
  ['ㅅ발', 'profanity'],
  ['시ㅂ', 'profanity'],
  ['ㅅㅣㅂㅏㄹ', 'profanity'],
  ['씨이이발', 'profanity'],
  ['ㅅㅂ', 'profanity'],
  ['ㅆㅂ 뭐야', 'profanity'],
  ['이 문제 존나 어렵네', 'profanity'],
  ['조오온나 어렵네', 'profanity'],
  ['ㅈㄴ 어려워', 'profanity'],
  ['지랄하네', 'profanity'],
  ['개쌔끼', 'profanity'],
  ['닥쳐', 'profanity'],
  ['좆같네', 'profanity'],
  ['씹년', 'profanity'],
  ['씹새야', 'profanity'],
  ['f u c k', 'profanity'],
  ['sh1t', 'profanity'],
  ['ｓｈｉｔ', 'profanity'],
  ['tlqkf', 'profanity'],
  ['wtf', 'profanity'],
  // 비하
  ['병신', 'insult'],
  ['병 신아', 'insult'],
  ['ㅂㅅ', 'insult'],
  ['ㅄ', 'insult'],
  ['찐따 같아', 'insult'],
  ['찐 따 같아', 'insult'],
  ['찐1따', 'insult'],
  ['ㅉㅣㄴㄸㅏ', 'insult'],
  ['찐ㄸ', 'insult'],
  ['찌인따', 'insult'],
  ['진따', 'insult'],
  ['짱께', 'insult'],
  ['니애미', 'insult'],
  ['급식충', 'insult'],
  // 성적 표현
  ['야동', 'sexual'],
  ['섹스', 'sexual'],
  ['sex', 'sexual'],
  ['딸 딸 이', 'sexual'],
  // 개인정보
  ['내 번호 010-1234-5678', 'personal_info'],
  ['010 9876 5432로 연락해', 'personal_info'],
  ['01098765432', 'personal_info'],
  ['0 1 0 9 8 7 6 5 4 3 2', 'personal_info'],
  ['+82 10 9876 5432', 'personal_info'],
  ['０１０－９８７６－５４３２', 'personal_info'],
  ['공일공 구팔칠육 오사삼이', 'personal_info'],
  ['02-345-6789', 'personal_info'],
  ['전화번호 알려줘', 'personal_info'],
  ['연락처 좀 줘', 'personal_info'],
  ['kid@naver.com 으로 보내', 'personal_info'],
  ['kid 골뱅이 naver 점 com', 'personal_info'],
  ['kid(at)gmail(dot)com', 'personal_info'],
  ['우리 집 101동 1203호', 'personal_info'],
  ['햇살아파트 101동 살아', 'personal_info'],
  ['123-4번지', 'personal_info'],
  ['서울 강남구 역삼동 살아요', 'personal_info'],
  ['집 주소 알려줘', 'personal_info'],
  ['너 어디 살아?', 'personal_info'],
  ['한빛초등학교 3학년이에요', 'personal_info'],
  ['한빛초 3학년 2반', 'personal_info'],
  ['한빛초등학교 다녀요', 'personal_info'],
  ['3학년 2반 15번', 'personal_info'],
  // 외부 연락 유도
  ['카톡 아이디 알려줘', 'contact'],
  ['카카오톡 친추 해', 'contact'],
  ['오픈채팅 들어와', 'contact'],
  ['https://example.com 들어가 봐', 'contact'],
  ['www.example.com', 'contact'],
  ['open.kakao.com/o/abc', 'contact'],
  ['인스타 맞팔해요', 'contact'],
  ['디코 서버 들어와', 'contact'],
  ['로블록스 친추 해줘', 'contact'],
  ['내 아이디는 coolkid123', 'contact'],
  ['디엠 보내', 'contact'],
  ['실제로 만나자', 'contact'],
  ['얼굴 사진 보내줘', 'contact'],
];

describe('moderateText: 정상 문장은 통과 (오탐 없음)', () => {
  it.each(NORMAL_SENTENCES)('%s', (text) => {
    expect(moderateText(text)).toEqual({ ok: true });
  });
});

describe('moderateText: 걸려야 하는 문장', () => {
  it.each(BAD)('%s → %s', (text, category) => {
    const r = moderateText(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.category).toBe(category);
  });
});

describe('데이터 파일', () => {
  const wordLists = [
    ...Object.entries(bannedWords.words),
    ...Object.entries(bannedWords.tense),
    ...Object.entries(bannedWords.choseong),
  ] as [ModerationCategory, string[]][];

  it.each(
    wordLists.flatMap(([category, words]) =>
      words.map((w) => [w, category] as const),
    ),
  )('금칙어 대표형 %s 는 그 자체로 걸림 (%s)', (word, category) => {
    const r = moderateText(word);
    expect(r).toMatchObject({ ok: false, category });
  });

  it('허용 단어는 걸리지 않음', () => {
    for (const w of bannedWords.allow)
      expect(moderateText(w)).toEqual({ ok: true });
  });

  it('패턴 id 는 겹치지 않고, 카테고리는 personal_info·contact', () => {
    const ids = personalInfoPatterns.patterns.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of personalInfoPatterns.patterns) {
      expect(['personal_info', 'contact']).toContain(p.category);
      expect(() => new RegExp(p.pattern, 'u')).not.toThrow();
    }
  });
});

describe('moderateFields·안내 문구', () => {
  it('처음 걸린 칸을 알려 줌', () => {
    expect(
      moderateFields({ title: '질문 있어요', content: '시 발' }),
    ).toMatchObject({
      ok: false,
      field: 'content',
      category: 'profanity',
    });
    expect(
      moderateFields({ title: '질문 있어요', content: undefined }),
    ).toEqual({ ok: true });
  });

  it('안내 문구는 어떤 단어가 걸렸는지 말하지 않고, 바꿔 쓰도록 이끔', () => {
    for (const message of Object.values(MODERATION_MESSAGES)) {
      expect(message).toMatch(/볼까요\?$/);
    }
    expect(MODERATION_MESSAGES.profanity).toContain('다른 말로 바꿔 볼까요?');
  });

  it('긴 글(2,000자)도 빠르게 검사', () => {
    const long = '파이썬 재밌어요 '.repeat(250);
    const t0 = performance.now();
    expect(moderateText(long)).toEqual({ ok: true });
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
