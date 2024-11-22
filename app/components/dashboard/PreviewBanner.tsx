// components/dashboard/PreviewBanner.tsx
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Theme } from '@/types';
import { themes } from '@/lib/themes';

interface PreviewBannerProps {
  username?: string;
  theme: Theme;
}

export function PreviewBanner({ username, theme }: PreviewBannerProps) {
  const themeConfig = themes[theme];

  return (
    <div className={`mb-8 rounded-lg bg-white/80 p-4 shadow-sm ${themeConfig.buttonBorder}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm whitespace-nowrap">🔥 Your page is live at:</span>
          <code className="max-w-[200px] truncate rounded bg-black/5 px-2 py-1 text-sm">
            tiny.pm/{username}
          </code>
        </div>
        <Link
          href={`/${username}`}
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${themeConfig.buttonBg} ${themeConfig.buttonText} ${themeConfig.buttonHover}`}
        >
          <ExternalLink className="h-4 w-4" />
          View Page
        </Link>
      </div>
    </div>
  );
}