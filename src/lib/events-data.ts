import fs from 'fs';
import path from 'path';
import { Event } from './types';

interface EventsFile {
  events: Event[];
  scrapedAt: string | null;
}

const DATA_PATH = path.join(process.cwd(), 'public', 'events.json');

let cached: EventsFile | null = null;

function load(): EventsFile {
  if (cached) return cached;
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    cached = JSON.parse(raw) as EventsFile;
  } catch {
    cached = { events: [], scrapedAt: null };
  }
  return cached;
}

export function getAllEvents(): Event[] {
  return load().events;
}

export function getLastScrapeTime(): string | null {
  return load().scrapedAt;
}

export function getEventsByDate(date: string, category?: string): Event[] {
  const events = getAllEvents().filter(e => e.date === date);
  if (category && category !== 'all') {
    return events.filter(e => e.category === category);
  }
  return events;
}

export function getEventsInRange(startDate: string, endDate: string): Event[] {
  return getAllEvents().filter(e => e.date >= startDate && e.date <= endDate);
}

export function getEventsByVenue(venueSlug: string): Event[] {
  const events = getAllEvents().filter(e => e.venue_slug === venueSlug);
  // Sort: upcoming events first (by date asc, then time), past events last (most recent first).
  const today = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(e => e.date >= today)
    .sort((a, b) => (a.date.localeCompare(b.date)) || (a.time || 'ZZ').localeCompare(b.time || 'ZZ'));
  const past = events.filter(e => e.date < today)
    .sort((a, b) => (b.date.localeCompare(a.date)) || (b.time || '').localeCompare(a.time || ''));
  return [...upcoming, ...past];
}

export function getEventCountsByVenue(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const e of getAllEvents()) {
    counts.set(e.venue_slug, (counts.get(e.venue_slug) ?? 0) + 1);
  }
  return counts;
}

export function getUpcomingEventCountsByVenue(): Map<string, number> {
  const today = new Date().toISOString().split('T')[0];
  const counts = new Map<string, number>();
  for (const e of getAllEvents()) {
    if (e.date >= today) counts.set(e.venue_slug, (counts.get(e.venue_slug) ?? 0) + 1);
  }
  return counts;
}

export function getEventDatesInMonth(year: number, month: number): string[] {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
  const dates = new Set<string>();
  for (const e of getAllEvents()) {
    if (e.date >= startDate && e.date < endDate) dates.add(e.date);
  }
  return Array.from(dates).sort();
}
