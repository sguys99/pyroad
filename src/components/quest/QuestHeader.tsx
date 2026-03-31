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
    <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-3">
      <Link
        href="/world"
        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        월드맵
      </Link>
      <span className="text-muted-foreground">/</span>
      <span className="truncate text-sm text-muted-foreground">
        {stageOrder}단계: {stageTitle}
      </span>
      <span className="text-muted-foreground">/</span>
      <span className="truncate text-sm font-medium text-foreground">
        {questTitle}
      </span>
    </header>
  );
}
