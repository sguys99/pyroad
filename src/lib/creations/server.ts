import 'server-only';

import { gunzipSync, gzipSync } from 'node:zlib';
import { z } from 'zod';
import { MODERATION_MESSAGES, moderateText } from '@/lib/moderation/filter';
import { unicodeFold } from '@/lib/moderation/normalize';
import { TURTLE_MAX_COMMANDS } from '@/lib/pyodide/constants';
import {
  CREATION_CODE_MAX_BYTES,
  CREATION_COMMANDS_GZ_MAX,
  CREATION_THUMBNAIL_MAX,
  CREATION_TITLE_MAX,
  CREATION_TRANSCRIPT_MAX_CHARS,
  CREATION_TRANSCRIPT_MAX_ROWS,
  CREATION_TRANSCRIPT_ROW_MAX,
} from './limits';

/**
 * 작품 저장 검사 (P11-06, 서버 전용). 화면이 보낸 값은 믿지 않고 여기서 다시 본다:
 * 모양·길이(zod) → turtle 명령 풀어서 검사·다시 압축 → 썸네일 PNG 머리·크기 → 글자 검사(금칙어·개인정보).
 * DB CHECK(00054)가 크기·머리를 한 번 더 막는다
 */

const TITLE = z
  .string()
  .transform((s) => s.replace(/\s+/g, ' ').trim())
  .refine((s) => s.length > 0, '작품 이름을 적어 줘요.')
  .refine(
    (s) => Array.from(s).length <= CREATION_TITLE_MAX,
    `작품 이름은 ${CREATION_TITLE_MAX}자까지예요.`,
  );

const TRANSCRIPT = z
  .array(
    z.object({
      text: z.string().max(CREATION_TRANSCRIPT_ROW_MAX),
      answer: z.literal(true).optional(),
    }),
  )
  .min(1)
  .max(CREATION_TRANSCRIPT_MAX_ROWS)
  .refine(
    (rows) =>
      rows.reduce((n, r) => n + r.text.length, 0) <=
      CREATION_TRANSCRIPT_MAX_CHARS,
  );

/** POST /api/creations 의 meta 칸 (multipart) */
export const creationMetaSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('drawing'),
    title: TITLE,
    questId: z.string().uuid().nullable().default(null),
    code: z.string(),
    transcript: TRANSCRIPT.optional(),
  }),
  z.object({
    kind: z.literal('conversation'),
    title: TITLE,
    questId: z.string().uuid().nullable().default(null),
    code: z.string(),
    transcript: TRANSCRIPT,
  }),
]);
export type CreationMeta = z.infer<typeof creationMetaSchema>;

