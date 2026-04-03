interface MapBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

export function MapBackground({ children, className }: MapBackgroundProps) {
  return (
    <div className={className} style={{ position: 'relative' }}>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: `linear-gradient(
            to top,
            oklch(0.88 0.10 145) 0%,
            oklch(0.84 0.08 148) 12%,
            oklch(0.78 0.07 150) 28%,
            oklch(0.65 0.08 155) 45%,
            oklch(0.72 0.06 148) 60%,
            oklch(0.80 0.10 80) 78%,
            oklch(0.85 0.13 78) 92%,
            oklch(0.88 0.12 82) 100%
          )`,
          borderRadius: 'inherit',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          opacity: 0.06,
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 20px,
            oklch(0.5 0.02 85) 20px,
            oklch(0.5 0.02 85) 21px
          )`,
          borderRadius: 'inherit',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
