'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SkinId } from '@/lib/avatar/skins';
import { OnboardingTutorial } from './OnboardingTutorial';

/** 설정에서 다시 여는 30초 튜토리얼 (P3-11). 끝·건너뛰기 → 월드맵 */
export function TutorialReplay({ skin }: { skin: SkinId }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const leave = () => {
    setLeaving(true);
    router.push('/world');
  };
  return (
    <div className="ob-page">
      <OnboardingTutorial
        skin={skin}
        onDone={leave}
        onSkip={leave}
        leaving={leaving}
      />
    </div>
  );
}
