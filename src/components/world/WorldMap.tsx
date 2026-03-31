'use client';

import type { StageWithStatus } from '@/lib/types/database';
import { StageNode } from './StageNode';

interface WorldMapProps {
  stages: StageWithStatus[];
}

export function WorldMap({ stages }: WorldMapProps) {
  const reversed = [...stages].sort((a, b) => b.order - a.order);

  return (
    <div className="flex flex-col items-center gap-2 px-4 pb-8">
      {reversed.map((stage, index) => (
        <div key={stage.id} className="flex flex-col items-center w-full">
          <StageNode stage={stage} />
          {index < reversed.length - 1 && (
            <div className="h-6 w-0.5 bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}
