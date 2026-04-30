import Link from 'next/link';
import { notFound } from 'next/navigation';
import { VENUES, getVenueConfig, SUBWAY_FARE } from '@/lib/types';
import { getEventsByVenue } from '@/lib/events-data';

export function generateStaticParams() {
  return VENUES.map(v => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = getVenueConfig(slug);
  if (!venue) return { title: 'Venue not found' };
  return {
    title: `${venue.name} — What's Going On`,
    description: `Upcoming events at ${venue.name} in ${venue.neighborhood}.`,
  };
}

function formatDate(d: string): string {
  // d is YYYY-MM-DD; render as "Sat May 3" without TZ math
  const [y, m, day] = d.split('-').map(Number);
  const local = new Date(y, m - 1, day);
  return local.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default async function VenueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = getVenueConfig(slug);
  if (!venue) notFound();

  const events = getEventsByVenue(slug);
  const today = new Date().toISOString().split('T')[0];
  const upcomingCount = events.filter(e => e.date >= today).length;

  // Estimated all-in if you go: drink + (round-trip subway when transit applies)
  const transitCost = venue.transitMinutes != null ? SUBWAY_FARE * 2 : 0;
  const baseCost = venue.drinkPrice + transitCost;

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2 flex flex-col gap-2">
        <div>
          <Link
            href="/venues"
            className="inline-flex items-center text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All venues
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{venue.name}</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          <span>{venue.neighborhood}</span>
          <span>·</span>
          <span>{venue.group}</span>
          <span>·</span>
          <span>
            {venue.transitMinutes != null
              ? `${venue.transitMinutes} min subway + ${venue.walkMinutes} min walk`
              : `${venue.walkMinutes} min walk`}
          </span>
          {baseCost > 0 && (
            <>
              <span>·</span>
              <span>~${baseCost.toFixed(2)} {venue.transitMinutes != null ? 'transit + drink' : 'drink'}</span>
            </>
          )}
        </div>
      </header>

      {events.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 gap-3">
          <p className="text-4xl">🤷</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">No information at this time</p>
          {venue.url ? (
            <a
              href={venue.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
            >
              View {venue.name}&apos;s calendar
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              No public calendar URL on file for this venue.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            {upcomingCount} upcoming
            {events.length > upcomingCount && ` · ${events.length - upcomingCount} past`}
          </p>
          <ul className="flex flex-col gap-2">
            {events.map(event => (
              <li key={event.id}>
                {event.event_url ? (
                  <a
                    href={event.event_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    <EventBody event={event} />
                  </a>
                ) : (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <EventBody event={event} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import type { Event } from '@/lib/types';

function EventBody({ event }: { event: Event }) {
  const isPast = event.date < new Date().toISOString().split('T')[0];
  return (
    <div className={`flex-1 min-w-0 ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
          {formatDate(event.date)}
        </span>
        {event.time && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{event.time}</span>
        )}
        {event.sold_out && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-red-600 dark:text-red-400 ml-auto">
            sold out
          </span>
        )}
      </div>
      <div className="font-medium mt-0.5 line-clamp-2">{event.title}</div>
      {event.price && !event.sold_out && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{event.price}</div>
      )}
    </div>
  );
}
