import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  REPORT_REASONS,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/board/limits';
import {
  BOARD_MESSAGES,
  boardError,
  boardServerError,
  isUuid,
  readJsonObject,
} from '@/lib/board/server';

// 신고 (P1-18): report_board_content(service_role 전용, 00014)가 저장·중복 확인·자동 숨김을 한 트랜잭션으로.
// board_reports 는 클라이언트가 읽지도 쓰지도 못함. 신고자 id 는 getUser() 로 확인한 값만 넘김
type ReportResult = {
  result: 'reported' | 'already' | 'own' | 'not_found';
  hidden: boolean;
};

const TARGET_TYPES: readonly ReportTargetType[] = ['post', 'comment'];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return boardError(401, BOARD_MESSAGES.unauthorized);
  }

  const body = await readJsonObject(request);
  const targetType = body?.target_type;
  const targetId = body?.target_id;
  const reason = body?.reason;
  if (
    !body ||
    typeof targetType !== 'string' ||
    !TARGET_TYPES.includes(targetType as ReportTargetType) ||
    !isUuid(targetId)
  ) {
    return boardError(400, BOARD_MESSAGES.badRequest, { code: 'validation' });
  }
  if (
    typeof reason !== 'string' ||
    !REPORT_REASONS.includes(reason as ReportReason)
  ) {
    return boardError(400, BOARD_MESSAGES.reportReasonRequired, {
      code: 'validation',
      field: 'reason',
    });
  }

  const { data, error } = await createAdminClient().rpc(
    'report_board_content',
    {
      p_reporter_id: user.id,
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
    },
  );
  if (error || !data)
    return boardServerError(error ?? new Error('결과 없음'), 'report');

  const { result } = data as unknown as ReportResult;
  switch (result) {
    case 'reported':
      return NextResponse.json({
        ok: true,
        status: 'reported',
        message: BOARD_MESSAGES.reportDone,
      });
    case 'already':
      return NextResponse.json({
        ok: true,
        status: 'already',
        message: BOARD_MESSAGES.reportAlready,
      });
    case 'own':
      return boardError(400, BOARD_MESSAGES.reportOwn, { code: 'forbidden' });
    default:
      return boardError(
        404,
        targetType === 'post'
          ? BOARD_MESSAGES.postNotFound
          : BOARD_MESSAGES.commentNotFound,
        {
          code: 'not_found',
        },
      );
  }
}
