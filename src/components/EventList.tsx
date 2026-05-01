'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import SwipeableEvent from './SwipeableEvent';
import CategoryFilter from './CategoryFilter';
import DateNav from './DateNav';
import { useDecisions, getDecision, type Decision } from '@/lib/decisions';

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

type ViewMode = 'undecided' | 'saved' | 'dismissed';

const VIEW_TABS: { id: ViewMode; label: string }[] = [
  { id: 'undecided', label: 'Undecided' },
  { id: 'saved', label: '★ Saved' },
  { id: 'dismissed', label: 'Skipped' },
];

export default function EventList() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('all');
  const [view, setView] = useState<ViewMode>('undecided');
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScrape, setLastScrape] = useState<string | null>(null);

  const { maps, hydrated, set: setDecision, counts } = useDecisions();

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

  const handleDecide = useCallback((id: string, decision: Decision) => {
    setDecision('event', id, decision);
  }, [setDecision]);

  // Filter by current view: undecided / saved / dismissed
  const visibleEvents = useMemo(() => {
    if (!hydrated) return events;
    return events.filter(e => {
      const d = getDecision(maps, 'event', e.id);
      if (view === 'undecided') return d == null;
      if (view === 'saved') return d === 'yes';
      return d === 'no';
    });
  }, [events, maps, view, hydrated]);

  const undecidedCount = useMemo(
    () => events.filter(e => getDecision(maps, 'event', e.id) == null).length,
    [events, maps],
  );
  const savedCount = useMemo(
    () => events.filter(e => getDecision(maps, 'event', e.id) === 'yes').length,
    [events, maps],
  );
  const dismissedCount = useMemo(
    () => events.filter(e => getDecision(maps, 'event', e.id) === 'no').length,
    [events, maps],
  );
  const tabCount = (id: ViewMode) =>
    id === 'undecided' ? undecidedCount : id === 'saved' ? savedCount : dismissedCount;

  const scrapeAge = lastScrape
    ? Math.round((Date.now() - new Date(lastScrape).getTime()) / (1000 * 60))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <DateNav date={date} onChange={setDate} />
      <CategoryFilter selected={category} onChange={setCategory} />

      {/* View tabs: Undecided / Saved / Skipped */}
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

      {/* Freshness + global counts */}
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
        {hydrated && (counts.eventYes > 0 || counts.eventNo > 0) && (
          <span>
            {counts.eventYes} saved · {counts.eventNo} skipped
          </span>
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
          <p className="text-4xl mb-3">{view === 'saved' ? '✨' : view === 'dismissed' ? '🪦' : '🤷'}</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">
            {events.length === 0
              ? 'No events found'
              : view === 'saved'
                ? 'Nothing saved yet for this date'
                : view === 'dismissed'
                  ? 'Nothing skipped yet'
                  : 'All caught up — every event has a decision'}
          </p>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">
            {events.length === 0
              ? lastScrape
                ? 'Try a different date or category'
                : 'No events loaded yet — run `npm run scrape` locally and commit public/events.json'
              : view === 'saved'
                ? 'Swipe right on any event to save it'
                : view === 'dismissed'
                  ? 'Swipe left to skip events you do not want to see'
                  : 'Tap "★ Saved" to see what you picked'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-400 font-medium">
            {visibleEvents.length} event{visibleEvents.length !== 1 ? 's' : ''}
            {view === 'undecided' ? ' (closest first)' : ''}
          </p>
          {visibleEvents.map(event => (
            <SwipeableEvent key={event.id} event={event} onDecide={handleDecide} />
          ))}
        </div>
      )}
    </div>
  );
}
