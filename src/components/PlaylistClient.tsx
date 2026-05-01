'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useDecisions, getDecision, type Decision } from '@/lib/decisions';
import type { PlaylistSection, PlaylistArtist } from '@/lib/playlist';

type ViewMode = 'undecided' | 'saved' | 'dismissed';

const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: 'undecided', label: 'Undecided' },
  { id: 'saved', label: '★ Saved' },
  { id: 'dismissed', label: 'Skipped' },
];

function ymdToShort(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function ymdToWeekday(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short' });
}

function youtubeMusicSearch(query: string): string {
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
}

function youtubeWatch(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Real YouTube playlist URL — only contains the IDs you give it. Cap at 50,
// the practical max for the watch_videos endpoint.
function youtubeWatchVideosUrl(videoIds: string[]): string | null {
  const clean = videoIds.filter(Boolean).slice(0, 50);
  if (clean.length === 0) return null;
  return `https://www.youtube.com/watch_videos?video_ids=${clean.join(',')}`;
}

interface Props {
  sections: PlaylistSection[];
  todayYmd: string;
  daysAhead: number;
}

export default function PlaylistClient({ sections, todayYmd, daysAhead }: Props) {
  const { maps, hydrated, set: setDecision, counts } = useDecisions();
  const [view, setView] = useState<ViewMode>('undecided');
  const [dayFilter, setDayFilter] = useState<string | null>(null); // YYYY-MM-DD or null for any
  const [venueFilter, setVenueFilter] = useState<string | null>(null); // venueSlug or null

  // Build the day chip strip — next N days from today
  const dayChips = useMemo(() => {
    const out: { ymd: string; label: string }[] = [];
    const start = new Date(`${todayYmd}T00:00:00`);
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const ymd = d.toISOString().split('T')[0];
      out.push({
        ymd,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : ymdToWeekday(ymd),
      });
    }
    return out;
  }, [todayYmd, daysAhead]);

  // Collect every venue that has at least one appearance, regardless of section
  const venueOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) {
      for (const a of s.artists) {
        for (const ap of a.appearances) {
          if (!m.has(ap.venueSlug)) m.set(ap.venueSlug, ap.venueName);
        }
      }
    }
    return Array.from(m.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((x, y) => x.name.localeCompare(y.name));
  }, [sections]);

  const matchesFilters = (artist: PlaylistArtist): boolean => {
    if (!dayFilter && !venueFilter) return true;
    return artist.appearances.some(a =>
      (!dayFilter || a.date === dayFilter) &&
      (!venueFilter || a.venueSlug === venueFilter)
    );
  };

  const matchesView = (artist: PlaylistArtist): boolean => {
    if (!hydrated) return view === 'undecided';
    const d = getDecision(maps, 'artist', artist.name);
    if (view === 'undecided') return d == null;
    if (view === 'saved') return d === 'yes';
    return d === 'no';
  };

  const filteredSections = useMemo(() => {
    return sections.map(s => ({
      ...s,
      artists: s.artists.filter(a => matchesFilters(a) && matchesView(a)),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, dayFilter, venueFilter, view, maps, hydrated]);

  const totalShown = filteredSections.reduce((n, s) => n + s.artists.length, 0);
  const tabCount = (id: ViewMode): number => {
    let n = 0;
    for (const s of sections) {
      for (const a of s.artists) {
        if (!matchesFilters(a)) continue;
        const d = hydrated ? getDecision(maps, 'artist', a.name) : null;
        if (id === 'undecided' && d == null) n++;
        else if (id === 'saved' && d === 'yes') n++;
        else if (id === 'dismissed' && d === 'no') n++;
      }
    }
    return n;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Pre-show playlist</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Tap an artist to open YouTube Music. Use ✓ / ✗ to keep or skip — once
          decided, they leave the Undecided view.
        </p>
      </header>

      {/* View tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {VIEW_TABS.map(t => {
          const active = view === t.id;
          const c = tabCount(t.id);
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {t.label}
              {c > 0 && <span className="ml-1.5 opacity-70">{c}</span>}
            </button>
          );
        })}
      </div>

      {/* Day filter strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
        <button
          onClick={() => setDayFilter(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
            dayFilter === null
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          Any day
        </button>
        {dayChips.map(c => {
          const active = dayFilter === c.ymd;
          return (
            <button
              key={c.ymd}
              onClick={() => setDayFilter(active ? null : c.ymd)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Venue filter strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
        <button
          onClick={() => setVenueFilter(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
            venueFilter === null
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          Any venue
        </button>
        {venueOptions.map(v => {
          const active = venueFilter === v.slug;
          return (
            <button
              key={v.slug}
              onClick={() => setVenueFilter(active ? null : v.slug)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {v.name}
            </button>
          );
        })}
      </div>

      {/* Saved/skipped global counter */}
      {hydrated && (counts.artistYes > 0 || counts.artistNo > 0) && (
        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 -mt-2">
          {counts.artistYes} saved · {counts.artistNo} skipped (total)
        </div>
      )}

      {/* Sections */}
      {totalShown === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">{view === 'saved' ? '✨' : view === 'dismissed' ? '🪦' : '🎧'}</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            {view === 'saved'
              ? 'Nothing saved that matches'
              : view === 'dismissed'
                ? 'Nothing skipped that matches'
                : 'All caught up — every artist has a decision'}
          </p>
        </div>
      ) : (
        filteredSections.map(section =>
          section.artists.length === 0 ? null : (
            <section key={section.label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="min-w-0">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {section.label} · {section.artists.length}
                  </h2>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                    {section.description}
                  </p>
                </div>
                {(() => {
                  // Build the playlist URL out of the artists currently visible
                  // in this section (after filters/decision tab) — that way
                  // "Play all" matches what's on screen.
                  const ids = section.artists
                    .map(a => a.videoId)
                    .filter((x): x is string => !!x);
                  const playlistUrl = youtubeWatchVideosUrl(ids);
                  if (playlistUrl) {
                    return (
                      <a
                        href={playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90"
                      >
                        ▶ Play all ({ids.length})
                      </a>
                    );
                  }
                  // Fallback: no resolved IDs, link to a search of all artist names.
                  return (
                    <a
                      href={youtubeMusicSearch(
                        section.artists.slice(0, 12).map(a => a.name).join(' | '),
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      Search all ▶
                    </a>
                  );
                })()}
              </div>

              <ul className="flex flex-col gap-1.5">
                {section.artists.map(artist => {
                  const filteredAppearances = artist.appearances.filter(a =>
                    (!dayFilter || a.date === dayFilter) &&
                    (!venueFilter || a.venueSlug === venueFilter)
                  );
                  const showAppearances = filteredAppearances.length > 0
                    ? filteredAppearances
                    : artist.appearances;

                  return (
                    <li
                      key={artist.name}
                      className="flex items-start gap-2 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                    >
                      <a
                        href={artist.videoId ? youtubeWatch(artist.videoId) : youtubeMusicSearch(artist.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-0 -m-1 p-1 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      >
                        <div className="font-medium truncate">
                          {artist.name}
                          {!artist.videoId && (
                            <span className="ml-1.5 text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 align-middle">
                              search
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 space-y-0.5">
                          {showAppearances.slice(0, 3).map((a, i) => (
                            <div key={i} className="truncate">
                              <span className="hover:underline">{a.venueName}</span>
                              {' · '}
                              {ymdToShort(a.date)}
                            </div>
                          ))}
                          {showAppearances.length > 3 && (
                            <div className="text-zinc-400 dark:text-zinc-500">
                              + {showAppearances.length - 3} more
                            </div>
                          )}
                        </div>
                      </a>

                      <div className="flex flex-col gap-1 shrink-0">
                        <DecisionButton
                          tone="save"
                          active={view !== 'undecided' && hydrated && getDecision(maps, 'artist', artist.name) === 'yes'}
                          onClick={() => {
                            const cur = hydrated ? getDecision(maps, 'artist', artist.name) : null;
                            const next: Decision = cur === 'yes' ? null : 'yes';
                            setDecision('artist', artist.name, next);
                          }}
                          aria-label={`Save ${artist.name}`}
                        />
                        <DecisionButton
                          tone="skip"
                          active={view !== 'undecided' && hydrated && getDecision(maps, 'artist', artist.name) === 'no'}
                          onClick={() => {
                            const cur = hydrated ? getDecision(maps, 'artist', artist.name) : null;
                            const next: Decision = cur === 'no' ? null : 'no';
                            setDecision('artist', artist.name, next);
                          }}
                          aria-label={`Skip ${artist.name}`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        )
      )}

      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-4">
        Want a real YouTube playlist?{' '}
        <Link href="/" className="underline">Open the Today view</Link> to keep
        deciding on individual events.
      </p>
    </div>
  );
}

function DecisionButton({
  tone,
  active,
  onClick,
  ...rest
}: {
  tone: 'save' | 'skip';
  active: boolean;
  onClick: () => void;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const baseColor =
    tone === 'save'
      ? active
        ? 'bg-green-500 text-white'
        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-green-100 dark:hover:bg-green-900/40'
      : active
        ? 'bg-red-500 text-white'
        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-red-100 dark:hover:bg-red-900/40';
  return (
    <button
      onClick={onClick}
      className={`w-9 h-8 rounded-full font-bold text-sm leading-none flex items-center justify-center transition-colors ${baseColor}`}
      {...rest}
    >
      {tone === 'save' ? '✓' : '✗'}
    </button>
  );
}
