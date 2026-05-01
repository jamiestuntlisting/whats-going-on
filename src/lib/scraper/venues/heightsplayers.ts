import * as cheerio from 'cheerio';
import { BaseScraper, scrapeWithPuppeteer } from '../base';
import { Event } from '../../types';

// Heights Players sells tickets through onstage.tickets. The venue page lists
// each production as a `.show` card with a `.show-title` and a date-range
// paragraph like "May 01 - May 17, 2026". We emit one event on the run's
// start date (description carries the end date so users can see the window).
//
// Months in the date string can be abbreviated (May, Jun) or full (January).
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

interface DateRange { start: string; end: string | null; }

function parseRange(text: string): DateRange | null {
  const t = text.replace(/\s+/g, ' ').trim();
  // "May 01 - May 17, 2026"  /  "Jun 19 - Jun 20, 2026"  /  "May 5 - 7, 2026"
  const m = t.match(/(\w{3,9})\s+(\d{1,2})\s*[-–—]\s*(?:(\w{3,9})\s+)?(\d{1,2}),\s*(\d{4})/i);
  if (m) {
    const [, m1, d1, m2raw, d2, year] = m;
    const month1 = MONTHS[m1.toLowerCase()];
    const month2 = MONTHS[(m2raw || m1).toLowerCase()];
    if (!month1 || !month2) return null;
    return {
      start: `${year}-${String(month1).padStart(2, '0')}-${d1.padStart(2, '0')}`,
      end:   `${year}-${String(month2).padStart(2, '0')}-${d2.padStart(2, '0')}`,
    };
  }
  // Single date: "May 17, 2026"
  const single = t.match(/(\w{3,9})\s+(\d{1,2}),\s*(\d{4})/i);
  if (single) {
    const month = MONTHS[single[1].toLowerCase()];
    if (!month) return null;
    return {
      start: `${single[3]}-${String(month).padStart(2, '0')}-${single[2].padStart(2, '0')}`,
      end: null,
    };
  }
  return null;
}

export class HeightsPlayersScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    const html = await scrapeWithPuppeteer(this.venue.url, '.show');
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    $('.show').each((_, el) => {
      try {
        const $el = $(el);
        const title = $el.find('.show-title').first().text().trim();
        if (!title) return;
        const dateText = $el.find('p').first().text().trim();
        const range = parseRange(dateText);
        if (!range) return;

        const href = $el.find('a[href*="/show/"]').first().attr('href') || '';
        const event_url = href ? new URL(href, 'https://www.onthestage.tickets').href : this.venue.url;

        const img = $el.find('img').first().attr('src') || null;
        const imgUrl = img
          ? (img.startsWith('http') ? img : img.startsWith('//') ? `https:${img}` : new URL(img, this.venue.url).href)
          : null;

        const description = range.end && range.end !== range.start
          ? `Runs ${dateText.replace(/\s+/g, ' ')}`
          : null;

        const key = `${title}|${range.start}`;
        if (seen.has(key)) return;
        seen.add(key);

        events.push(this.makeEvent({
          title,
          date: range.start,
          time: null,
          image_url: imgUrl,
          event_url,
          description,
        }));
      } catch {}
    });

    return events;
  }
}
