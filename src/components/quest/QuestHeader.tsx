'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface QuestHeaderProps {
  stageTitle: string;
  stageOrder: number;
  questTitle: string;
}

export function QuestHeader({
  stageTitle,
  stageOrder,
  questTitle,
}: QuestHeaderProps) {
  return (
    <header className="flex min-w-0 items-center gap-2 border-b border-border bg-background px-4 py-2 sm:gap-3">
      <Link
        href="/world"
        className="flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        월드맵
      </Link>
      <span className="hidden text-muted-foreground sm:inline">/</span>
      <span className="hidden truncate text-sm text-muted-foreground sm:inline">
        {stageOrder}단계: {stageTitle}
      </span>
      <span className="text-muted-foreground">/</span>
      <span className="min-w-0 truncate text-sm font-medium text-foreground">
        {questTitle}
      </span>
    </header>
  );
}
