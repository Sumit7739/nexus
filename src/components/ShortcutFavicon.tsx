import { useEffect, useMemo, useState } from 'react';
import { Globe2 } from 'lucide-react';
import type { AppDefinition } from '../apps/app-types';
import {
  extractHostname,
  getFaviconCandidates,
  getMonogramToneIndex,
} from '../data/shortcuts';

type CachedFavicon =
  | { status: 'loaded'; src: string }
  | { status: 'failed' };

/* Session-level favicon resolution cache so icons in the App Menu, Dock, and Desktop
   render without re-cascading or flickering once resolved. */
const faviconCache = new Map<string, CachedFavicon>();

interface ShortcutFaviconProps {
  url: string;
  title?: string;
  size?: number;
  className?: string;
}

export function ShortcutFavicon({
  url,
  title = '',
  size = 20,
  className = '',
}: ShortcutFaviconProps) {
  const hostname = useMemo(() => extractHostname(url), [url]);
  const candidates = useMemo(() => getFaviconCandidates(url), [url]);

  const cached = hostname ? faviconCache.get(hostname) : undefined;

  const [candidateIdx, setCandidateIdx] = useState(0);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(
    cached?.status === 'loaded' ? cached.src : null
  );
  const [allFailed, setAllFailed] = useState<boolean>(
    cached?.status === 'failed' || candidates.length === 0
  );

  useEffect(() => {
    if (!hostname || candidates.length === 0) {
      setLoadedSrc(null);
      setAllFailed(true);
      return;
    }
    const entry = faviconCache.get(hostname);
    if (entry?.status === 'loaded') {
      setLoadedSrc(entry.src);
      setAllFailed(false);
      return;
    }
    if (entry?.status === 'failed') {
      setLoadedSrc(null);
      setAllFailed(true);
      return;
    }
    setCandidateIdx(0);
    setLoadedSrc(null);
    setAllFailed(false);
  }, [hostname, candidates]);

  const activeSrc = loadedSrc ?? (!allFailed ? candidates[candidateIdx] ?? null : null);
  const isLoading = !loadedSrc && !allFailed && Boolean(activeSrc);

  const initial = (title.trim() || hostname || '?').charAt(0).toUpperCase();
  const toneIdx = getMonogramToneIndex(hostname || title || 'nexus');

  if (!url.trim()) {
    return (
      <span className={`sf-root sf-placeholder ${className}`} aria-hidden="true">
        <Globe2 size={Math.max(14, Math.round(size * 0.85))} strokeWidth={1.4} />
      </span>
    );
  }

  return (
    <span
      className={`sf-root ${isLoading ? 'is-loading' : ''} ${loadedSrc ? 'is-loaded' : ''} ${allFailed ? `is-fallback sf-tone-${toneIdx}` : ''} ${className}`}
      aria-hidden="true"
    >
      {isLoading && <span className="sf-shimmer" />}

      {activeSrc && !allFailed && (
        <img
          key={activeSrc}
          src={activeSrc}
          alt=""
          width={size}
          height={size}
          decoding="async"
          referrerPolicy="no-referrer"
          className={`sf-img ${loadedSrc ? 'is-visible' : ''}`}
          style={{ width: size, height: size }}
          onLoad={() => {
            if (hostname) {
              faviconCache.set(hostname, { status: 'loaded', src: activeSrc });
            }
            setLoadedSrc(activeSrc);
          }}
          onError={() => {
            const nextIdx = candidateIdx + 1;
            if (nextIdx < candidates.length) {
              setCandidateIdx(nextIdx);
            } else {
              if (hostname) {
                faviconCache.set(hostname, { status: 'failed' });
              }
              setAllFailed(true);
            }
          }}
        />
      )}

      {allFailed && <span className="sf-monogram">{initial}</span>}
    </span>
  );
}

export function AppIconGraphic({
  app,
  size = 20,
}: {
  app: AppDefinition;
  size?: number;
}) {
  if (app.shortcut) {
    return (
      <ShortcutFavicon
        url={app.shortcut.url}
        title={app.shortcut.title}
        size={size}
      />
    );
  }
  const Icon = app.icon;
  return <Icon size={size} strokeWidth={1.4} />;
}
