import { describe, it, expect } from 'vitest';
import {
  WORLD2_GLOSSARY,
  buildLevelSection,
  findGlossaryTerms,
  glossaryFallbackLines,
} from '../glossary';
import {
  buildCodeFeedbackPrompt,
  buildConceptExplainPrompt,
  buildFreeQuestionPrompt,
  buildHintPrompt,
  buildQuestIntroPrompt,
} from '../prompts';
import { conceptFallback } from '@/app/api/tutor/helpers';

describe('WORLD2_GLOSSARY', () => {
  it('모든 용어에 뜻·예시·찾을 낱말이 있다', () => {
    expect(WORLD2_GLOSSARY.length).toBeGreaterThanOrEqual(20);
    for (const g of WORLD2_GLOSSARY) {
      expect(g.meaning.trim()).not.toBe('');
      expect(g.example.trim()).not.toBe('');
      expect(g.match.length).toBeGreaterThan(0);
    }
  });
});

describe('findGlossaryTerms', () => {
  it('퀘스트 글에서 용어를 찾는다 (대소문자 무시)', () => {
    const terms = findGlossaryTerms('딕셔너리 만들기. .get으로 꺼내기');
    expect(terms.map((g) => g.term)).toEqual(['딕셔너리', '.get']);
    expect(findGlossaryTerms('Try / Except').map((g) => g.term)).toContain(
      'try / except',
    );
  });

  it('관련 없는 글이면 비고, 최대 개수를 지킨다', () => {
    expect(findGlossaryTerms('print로 인사하기')).toEqual([]);
    expect(
      findGlossaryTerms('슬라이싱 인덱스 메서드 split 딕셔너리 정렬', 2),
    ).toHaveLength(2);
  });
});

describe('buildLevelSection', () => {
  it('1월드·모름은 빈 문자열', () => {
    expect(buildLevelSection(undefined, '딕셔너리')).toBe('');
    expect(buildLevelSection(1, '딕셔너리')).toBe('');
  });

  it('2월드는 깊이 안내와 맞는 용어 뜻풀이', () => {
    const s = buildLevelSection(2, '중첩 반복으로 격자 그리기');
    expect(s).toContain('## 학생 수준');
    expect(s).toContain('2월드');
    expect(s).toContain('try/except');
    expect(s).toContain('중첩 반복: 반복 안에 또 반복');
    expect(s.endsWith('\n\n')).toBe(true);
  });
});

describe('프롬프트의 월드 수준', () => {
  const base = {
    questTitle: '이름표 상자',
    stageTitle: '딕셔너리 도서관',
    themeName: 'code_sea',
    topic: '딕셔너리 만들기',
    learningGoals: ['키와 값을 짝지어 저장한다'],
    storyContext: '배경',
    exerciseDescription: '과일 값을 딕셔너리로',
    studentCode: 'x = {}',
    hintLevel: 1 as const,
    hintReference: '',
    stdout: '',
    stderr: "KeyError: 'apple'",
    passed: false,
    expectedOutput: '',
    question: '키가 뭐예요?',
  };
  const builders = [
    buildQuestIntroPrompt,
    buildHintPrompt,
    buildCodeFeedbackPrompt,
    buildConceptExplainPrompt,
    buildFreeQuestionPrompt,
  ];

  it.each(builders)('%o: 1월드는 worldOrder 없을 때와 똑같다', (build) => {
    expect(build({ ...base, worldOrder: 1 })).toBe(build(base));
    expect(build(base)).not.toContain('학생 수준');
  });

  it.each(builders)('%o: 2월드는 지시 앞에 수준 안내', (build) => {
    const p = build({ ...base, worldOrder: 2 });
    const level = p.indexOf('## 학생 수준');
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(p.indexOf('## 지시'));
    expect(p).toContain('딕셔너리: 이름표(키)가 붙은 상자');
  });
});

describe('개념 저장된 답변의 용어', () => {
  it('2월드는 용어 뜻과 예시 한 줄을 붙인다', () => {
    const text = conceptFallback('딕셔너리 만들기', ['키와 값 짝짓기'], 2);
    expect(text).toContain('알아 두면 좋은 말:');
    expect(text).toContain('**딕셔너리**');
    expect(text).toContain('`pet = {"이름": "콩이", "나이": 3}`');
  });

  it('1월드는 예전과 같다', () => {
    expect(conceptFallback('딕셔너리', ['a'], 1)).toBe(
      conceptFallback('딕셔너리', ['a']),
    );
    expect(glossaryFallbackLines(1, '딕셔너리')).toEqual([]);
  });

  it('예시가 여러 줄이면 첫 줄만', () => {
    const lines = glossaryFallbackLines(2, 'try except');
    expect(lines.join('\n')).toContain('`try:`');
  });
});
