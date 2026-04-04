import { Mail } from 'lucide-react';
import { PybaemSvg } from '@/components/characters/PybaemSvg';

function GitHubIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}

export function LandingFooter() {
  return (
    <footer className="w-full border-t border-primary/10 px-6 py-5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
            <PybaemSvg expression="happy" size={28} />
            pyRoad
          </span>
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
            <a href="#about" className="hover:text-foreground transition-colors">
              About
            </a>
            <a
              href="https://github.com/sguys99/pyroad"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              href="mailto:sguys99@gmail.com"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Mail size={13} />
              Contact
            </a>
          </div>
        </div>
        <div className="border-t border-primary/5 pt-3 text-center text-[11px] text-muted-foreground/60">
          © 2026 pyRoad. 초등학생을 위한 파이썬 학습 플랫폼
        </div>
      </div>
    </footer>
  );
}
