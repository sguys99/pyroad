'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageTransition } from '@/components/shared/PageTransition';
import { Button } from '@/components/ui/button';
import { PROVIDER_LABELS, type LLMProviderType } from '@/lib/tutor/providers/types';

interface SettingsData {
  available_providers: LLMProviderType[];
  current_provider: LLMProviderType;
  has_custom_keys: LLMProviderType[];
}

const PROVIDER_ICONS: Record<LLMProviderType, string> = {
  anthropic: 'A',
  openai: 'O',
  gemini: 'G',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [selected, setSelected] = useState<LLMProviderType>('anthropic');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data: SettingsData) => {
        setSettings(data);
        setSelected(data.current_provider);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);

    const body: Record<string, unknown> = { provider: selected };

    // 입력된 API 키가 있으면 전송
    const nonEmpty = Object.fromEntries(
      Object.entries(apiKeys).filter(([, v]) => v.length > 0),
    );
    if (Object.keys(nonEmpty).length > 0) {
      body.api_keys = nonEmpty;
    }

    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (res.ok) {
      setSaved(true);
      // 새 키가 추가됐으면 설정 다시 로드
      if (Object.keys(nonEmpty).length > 0) {
        const refreshed = await fetch('/api/settings').then((r) => r.json());
        setSettings(refreshed);
        setApiKeys({});
      }
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError('저장에 실패했어요. 다시 시도해주세요.');
    }
  }

  if (!settings) {
    return (
      <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
        <p className="text-center text-muted-foreground">불러오는 중...</p>
      </PageTransition>
    );
  }

  const allProviders: LLMProviderType[] = ['anthropic', 'openai', 'gemini'];

  return (
    <PageTransition className="mx-auto min-h-screen max-w-lg px-4 py-6">
      {/* 뒤로가기 */}
      <div className="mb-6">
        <Link href="/profile" className="text-sm text-primary underline">
          ← 프로필로
        </Link>
      </div>

      {/* 제목 */}
      <h1 className="mb-6 text-xl font-bold text-foreground">AI 튜터 설정</h1>

      {/* Provider 선택 카드 */}
      <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-foreground">AI 모델 선택</h2>
        <div className="flex flex-col gap-2">
          {allProviders.map((provider) => {
            const isAvailable = settings.available_providers.includes(provider);
            const isSelected = selected === provider;
            const hasCustomKey = settings.has_custom_keys.includes(provider);

            return (
              <button
                key={provider}
                onClick={() => isAvailable && setSelected(provider)}
                disabled={!isAvailable}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : isAvailable
                      ? 'border-border hover:border-primary/50'
                      : 'cursor-not-allowed border-border opacity-40'
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {PROVIDER_ICONS[provider]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {PROVIDER_LABELS[provider]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isAvailable
                      ? hasCustomKey
                        ? '내 API 키 사용 중'
                        : '사용 가능'
                      : 'API 키가 필요해요'}
                  </p>
                </div>
                {isSelected && (
                  <div className="h-3 w-3 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* API 키 입력 카드 */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-bold text-foreground">
          API 키 설정 (선택사항)
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          자신의 API 키를 입력하면 해당 모델을 사용할 수 있어요.
        </p>
        <div className="flex flex-col gap-3">
          {allProviders.map((provider) => (
            <div key={provider}>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {PROVIDER_LABELS[provider]}
              </label>
              <input
                type="password"
                placeholder={
                  settings.has_custom_keys.includes(provider)
                    ? '••••••••  (저장됨)'
                    : 'API 키 입력'
                }
                value={apiKeys[provider] ?? ''}
                onChange={(e) =>
                  setApiKeys((prev) => ({
                    ...prev,
                    [provider]: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex flex-col items-center gap-2">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? '저장 중...' : '설정 저장'}
        </Button>
        {saved && (
          <p className="text-sm font-medium text-primary">저장되었어요!</p>
        )}
        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}
      </div>
    </PageTransition>
  );
}
