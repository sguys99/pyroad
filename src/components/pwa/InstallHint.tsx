'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Toast, ToastRegion } from '@/components/ui/toast';
import {
  dismissHint,
  loadHintState,
  recordVisit,
  saveHintState,
  shouldShowWorldHint,
} from '@/lib/pwa/install';
import { AppIconMini, IosInstallGuide } from './IosInstallGuide';
import { useInstallFlow } from './useInstallFlow';

/** 화면이 자리 잡은 뒤 쪽지를 띄우는 간격 (들어오는 연출과 겹치지 않게) */
export const INSTALL_HINT_DELAY_MS = 1_500;

/**
 * 월드맵 "홈 화면에 추가" 쪽지 (P4-11). 공통 토스트(화면 아래 가운데, 저절로 닫히지 않음) + "추가하기" 버튼.
 *
 * - 서로 다른 날 3번째로 월드맵을 열었을 때부터, 설치할 수 있는 기기(안드로이드 설치 창이 있음·iOS)에서만
 * - 닫거나(✕) 안내를 마치면 30일 동안 다시 띄우지 않는다. 기기 저장(localStorage)만 쓰고 서버에 보내지 않는다
 * - 소리 없음(아이가 누른 버튼만 효과음). 설정 화면 "홈 화면에 추가"에서는 언제든 다시 할 수 있다
 */
export function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const snooze = useCallback(() => {
    setVisible(false);
    saveHintState(dismissHint(loadHintState()));
  }, []);
  const flow = useInstallFlow('world', snooze);

  // 오늘 방문을 센다 (같은 날은 한 번). 판단은 기기 정보가 나온 뒤
  useEffect(() => {
    saveHintState(recordVisit(loadHintState()));
    const t = setTimeout(() => setReady(true), INSTALL_HINT_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || flow.platform === null) return;
    setVisible(shouldShowWorldHint(loadHintState(), flow.action));
  }, [ready, flow.platform, flow.action]);

  return (
    <>
      <ToastRegion label="홈 화면에 추가 안내">
        {visible && (
          <Toast
            icon={<AppIconMini size={28} />}
            duration={0}
            onClose={snooze}
            closeLabel="다음에 할게요"
            action={
              <Button size="sm" variant="primary" onClick={flow.start}>
                추가하기
              </Button>
            }
            data-testid="install-hint"
          >
            파이뱀을 홈 화면에 데려가면 바로 모험을 열 수 있어요.
          </Toast>
        )}
      </ToastRegion>
      <IosInstallGuide
        open={flow.guideOpen}
        onOpenChange={flow.onGuideOpenChange}
        safari={flow.iosSafari}
      />
    </>
  );
}
