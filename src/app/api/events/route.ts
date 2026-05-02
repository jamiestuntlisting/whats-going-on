import { NextRequest } from 'next/server';
import { getEventsByDate, getEventsInRange, getEventDatesInMonth, getLastScrapeTime } from '@/lib/events-data';
import { Event, getVenueConfig, SUBWAY_FARE } from '@/lib/types';
import { getSettings } from '@/lib/settings';

// Effective travel time from home: subway when defined (faster path),
// otherwise walking. Used as the primary sort key so distant events sink
// to the bottom of the list.
function effectiveMinutes(slug: string): number {
  const v = getVenueConfig(slug);
  if (!v) return 999;
  return v.transitMinutes ?? v.walkMinutes;
}

// Sort events by venue priority tier → effective travel time → time → title.
// Priority tier reflects user preference (top picks > cinema > others); distance
// is the tie-breaker within a tier.
function sortByDistance(events: Event[]): Event[] {
  return events.sort((a, b) => {
    const pa = getVenueConfig(a.venue_slug)?.priority ?? 99;
    const pb = getVenueConfig(b.venue_slug)?.priority ?? 99;
    if (pa !== pb) return pa - pb;
    const ma = effectiveMinutes(a.venue_slug);
    const mb = effectiveMinutes(b.venue_slug);
    if (ma !== mb) return ma - mb;
    const timeA = a.time || 'ZZ';
    const timeB = b.time || 'ZZ';
    if (timeA !== timeB) return timeA.localeCompare(timeB);
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

  // Get events in a date range
  if (startDate && endDate) {
    const events = sortByDistance(getEventsInRange(startDate, endDate));
    return Response.json({ events: enrichEvents(events), lastScrape, homeAddress: settings.homeAddress });
  }

  // Get events for a specific date
  const targetDate = date || new Date().toISOString().split('T')[0];
  const events = sortByDistance(getEventsByDate(targetDate, category));
  return Response.json({ events: enrichEvents(events), lastScrape, homeAddress: settings.homeAddress });
}
