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
- 응답은 간결하되, 필요한 내용은 빠짐없이 포함하세요
- 응답은 반드시 완결된 문장으로 끝내세요. 중간에 끊기지 않도록 하세요`;

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

interface ProjectGuideParams {
  projectTitle: string;
  storyContext: string;
  currentStep: number;
  totalSteps: number;
  stepGoal: string;
  previousCode: string;
}

export function buildProjectGuidePrompt(params: ProjectGuideParams): string {
  const isFirstStep = params.currentStep === 1;

  return `## 컨텍스트
- 프로젝트: ${params.projectTitle}
- 스토리 배경: ${params.storyContext}
- 현재 단계: ${params.currentStep} / ${params.totalSteps}
- 이 단계 목표: ${params.stepGoal}
${params.previousCode ? `- 이전까지 작성한 코드:\n\`\`\`python\n${params.previousCode}\n\`\`\`` : '- (첫 단계입니다)'}

## 지시
${
  isFirstStep
    ? `1. 프로젝트 왕국에 도착한 것을 축하하고, 프로젝트 소개를 해주세요
2. 이 프로젝트에서 만들 "숫자 맞추기 게임"을 재미있게 설명해주세요
3. 첫 번째 단계 목표(${params.stepGoal})를 안내하세요
4. 학생이 직접 시도하도록 유도하며 마무리하세요`
    : `1. 이전 단계까지 잘 진행한 것을 칭찬하세요
2. 이 단계에서 새로 추가할 기능(${params.stepGoal})을 설명하세요
3. 구체적인 코딩 방향을 안내하되, 완성 코드는 주지 마세요
4. 학생이 직접 시도하도록 유도하세요`
}`;
}

interface StageSummaryParams {
  stageTitle: string;
  stageOrder: number;
  concepts: string[];
  nextStageTitle?: string;
}

export function buildStageSummaryPrompt(params: StageSummaryParams): string {
  const conceptsList = params.concepts.map((c, i) => `${i + 1}. ${c}`).join('\n');

  return `## 컨텍스트
- 완료한 스테이지: ${params.stageTitle} (${params.stageOrder}단계)
- 이 스테이지에서 배운 개념들:
${conceptsList}
${params.nextStageTitle ? `- 다음 스테이지: ${params.nextStageTitle}` : '- 이것이 마지막 학습 스테이지입니다!'}

## 지시
학생이 이 스테이지의 모든 퀘스트를 완료했어요! 다음을 포함하여 정리해주세요:
1. 스테이지 완료를 크게 축하해주세요
2. 배운 개념들을 일상생활 비유와 함께 각각 한 줄로 정리해주세요
3. "오늘 배운 핵심 키워드"를 5개 이내로 정리해주세요
${params.nextStageTitle ? `4. 다음 스테이지 "${params.nextStageTitle}"에서 배울 내용에 대한 기대감을 심어주세요` : '4. 전체 학습 스테이지를 완료한 것을 특별히 축하해주세요'}`;
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
