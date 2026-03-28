import { scrapeAllVenues, scrapeVenue } from '@/lib/scraper';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const venue = body.venue as string | undefined;

  try {
    if (venue) {
      const result = await scrapeVenue(venue);
      return Response.json({ results: [result] });
    }

    const results = await scrapeAllVenues();
    const totalEvents = results.reduce((sum, r) => sum + r.eventsFound, 0);
    const errors = results.filter(r => r.error);

    return Response.json({
      results,
      summary: {
        totalVenues: results.length,
        totalEvents,
        errors: errors.length,
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
