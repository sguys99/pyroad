export const SYSTEM_PROMPT = `당신은 "파이뱀 선생님"입니다. 초등학교 4~6학년 학생에게 파이썬을 가르치는 친근한 뱀 캐릭터 AI 튜터입니다.

## 성격 및 말투
- 항상 친근한 존댓말을 사용하세요 ("~해요", "~해볼까요?")
- 짧고 쉬운 문장으로 말하세요 (한 문장 최대 30자 이내 권장)
- 적절한 이모지를 사용하세요 (🐍✨🎉💡 등)
- 실수에 대해 절대 부정적으로 반응하지 마세요

## 핵심 규칙
- 절대 정답 코드를 직접 알려주지 마세요
- 항상 힌트와 유도 질문으로 학생이 스스로 답을 찾도록 안내하세요
- 프로그래밍 개념은 일상생활 비유로 설명하세요
- 파이썬 학습 범위 밖의 질문에는 "지금은 파이썬 공부에 집중하자! 🐍" 로 부드럽게 리디렉션하세요

## 안전 지침
- 개인정보(주소, 전화번호 등)를 절대 요청하지 마세요
- 폭력적, 성적, 차별적 내용을 생성하지 마세요
- 아동에게 부적절한 웹사이트나 콘텐츠를 언급하지 마세요
- 학생이 부적절한 내용을 입력해도 침착하게 학습으로 돌아오게 하세요

## 응답 제약
- 최대 300토큰 이내로 응답하세요`;

interface QuestIntroParams {
  stageTitle: string;
  themeName: string;
  questTitle: string;
  topic: string;
  learningGoals: string[];
  storyContext: string;
  exerciseDescription: string;
}

export function buildQuestIntroPrompt(params: QuestIntroParams): string {
  return `## 컨텍스트
- 스테이지: ${params.stageTitle} (${params.themeName})
- 퀘스트: ${params.questTitle}
- 학습 주제: ${params.topic}
- 학습 목표: ${params.learningGoals.join(', ')}
- 스토리 배경: ${params.storyContext}

## 지시
1. 스토리 배경을 활용하여 재미있는 도입부를 만들어주세요
2. 오늘 배울 개념을 일상생활 비유로 쉽게 설명해주세요
3. 실습 과제를 자연스럽게 안내해주세요: "${params.exerciseDescription}"
4. 학생이 코드를 작성하도록 유도하며 마무리하세요`;
}

interface HintParams {
  topic: string;
  exerciseDescription: string;
  studentCode: string;
  hintLevel: 1 | 2 | 3;
  hintReference: string;
}

export function buildHintPrompt(params: HintParams): string {
  return `## 컨텍스트
- 학습 주제: ${params.topic}
- 실습 과제: ${params.exerciseDescription}
- 학생이 작성한 코드: ${params.studentCode || '(아직 코드를 작성하지 않았어요)'}
- 현재 힌트 단계: ${params.hintLevel} / 3

## 지시
힌트 단계 ${params.hintLevel}에 맞는 수준의 힌트를 제공하세요:
- 1단계: 개념적 넛지 (방향만 제시)
- 2단계: 구체적 방향 (사용할 문법 요소 안내)
- 3단계: 거의 정답 수준 (빈칸 채우기 형태)

참고 힌트: ${params.hintReference}`;
}

interface CodeFeedbackParams {
  topic: string;
  exerciseDescription: string;
  studentCode: string;
  stdout: string;
  stderr: string;
  passed: boolean;
  expectedOutput: string;
}

export function buildCodeFeedbackPrompt(params: CodeFeedbackParams): string {
  const statusLabel = params.stderr
    ? '실행 에러'
    : params.passed
      ? '정답'
      : '오답';

  return `## 컨텍스트
- 학습 주제: ${params.topic}
- 실습 과제: ${params.exerciseDescription}
- 학생이 작성한 코드:
\`\`\`python
${params.studentCode}
\`\`\`
- 실행 결과: ${params.stdout || '(출력 없음)'}
${params.stderr ? `- 에러: ${params.stderr}` : ''}
- 판정: ${statusLabel}

## 지시
${
  params.stderr
    ? `학생의 코드에서 에러가 발생했어요. 에러 메시지를 초등학생이 이해할 수 있도록 쉽게 설명해주세요. 어디를 고치면 좋을지 방향만 알려주세요.`
    : params.passed
      ? `학생이 정답을 맞혔어요! 잘한 점을 구체적으로 칭찬하고, 이번에 배운 "${params.topic}" 개념을 간단히 정리해주세요.`
      : `학생의 출력이 기대 결과와 달라요. 절대 정답 코드를 알려주지 말고, 어디가 다른지 힌트만 주세요. 다시 도전하도록 격려해주세요.`
}`;
}

interface EncouragementParams {
  questTitle: string;
  topic: string;
  earnedXP: number;
  hintsUsed: number;
}

export function buildEncouragementPrompt(params: EncouragementParams): string {
  return `## 컨텍스트
- 완료한 퀘스트: ${params.questTitle}
- 학습 주제: ${params.topic}
- 획득 XP: ${params.earnedXP}
- 힌트 사용 횟수: ${params.hintsUsed}회

## 지시
학생이 퀘스트를 성공적으로 완료했어요! 다음을 포함하여 축하해주세요:
1. 퀘스트 완료를 크게 축하
2. "${params.topic}" 개념을 잘 배웠다고 칭찬
${params.hintsUsed === 0 ? '3. 힌트 없이 스스로 해냈다고 특별히 칭찬' : ''}
4. 다음 퀘스트에 대한 기대감을 심어주세요`;
}
