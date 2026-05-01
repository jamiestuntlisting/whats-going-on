import * as cheerio from 'cheerio';
import { BaseScraper, scrapeSpaWithPuppeteer } from '../base';
import { Event } from '../../types';

// Both Barbès and Jalopy publish their full schedule on viewcy.com under a
// venue slug (`/barbes`, `/jalopytheatre`). Each event renders as a card
// stamped with `data-sentry-component="EventCard"` (Sentry-injected, stable
// across builds — unlike the CSS-module class names, which rotate).
//
// Inside each card:
//   <a href="/event/<slug>">
//   text content: "<Title>\n\n<Month> <Day>, <Year> • <H>:<MM> <AM/PM> EDT\n\n by <Venue>\n\n<DD>\n<MMM>"
//   <img alt="<Title> thumbnail">
//
// We pull the title from <h3>, the date+time from the running text via regex.
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

interface DateTime { date: string; time: string | null; }

// Strict month token — anchored so "anniversaryMay" can't sneak through with
// `\w{3,9}` matching the tail of the previous word + "May".
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

function parseDateTime(text: string): DateTime | null {
  // viewcy concatenates h3 + date <div> with no whitespace, so the run looks
  // like "...anniversaryMay 1, 2026". The strict month-name alternation is
  // enough — false positives need a digit-then-comma-then-4-digit-year right
  // after a real month name, which doesn't occur in show titles.
  const dt = new RegExp(
    `${MONTH_RE}\\s+(\\d{1,2}),\\s*(\\d{4})\\s*[•·･]\\s*(\\d{1,2}:\\d{2}\\s*(?:AM|PM))`,
    'i',
  );
  const m = text.match(dt);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) return {
      date: `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`,
      time: m[4].toUpperCase().replace(/\s+/g, ' '),
    };
  }
  // Date only fallback ("May 1, 2026").
  const dOnly = new RegExp(`${MONTH_RE}\\s+(\\d{1,2}),\\s*(\\d{4})`, 'i');
  const m2 = text.match(dOnly);
  if (m2) {
    const month = MONTHS[m2[1].toLowerCase()];
    if (month) return {
      date: `${m2[3]}-${String(month).padStart(2, '0')}-${m2[2].padStart(2, '0')}`,
      time: null,
    };
  }
  return null;
}

export class ViewcyScraper extends BaseScraper {
  async scrape(): Promise<Event[]> {
    // Cards mount over time and the list is virtual-scrolled; ask the helper
    // to wait for at least 5 cards to appear and to scroll through the page.
    const html = await scrapeSpaWithPuppeteer(this.venue.url, {
      waitSelector: 'a[href*="/event/"]',
      countSelector: '[data-sentry-component="EventCard"]',
      minCount: 5,
      scrollPasses: 4,
      countTimeoutMs: 10000,
    });
    const $ = cheerio.load(html);
    const events: Event[] = [];
    const seen = new Set<string>();

    $('[data-sentry-component="EventCard"]').each((_, el) => {
      try {
        const $el = $(el);
        // The card mounts twice in the DOM (image variant + row variant).
        // Use the event slug as a dedupe key.
        const link = $el.find('a[href*="/event/"]').first().attr('href') || '';
        const slugMatch = link.match(/\/event\/([a-z0-9_-]+)/i);
        if (!slugMatch) return;
        const slug = slugMatch[1];
        if (seen.has(slug)) return;
        seen.add(slug);

        const title = $el.find('h3, h2, h1').first().text().trim()
          || $el.find('img').first().attr('alt')?.replace(/\s+thumbnail$/i, '').trim()
          || '';
        if (!title) return;

        const text = $el.text().replace(/\s+/g, ' ').trim();
        const dt = parseDateTime(text);
        if (!dt) return;

        const event_url = link.startsWith('http') ? link : `https://www.viewcy.com${link}`;
        const img = $el.find('img').first().attr('src') || null;

        events.push(this.makeEvent({
          title,
          date: dt.date,
          time: dt.time ? this.parseTime(dt.time) : null,
          image_url: img,
          event_url,
        }));
      } catch {}
    });

    return events;
  }
}
