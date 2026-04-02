'use client';

import { m, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepGoals: string[];
}

export function StepProgressBar({
  currentStep,
  totalSteps,
  stepGoals,
}: StepProgressBarProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="border-b border-border bg-card px-4 py-3">
      <div className="mb-1.5 text-center text-xs font-medium text-muted-foreground">
        단계 {currentStep}/{totalSteps} —{' '}
        <span className="text-foreground">
          {stepGoals[currentStep - 1] ?? ''}
        </span>
      </div>

      <div className="flex items-center justify-center gap-1">
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;

          return (
            <div key={step} className="flex items-center">
              {i > 0 && (
                <div
                  className={cn(
                    'mx-0.5 h-0.5 w-4 rounded-full transition-colors sm:w-6',
                    isCompleted ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
              <m.div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  isCompleted &&
                    'bg-primary text-primary-foreground',
                  isCurrent &&
                    'border-2 border-primary bg-primary/10 text-primary',
                  !isCompleted &&
                    !isCurrent &&
                    'border border-border bg-muted text-muted-foreground',
                )}
                animate={isCurrent && !shouldReduceMotion ? { scale: [1, 1.1, 1] } : {}}
                transition={
                  isCurrent && !shouldReduceMotion
                    ? { repeat: Infinity, duration: 2, ease: 'easeInOut' }
                    : {}
                }
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : step}
              </m.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
