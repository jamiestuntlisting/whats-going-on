import { NextRequest } from 'next/server';
import { getEventsByDate, getEventsInRange, getEventDatesInMonth, getLastScrapeTime } from '@/lib/events-data';
import { Event, getVenueConfig, SUBWAY_FARE } from '@/lib/types';
import { getSettings } from '@/lib/settings';

// Convert a display time like "8:00 PM" / "9:30 AM" to minutes since midnight
// so we can sort chronologically. Lexical sort is wrong ("10:00 AM" < "9:00 AM"),
// hence this parse. Events with no known time sink to the end of their section.
function timeToMinutes(time: string | null): number {
  if (!time) return 99999;
  const m = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 99999;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3]?.toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

// Sort by date → time of day → venue priority → title. Time of day is the
// primary key (within a day) so the earliest shows surface first in each
// transport-tier section on the Today view. Priority is only a same-time
// tie-breaker. The leading date key keeps multi-day range queries (Calendar)
// grouped by day rather than interleaving times across dates.
function sortByTime(events: Event[]): Event[] {
  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const ta = timeToMinutes(a.time);
    const tb = timeToMinutes(b.time);
    if (ta !== tb) return ta - tb;
    const pa = getVenueConfig(a.venue_slug)?.priority ?? 99;
    const pb = getVenueConfig(b.venue_slug)?.priority ?? 99;
    if (pa !== pb) return pa - pb;
    return a.title.localeCompare(b.title);
  });
}

// Enrich events with venue metadata for the frontend
interface EnrichedEvent extends Event {
  walkMinutes: number;
  transitMinutes: number | null;
  drinkPrice: number;
  allInCost: number | null; // ticket + transit + drink, null if ticket price unknown
  group: string;
}

function enrichEvents(events: Event[]): EnrichedEvent[] {
  return events.map(event => {
    const vc = getVenueConfig(event.venue_slug);
    const walkMinutes = vc?.walkMinutes ?? 0;
    const transitMinutes = vc?.transitMinutes ?? null;
    const drinkPrice = vc?.drinkPrice ?? 0;
    const group = vc?.group ?? 'Other';

    // Parse ticket price from string like "$20.00", "$10", "From $15", "Free"
    let ticketCost: number | null = null;
    if (event.price) {
      const match = event.price.match(/\$(\d+(?:\.\d+)?)/);
      if (match) ticketCost = parseFloat(match[1]);
      else if (/free/i.test(event.price)) ticketCost = 0;
    }

    let allInCost: number | null = null;
    if (ticketCost !== null) {
      allInCost = ticketCost + drinkPrice + (transitMinutes ? SUBWAY_FARE * 2 : 0); // round trip subway
      allInCost = Math.round(allInCost * 100) / 100;
    }

    return {
      ...event,
      walkMinutes,
      transitMinutes,
      drinkPrice,
      allInCost,
      group,
    };
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get('date');
  const category = searchParams.get('category') || 'all';
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');
  const month = searchParams.get('month');
  const lastScrape = getLastScrapeTime();
  const settings = getSettings();

  // Get event dates for a month (for calendar dots)
  if (month) {
    const [year, m] = month.split('-').map(Number);
    const dates = getEventDatesInMonth(year, m);
    return Response.json({ dates, lastScrape });
  }

  const today = new Date().toISOString().split('T')[0];

  // Get events in a date range. Clamp the start to today so past shows are
  // never returned, even if an old date is requested.
  if (startDate && endDate) {
    const from = startDate < today ? today : startDate;
    const events = sortByTime(getEventsInRange(from, endDate));
    return Response.json({ events: enrichEvents(events), lastScrape, homeAddress: settings.homeAddress });
  }

  // Get events for a specific date. Never serve a past date — fall back to
  // today so old shows are thrown away.
  const requested = date || today;
  const targetDate = requested < today ? today : requested;
  const events = sortByTime(getEventsByDate(targetDate, category));
  return Response.json({ events: enrichEvents(events), lastScrape, homeAddress: settings.homeAddress });
}
