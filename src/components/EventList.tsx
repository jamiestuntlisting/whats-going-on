'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import SwipeableEvent from './SwipeableEvent';
import CategoryFilter from './CategoryFilter';
import DateNav from './DateNav';
import { loadDismissed, saveDismissed } from '@/lib/dismissed';

interface EnrichedEvent {
  id: string;
  venue: string;
  venue_slug: string;
  category: string;
  title: string;
  date: string;
  time: string | null;
  price: string | null;
  sold_out: boolean;
  image_url: string | null;
  event_url: string | null;
  description: string | null;
  scraped_at: string;
  walkMinutes: number;
  transitMinutes: number | null;
  drinkPrice: number;
  allInCost: number | null;
  group: string;
}

export default function EventList() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('all');
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScrape, setLastScrape] = useState<string | null>(null);

  // Dismissed event IDs from localStorage
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [dismissedHydrated, setDismissedHydrated] = useState(false);

  useEffect(() => {
    setDismissed(loadDismissed());
    setDismissedHydrated(true);
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?date=${date}&category=${category}`);
      const data = await res.json();
      setEvents(data.events || []);
      setLastScrape(data.lastScrape);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [date, category]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleDismiss = useCallback((id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const handleRestoreAll = useCallback(() => {
    setDismissed(new Set());
    saveDismissed(new Set());
  }, []);

  const visibleEvents = useMemo(
    () => (dismissedHydrated ? events.filter(e => !dismissed.has(e.id)) : events),
    [events, dismissed, dismissedHydrated],
  );
  const hiddenCount = events.length - visibleEvents.length;

  const scrapeAge = lastScrape
    ? Math.round((Date.now() - new Date(lastScrape).getTime()) / (1000 * 60))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <DateNav date={date} onChange={setDate} />
      <CategoryFilter selected={category} onChange={setCategory} />

      {/* Status row: freshness + restore-dismissed */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          {scrapeAge !== null
            ? scrapeAge < 60
              ? `Updated ${scrapeAge}m ago`
              : scrapeAge < 60 * 24
                ? `Updated ${Math.round(scrapeAge / 60)}h ago`
                : `Updated ${Math.round(scrapeAge / (60 * 24))}d ago`
            : 'No data yet'}
        </span>
        {hiddenCount > 0 && (
          <button
            onClick={handleRestoreAll}
            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 underline-offset-2 hover:underline"
          >
            Show {hiddenCount} dismissed
          </button>
        )}
      </div>

      {/* Events */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <div className="w-14 h-14 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/2" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🤷</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            {events.length === 0 ? 'No events found' : 'All events dismissed'}
          </p>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">
            {events.length === 0
              ? lastScrape
                ? 'Try a different date or category'
                : 'No events loaded yet — run `npm run scrape` locally and commit public/events.json'
              : 'Tap "Show dismissed" above to bring them back'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-400 font-medium">
            {visibleEvents.length} event{visibleEvents.length !== 1 ? 's' : ''} (closest first)
          </p>
          {visibleEvents.map(event => (
            <SwipeableEvent key={event.id} event={event} onDismiss={handleDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
