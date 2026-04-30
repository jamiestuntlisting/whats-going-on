import Link from 'next/link';
import { VENUES, VENUE_GROUPS } from '@/lib/types';
import { getEventCountsByVenue, getLastScrapeTime } from '@/lib/events-data';

export default function VenuesPage() {
  const counts = getEventCountsByVenue();
  const lastScrape = getLastScrapeTime();

  // Group venues using the canonical group order, preserving venueOrder within.
  const grouped = VENUE_GROUPS.map(group => ({
    group,
    venues: VENUES
      .filter(v => v.group === group)
      .sort((a, b) => a.venueOrder - b.venueOrder),
  })).filter(g => g.venues.length > 0);

  const scrapeAge = lastScrape
    ? Math.round((Date.now() - new Date(lastScrape).getTime()) / (1000 * 60))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">Venues</h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {`${VENUES.length} venues we're tracking`}
          {scrapeAge !== null && (
            <>
              {' · '}
              {scrapeAge < 60
                ? `updated ${scrapeAge}m ago`
                : scrapeAge < 60 * 24
                  ? `updated ${Math.round(scrapeAge / 60)}h ago`
                  : `updated ${Math.round(scrapeAge / (60 * 24))}d ago`}
            </>
          )}
        </p>
      </header>

      {grouped.map(({ group, venues }) => (
        <section key={group} className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 pt-2">
            {group}
          </h2>
          <ul className="flex flex-col gap-1.5">
            {venues.map(venue => {
              const count = counts.get(venue.slug) ?? 0;
              const subtitle = [
                venue.neighborhood,
                venue.transitMinutes != null
                  ? `${venue.transitMinutes} min subway`
                  : `${venue.walkMinutes} min walk`,
              ].join(' · ');
              return (
                <li key={venue.slug}>
                  <Link
                    href={`/venues/${venue.slug}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{venue.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                        {subtitle}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      {count > 0 ? (
                        <span className="text-xs font-medium tabular-nums text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                          {count}
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          no info
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
