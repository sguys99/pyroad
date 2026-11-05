// 콘텐츠 원본 → YAML 텍스트. 여러 줄 문자열은 블록(|)으로 써서 코드·힌트를 그대로 읽을 수 있게 합니다.
// 쓴 결과를 다시 읽어 원래 값과 같은지 확인하므로(`assertRoundTrip`) 문자 하나라도 달라지면 오류입니다.

import { isDeepStrictEqual } from 'node:util';
import { Document, isMap, isScalar, parse, Scalar, visit } from 'yaml';

import type { Quest, Stage, World } from './schema';

// singleQuote: 저장소 Prettier 설정(singleQuote: true)과 같은 따옴표를 써서 `prettier --write .` 이 파일을 바꾸지 않게 함
const STRINGIFY = {
  lineWidth: 0,
  blockQuote: 'literal' as const,
  singleQuote: true,
};

function toDocument(value: object): Document {
  const doc = new Document(value);
  // 줄바꿈이 있는 문자열만 블록 리터럴로. 나머지는 라이브러리 기본값(필요할 때만 따옴표)
  visit(doc, {
    Scalar(_, node) {
      if (typeof node.value === 'string' && node.value.includes('\n')) {
        node.type = Scalar.BLOCK_LITERAL;
      }
    },
  });
  return doc;
}

function commentKey(doc: Document, key: string, comment: string) {
  if (!isMap(doc.contents)) return;
  const pair = doc.contents.items.find(
    (p) => isScalar(p.key) && p.key.value === key,
  );
  if (pair && isScalar(pair.key)) pair.key.commentBefore = comment;
}

function finish(doc: Document, original: unknown): string {
  const text = doc.toString(STRINGIFY);
  assertRoundTrip(text, original);
  return text;
}

export function assertRoundTrip(text: string, original: unknown): void {
  const back = parse(text) as unknown;
  if (!isDeepStrictEqual(back, JSON.parse(JSON.stringify(original)))) {
    throw new Error('YAML 로 썼다가 다시 읽은 값이 원래 값과 달라요');
  }
}

export function questToYaml(quest: Quest, heading: string): string {
  const doc = toDocument(quest);
  doc.commentBefore = ` ${heading}\n 작성 안내: content/README.md`;
  commentKey(
    doc,
    'prompt',
    ' 공개: 학생 화면으로 그대로 내려갑니다 (quests.prompt_skeleton). 정답을 쓰지 마세요',
  );
  commentKey(
    doc,
    'answer',
    ' 정답: 서버만 읽습니다 (quest_answer_keys). validation.type 만 공개(quests.validation_type)',
  );
  if (quest.quest_type === 'project') {
    commentKey(
      doc,
      'steps',
      ' 단계별 prompt 는 공개(prompt_skeleton.steps[]), answer 는 정답(quest_answer_keys.steps[])',
    );
  }
  return finish(doc, quest);
}

export function stageToYaml(stage: Stage): string {
  const doc = toDocument(stage);
  doc.commentBefore = ` 스테이지 ${stage.order}: ${stage.title} (stages 테이블)`;
  return finish(doc, stage);
}

export function worldToYaml(world: World): string {
  const doc = toDocument(world);
  doc.commentBefore =
    ` 월드 ${world.order}: ${world.title}\n` +
    ' 지금은 검증만 합니다. P1-08 에서 worlds 테이블이 생기면 빌드가 slug 기준으로 업서트합니다';
  return finish(doc, world);
}
