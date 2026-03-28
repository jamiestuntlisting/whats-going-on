import { NextRequest } from 'next/server';
import { getEventsByDate, getEventsInRange, getEventDatesInMonth, getLastScrapeTime } from '@/lib/db';
import { Event, getVenueConfig, SUBWAY_FARE } from '@/lib/types';
import { getSettings } from '@/lib/settings';

// Sort events by group order → venue order within group → time
function sortByGroupAndDistance(events: Event[]): Event[] {
  return events.sort((a, b) => {
    const va = getVenueConfig(a.venue_slug);
    const vb = getVenueConfig(b.venue_slug);
    const groupA = va?.groupOrder ?? 99;
    const groupB = vb?.groupOrder ?? 99;
    if (groupA !== groupB) return groupA - groupB;

    const venueA = va?.venueOrder ?? 99;
    const venueB = vb?.venueOrder ?? 99;
    if (venueA !== venueB) return venueA - venueB;

    // Same venue — sort by time
    const timeA = a.time || 'ZZ';
    const timeB = b.time || 'ZZ';
    return timeA.localeCompare(timeB);
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
    const events = sortByGroupAndDistance(getEventsInRange(startDate, endDate));
    return Response.json({ events: enrichEvents(events), lastScrape, homeAddress: settings.homeAddress });
  }

  // Get events for a specific date
  const targetDate = date || new Date().toISOString().split('T')[0];
  const events = sortByGroupAndDistance(getEventsByDate(targetDate, category));
  return Response.json({ events: enrichEvents(events), lastScrape, homeAddress: settings.homeAddress });
}
