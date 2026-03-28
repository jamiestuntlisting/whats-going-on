'use client';

import { useState, useEffect, useCallback } from 'react';
import EventCard from './EventCard';
import CategoryFilter from './CategoryFilter';
import DateNav from './DateNav';

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
  const [scraping, setScraping] = useState(false);
  const [lastScrape, setLastScrape] = useState<string | null>(null);

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

  const handleScrape = async () => {
    setScraping(true);
    try {
      await fetch('/api/scrape', { method: 'POST' });
      await fetchEvents();
    } catch (err) {
      console.error('Scrape failed:', err);
    } finally {
      setScraping(false);
    }
  };

  const scrapeAge = lastScrape
    ? Math.round((Date.now() - new Date(lastScrape).getTime()) / (1000 * 60))
    : null;

  // Group events by their group name, preserving API sort order
  const groupedEvents: { group: string; events: EnrichedEvent[] }[] = [];
  let currentGroup = '';
  for (const event of events) {
    if (event.group !== currentGroup) {
      currentGroup = event.group;
      groupedEvents.push({ group: currentGroup, events: [] });
    }
    groupedEvents[groupedEvents.length - 1].events.push(event);
  }

  return (
    <div className="flex flex-col gap-4">
      <DateNav date={date} onChange={setDate} />
      <CategoryFilter selected={category} onChange={setCategory} />

      {/* Scrape status */}
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>
          {scrapeAge !== null
            ? scrapeAge < 60
              ? `Updated ${scrapeAge}m ago`
              : `Updated ${Math.round(scrapeAge / 60)}h ago`
            : 'No data yet'}
        </span>
        <button
          onClick={handleScrape}
          disabled={scraping}
          className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {scraping ? 'Refreshing...' : 'Refresh'}
        </button>
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
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🤷</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">No events found</p>
          <p className="text-zinc-400 dark:text-zinc-500 text-sm mt-1">
            {lastScrape ? 'Try a different date or category' : 'Hit Refresh to load events'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-zinc-400 font-medium">{events.length} event{events.length !== 1 ? 's' : ''}</p>
          {groupedEvents.map(({ group, events: groupEvents }) => (
            <div key={group} className="flex flex-col gap-2">
              {/* Group header */}
              <div className="sticky top-0 z-10 pt-2 pb-1 -mx-1 px-1 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {group}
                </h3>
              </div>
              {groupEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