/** PATCH /api/creations/{id} */
export const creationPatchSchema = z
  .object({
    title: TITLE.optional(),
    showCode: z.boolean().optional(),
    visibility: z.enum(['private', 'public']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0);

export function codeTooLong(code: string) {
  return Buffer.byteLength(code, 'utf8') > CREATION_CODE_MAX_BYTES;
}

const OPS = new Set([
  'n',
  'm',
  'j',
  'r',
  's',
  'bf',
  'ef',
  'd',
  'sp',
  'cs',
  'w',
  'c',
  'C',
  'bg',
  'tr',
  'u',
  'v',
  't',
  'f', // 프레임 끝 (P11-04 게임 루프)
]);
/** 풀었을 때 크기 상한 (zip 폭탄 막기). 명령 5만 개 × 평균 40바이트보다 넉넉히 */
const RAW_MAX = 4 * 1024 * 1024;

export type ParsedCommands =
  | { ok: true; gz: Buffer; count: number; texts: string[] }
  | { ok: false; message: string };

const TOO_BIG = '그림이 너무 커서 저장할 수 없어요. 명령을 조금 줄여 볼까요?';

/**
 * turtle 명령 gzip 검사: 풀기(크기 상한) → JSON 배열 · 명령 5만 개 이하 · 아는 명령만 → 다시 압축(남는 꼬리·여러 덩어리 없앰).
 * texts = 그림에 쓴 글씨(`write`)·작품 이름(`title`) — 공개할 때 금칙어·개인정보 검사 (갤러리에서 남의 화면에 그려짐)
 */
export function parseCommandsGz(input: Uint8Array): ParsedCommands {
  if (input.byteLength > CREATION_COMMANDS_GZ_MAX)
    return { ok: false, message: TOO_BIG };
  let commands: unknown;
  try {
    const raw = gunzipSync(input, { maxOutputLength: RAW_MAX });
    commands = JSON.parse(raw.toString('utf8'));
  } catch {
    return {
      ok: false,
      message: '그림을 읽지 못했어요. 다시 실행한 뒤 저장해 줘요.',
    };
  }
  if (
    !Array.isArray(commands) ||
    commands.length === 0 ||
    commands.length > TURTLE_MAX_COMMANDS
  )
    return { ok: false, message: '저장할 그림이 없거나 너무 많아요.' };
  const texts: string[] = [];
  for (const c of commands) {
    if (!Array.isArray(c) || typeof c[0] !== 'string' || !OPS.has(c[0]))
      return {
        ok: false,
        message: '그림을 읽지 못했어요. 다시 실행한 뒤 저장해 줘요.',
      };
    if (c[0] === 'w' && typeof c[2] === 'string') texts.push(c[2]);
    if (c[0] === 't' && typeof c[1] === 'string') texts.push(c[1]);
  }
  const gz = gzipSync(JSON.stringify(commands), { level: 9 });
  if (gz.byteLength > CREATION_COMMANDS_GZ_MAX)
    return { ok: false, message: TOO_BIG };
  return { ok: true, gz, count: commands.length, texts };
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** 썸네일: PNG 머리 + 크기만 (그림은 우리 렌더러가 만든 것. 다른 파일 형식은 받지 않음) */
export function isThumbnailPng(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 67 &&
    bytes.byteLength <= CREATION_THUMBNAIL_MAX &&
    PNG_MAGIC.every((b, i) => bytes[i] === b)
  );
}

/** PostgREST bytea 값 ↔ Buffer */
export const toBytea = (b: Uint8Array) =>
  `\\x${Buffer.from(b).toString('hex')}`;
export const fromBytea = (s: string) =>
  Buffer.from(s.startsWith('\\x') ? s.slice(2) : s, 'hex');

/**
 * 출품 전 개인정보 지킴이 (제안 J ③, world3.md §7): 금칙어 검사의 개인정보 규칙에 더해
 * 숫자 9자리 이상 연속 · 010 으로 시작하는 숫자열 · 이메일 모양. 걸리면 공개하지 않는다
 */
const EXTRA_PERSONAL_INFO = [
  /\d{9,}/,
  /(?<!\d)010(?:[\s.\-_]*\d){4,}/,
  /[^\s@]+\s*@\s*[^\s@]+\.[a-z]{2,}/i,
];

export function hasExtraPersonalInfo(text: string) {
  const folded = unicodeFold(text);
  return EXTRA_PERSONAL_INFO.some((re) => re.test(folded));
}

export type CreationField = 'title' | 'transcript' | 'drawing' | 'code';

const FIELD_LABEL: Record<CreationField, string> = {
  title: '작품 이름',
  transcript: '대화 기록',
  drawing: '그림 속 글씨',
  code: '코드',
};

/**
 * 작품 글자 검사. 비공개 저장은 금칙어만 막고(내 작품함 — 전화번호부 같은 연습 코드도 저장할 수 있게),
 * 공개(publish)는 개인정보까지 막는다. 무엇이 걸렸는지 단어는 알려 주지 않는다(우회 방법을 가르치지 않게)
 */
export function checkCreationTexts(
  fields: Partial<Record<CreationField, string[]>>,
  { publish }: { publish: boolean },
): { ok: true } | { ok: false; field: CreationField; message: string } {
  for (const [field, texts] of Object.entries(fields) as [
    CreationField,
    string[] | undefined,
  ][]) {
    for (const text of texts ?? []) {
      const r = moderateText(text);
      const personal =
        !r.ok && (r.category === 'personal_info' || r.category === 'contact');
      if (!r.ok && (publish || !personal))
        return {
          ok: false,
          field,
          message: personal
            ? `${FIELD_LABEL[field]}에 전화번호나 이메일 같은 개인정보가 있는 것 같아요. 이 부분을 지우고 다시 올려 줘요.`
            : `${FIELD_LABEL[field]}: ${MODERATION_MESSAGES[r.category]}`,
        };
      if (publish && hasExtraPersonalInfo(text))
        return {
          ok: false,
          field,
          message: `${FIELD_LABEL[field]}에 긴 숫자나 이메일 모양이 있어요. 진짜 번호나 주소라면 이 부분을 지우고 다시 올려 줘요.`,
        };
    }
  }
  return { ok: true };
}
