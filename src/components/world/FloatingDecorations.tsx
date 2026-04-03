'use client';

import { useReducedMotion } from 'framer-motion';

export function FloatingDecorations() {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden>
      {/* Clouds */}
      <div
        className="absolute opacity-30"
        style={{
          top: '8%',
          left: '5%',
          width: 40,
          height: 16,
          borderRadius: '8px',
          background: 'white',
          animation: 'float-cloud 25s ease-in-out infinite',
        }}
      />
      <div
        className="absolute opacity-20"
        style={{
          top: '22%',
          right: '8%',
          width: 32,
          height: 12,
          borderRadius: '6px',
          background: 'white',
          animation: 'float-cloud 30s ease-in-out infinite',
          animationDelay: '-8s',
        }}
      />
      <div
        className="absolute opacity-25"
        style={{
          top: '55%',
          left: '10%',
          width: 28,
          height: 10,
          borderRadius: '5px',
          background: 'white',
          animation: 'float-cloud 22s ease-in-out infinite',
          animationDelay: '-15s',
        }}
      />

      {/* Leaves */}
      <div
        className="absolute"
        style={{
          top: '35%',
          right: '15%',
          width: 8,
          height: 8,
          borderRadius: '0 50% 50% 50%',
          background: '#81C784',
          opacity: 0.5,
          animation: 'drift-leaf 18s linear infinite',
          animationDelay: '-4s',
        }}
      />
      <div
        className="absolute"
        style={{
          top: '60%',
          left: '20%',
          width: 6,
          height: 6,
          borderRadius: '0 50% 50% 50%',
          background: '#A5D6A7',
          opacity: 0.4,
          animation: 'drift-leaf 22s linear infinite',
          animationDelay: '-10s',
        }}
      />
    </div>
  );
}
