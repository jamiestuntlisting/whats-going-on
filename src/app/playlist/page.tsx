import Link from 'next/link';
import { getPlaylistSections, youtubeMusicSearchUrl } from '@/lib/playlist';

export const metadata = {
  title: 'Pre-show playlist — What\'s Going On',
  description: 'Listen to the artists playing live in Brooklyn this week.',
};

function formatShortDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function PlaylistPage() {
  const sections = getPlaylistSections(14);
  const totalArtists = sections.reduce((n, s) => n + s.artists.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Pre-show playlist</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {totalArtists} artists with shows in the next 14 days. Tap any name to
          open them in YouTube Music.
        </p>
      </header>

      {totalArtists === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🎧</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            No upcoming music acts
          </p>
        </div>
      ) : (
        sections.map(section =>
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
                <a
                  href={youtubeMusicSearchUrl(
                    section.artists.slice(0, 12).map(a => a.name).join(' | '),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90"
                >
                  Search all ▶
                </a>
              </div>

              <ul className="flex flex-col gap-1.5">
                {section.artists.map(artist => (
                  <li
                    key={artist.name}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{artist.name}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 space-y-0.5">
                        {artist.appearances.slice(0, 3).map((a, i) => (
                          <div key={i} className="truncate">
                            <Link
                              href={`/venues/${a.venueSlug}`}
                              className="hover:text-zinc-900 dark:hover:text-zinc-100"
                            >
                              {a.venueName}
                            </Link>
                            {' · '}
                            {formatShortDate(a.date)}
                          </div>
                        ))}
                        {artist.appearances.length > 3 && (
                          <div className="text-zinc-400 dark:text-zinc-500">
                            + {artist.appearances.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                    <a
                      href={youtubeMusicSearchUrl(artist.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-medium px-3 py-2 rounded-full bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      aria-label={`Play ${artist.name} on YouTube Music`}
                    >
                      ▶ Play
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ),
        )
      )}

      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-4">
        Artist names are extracted from event titles, so the occasional one will
        be off — the YouTube search will still surface something close.
      </p>
    </div>
  );
}
